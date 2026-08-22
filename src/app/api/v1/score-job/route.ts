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
  extractTextContent,
  parseJsonResponse,
  buildGapAnalysisPrompt,
  buildScorePayload,
  buildScoringInput,
} from '@/lib/score-core';
import { evaluateRoleFit } from '@/lib/role-fit-scorer';

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

    // ENG-1800: meter authenticated callers under their own tier, keyed by API
    // key id. requireApiKey has already run above, so every caller here is a
    // known first-party client — metering them in the anonymous IP-keyed
    // `resumeGenerator` bucket put a batch client inside an abuse limit.
    const rateLimit = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.scoreJobAuthenticated,
      authResult.apiKey.id
    );
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

    const { url, title, company, job_content: jobContent, mode, location } = body as Record<string, unknown>;

    if (mode !== undefined && mode !== null && mode !== 'interview-prep') {
      return Errors.badRequest('Invalid mode. Accepted values: "interview-prep".');
    }
    const interviewPrepMode = mode === 'interview-prep';

    const normalizedUrl = typeof url === 'string' ? url.trim() : url;
    const normalizedTitle = typeof title === 'string' ? title.trim() : title;
    const normalizedCompany = typeof company === 'string' ? company.trim() : company;
    const hasJobContent = typeof jobContent === 'string' && jobContent.trim().length > 0;
    const normalizedLocation = typeof location === 'string' ? location.trim() : location;

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
    if (location !== undefined && typeof location !== 'string') {
      return Errors.validationError('"location" must be a string when provided.');
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

    // ENG-1564: hybrid knockout-gate + weighted signal scorer runs alongside
    // the readiness scorer. Knocked-out roles skip the Opus call entirely (cost + latency
    // win, on top of being the correct semantics — a role D can't take
    // regardless of fit quality shouldn't consume an Opus call to prove it
    // scores well).
    const roleFit = evaluateRoleFit(
      { title: normalizedTitle, jobDescription: scoringText, location: normalizedLocation as string | undefined },
      normalizedCompany
    );
    // Role fit decides whether D would take the role; readiness measures how
    // well the current resume matches it. They deliberately remain separate.
    const { readinessScore } = buildScoringInput(scoringText);
    const currentScore = buildScorePayload(readinessScore);

    if (roleFit.gateFailed.length > 0) {
      logApiAccess('api_score_job', authResult.apiKey, {
        company: normalizedCompany,
        title: normalizedTitle,
        url: normalizedUrl,
        inputType: resolvedInput.inputType,
        extractedUrl: resolvedInput.extractedUrl,
        emptyShell: resolvedInput.isEmptyShell === true,
        currentScore: currentScore.total,
        maxPossibleScore: 0,
        recommendation: 'knocked_out',
        knockoutReasons: roleFit.gateFailed,
      }, ip).catch((error) => {
        console.warn('[api/v1/score-job] Failed to log audit:', error);
      });

      return apiSuccess({
        company: normalizedCompany,
        title: normalizedTitle,
        url: normalizedUrl,
        roleFit: {
          total: roleFit.score,
          gateFailed: roleFit.gateFailed,
          gateEvidence: roleFit.gateEvidence,
          breakdown: roleFit.breakdown,
          locationUnknown: roleFit.locationUnknown,
        },
        currentScore,
        maxPossibleScore: 0,
        gapAnalysis: `Knocked out before scoring: ${roleFit.gateFailed.join(', ')}.`,
        recommendation: 'knocked_out',
        knockout: {
          knockedOut: true,
          hardReasons: roleFit.gateFailed,
          gateEvidence: roleFit.gateEvidence,
        },
        resumeGap: { achievable: null, closeable: null, structural: null },
        ...(resolvedInput.isEmptyShell ? { emptyShellFallback: true } : {}),
      });
    }

    const basePrompt = buildGapAnalysisPrompt(currentScore);
    const userContent = interviewPrepMode
      ? `${basePrompt}\n\nAdditionally, return exactly 5 "interviewPrepQuestions" in the JSON. Each must use behavioral framing — start with "Tell me about a time..." or "How would you approach...". Base questions on the top gap areas identified above.\n\nUpdated JSON schema: {"gapAnalysis":"...","maxPossibleScore":0-100,"recommendation":"...","interviewPrepQuestions":["Q1","Q2","Q3","Q4","Q5"]}\n\n<job_description>${xmlEscape(scoringText)}</job_description>`
      : `${basePrompt}\n\n<job_description>${xmlEscape(scoringText)}</job_description>`;

    const message = await scoringClient.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: interviewPrepMode ? 2000 : 1200,
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
          content: userContent,
        },
      ],
    });

    const responseText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(responseText);

    const gapAnalysis = typeof parsed.gapAnalysis === 'string' ? parsed.gapAnalysis : '';
    const _rawPrepQuestions = interviewPrepMode && Array.isArray(parsed.interviewPrepQuestions)
      ? (parsed.interviewPrepQuestions as unknown[])
          .filter((q): q is string => typeof q === 'string')
          .map((q) => q.trim())
          .filter((q) => q.length > 0)
          .slice(0, 5)
      : undefined;
    const interviewPrepQuestions = _rawPrepQuestions?.length === 5 ? _rawPrepQuestions : undefined;
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
      roleFit: {
        total: roleFit.score,
        gateFailed: roleFit.gateFailed,
        gateEvidence: roleFit.gateEvidence,
        breakdown: roleFit.breakdown,
        locationUnknown: roleFit.locationUnknown,
      },
      currentScore,
      maxPossibleScore,
      gapAnalysis,
      recommendation,
      // Not knocked out here (the gateFailed branch returns earlier).
      knockout: { knockedOut: false, hardReasons: [], gateEvidence: {} },
      resumeGap: { achievable: null, closeable: null, structural: null },
      ...(resolvedInput.isEmptyShell ? { emptyShellFallback: true } : {}),
      ...(interviewPrepQuestions ? { interviewPrepQuestions } : {}),
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message, { failure_mode: error.failureMode });
    }

    console.error('[api/v1/score-job] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
