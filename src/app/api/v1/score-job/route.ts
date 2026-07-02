import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { xmlEscape } from '@/lib/xml-escape';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { sanitizeScoreValue } from '@/lib/score-utils';
import {
  JobDescriptionInputError,
  resolveJobDescriptionInput,
  resolvePreFetchedJobDescription,
} from '@/lib/job-description-input';
import {
  scoringClient,
  buildScorePayload,
  buildScoringInput,
  buildGapAnalysisPrompt,
  extractTextContent,
  parseJsonResponse,
} from '@/lib/score-core';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 256 * 1024;
const MAX_JOB_CONTENT_SIZE = 200 * 1024;

function buildEmptyShellFallbackText({
  title,
  company,
  url,
}: {
  title: string;
  company: string;
  url: string;
}): string {
  const slugHint = (() => {
    try {
      const { pathname } = new URL(url);
      return pathname.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  })();
  return [
    `Position: ${title}`,
    `Company: ${company}`,
    slugHint ? `Role keywords: ${slugHint}` : '',
    `Source: ${url}`,
    'Responsibilities and requirements unavailable — client-side-rendered posting; scoring from title and URL only.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    const rateLimit = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.resumeGenerator, ip);
    if (rateLimit.limited) {
      return Errors.rateLimited(rateLimit.retryAfter || 60);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Errors.validationError('Request body must be a JSON object.');
    }

    const { url, title, company, job_content: jobContent } = body as Record<string, unknown>;
    const normalizedUrl = typeof url === 'string' ? url.trim() : url;
    const normalizedTitle = typeof title === 'string' ? title.trim() : title;
    const normalizedCompany = typeof company === 'string' ? company.trim() : company;
    const hasJobContent = typeof jobContent === 'string' && jobContent.trim().length > 0;

    if (!normalizedUrl || typeof normalizedUrl !== 'string') {
      return Errors.validationError('"url" is required and must be a string.');
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return Errors.validationError('"url" must be an http or https URL.');
      }
    } catch {
      return Errors.validationError('"url" must be a valid URL.');
    }
    if (!normalizedTitle || typeof normalizedTitle !== 'string') {
      return Errors.validationError('"title" is required and must be a string.');
    }
    if (!normalizedCompany || typeof normalizedCompany !== 'string') {
      return Errors.validationError('"company" is required and must be a string.');
    }
    if (jobContent !== undefined && typeof jobContent !== 'string') {
      return Errors.validationError('"job_content" must be a string when provided.');
    }
    if (hasJobContent && new TextEncoder().encode(jobContent as string).byteLength > MAX_JOB_CONTENT_SIZE) {
      return Errors.badRequest(`"job_content" exceeds ${MAX_JOB_CONTENT_SIZE} byte limit.`);
    }

    const resolvedInput = hasJobContent
      ? resolvePreFetchedJobDescription(jobContent as string, normalizedUrl)
      : await resolveJobDescriptionInput(
          normalizedUrl,
          'Mozilla/5.0 (compatible; ResumeScoreBot/1.0)'
        );

    const scoringText = resolvedInput.isEmptyShell
      ? buildEmptyShellFallbackText({
          title: normalizedTitle,
          company: normalizedCompany,
          url: normalizedUrl,
        })
      : resolvedInput.text;

    const { readinessScore } = buildScoringInput(scoringText);
    const currentScore = buildScorePayload(readinessScore);

    const message = await scoringClient.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: 'You are a resume readiness analyst. Be concise and accurate.',
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `${buildGapAnalysisPrompt(currentScore)}\n\n<job_description>${xmlEscape(resolvedInput.text)}</job_description>`,
        },
      ],
    });

    const responseText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(responseText);

    const gapAnalysis = typeof parsed.gapAnalysis === 'string' ? parsed.gapAnalysis : '';
    const parsedMaxScore = sanitizeScoreValue(parsed.maxPossibleScore, 0, 100);
    const maxPossibleScore = Math.max(currentScore.total, parsedMaxScore);
    const gap = maxPossibleScore - currentScore.total;

    const recommendation = gap > 15
      ? 'full_generation_recommended'
      : gap >= 5
        ? 'marginal_improvement'
        : 'strong_fit';

    logApiAccess('api_score_job', authResult.apiKey, {
      company: normalizedCompany,
      title: normalizedTitle,
      url: normalizedUrl,
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      emptyShell: resolvedInput.isEmptyShell === true,
      currentScore: currentScore.total,
      maxPossibleScore,
      recommendation,
    }, ip).catch((error) => {
      console.warn('[api/v1/score-job] Failed to log audit:', error);
    });

    return apiSuccess({
      company: normalizedCompany,
      title: normalizedTitle,
      url: normalizedUrl,
      currentScore,
      maxPossibleScore,
      gapAnalysis,
      recommendation,
      ...(resolvedInput.isEmptyShell ? { emptyShellFallback: true } : {}),
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message, { failure_mode: error.failureMode });
    }

    console.error('[api/v1/score-job] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
