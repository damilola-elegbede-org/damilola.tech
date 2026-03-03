import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import {
  calculateATSScore,
  resumeDataToText,
  type ATSScore,
  type ResumeData as ATSResumeData,
} from '@/lib/ats-scorer';
import { resumeData } from '@/lib/resume-data';
import { sanitizeBreakdown, sanitizeScoreValue } from '@/lib/score-utils';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';

export const runtime = 'nodejs';

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const MAX_BODY_SIZE = 50 * 1024;

function buildScorePayload(atsScore: ATSScore) {
  return {
    total: atsScore.total,
    coreTotal: atsScore.coreTotal,
    calibration: atsScore.calibration,
    breakdown: sanitizeBreakdown(atsScore.breakdown),
    matchedKeywords: atsScore.details.matchedKeywords,
    missingKeywords: atsScore.details.missingKeywords,
    matchRate: atsScore.details.matchRate,
    keywordDensity: atsScore.details.keywordDensity,
  };
}

function buildGapAnalysisPrompt(currentScore: ReturnType<typeof buildScorePayload>): string {
  return [
    'Analyze this ATS score against the job description and return JSON only.',
    '',
    `Current score: ${currentScore.total}/100`,
    `Breakdown: ${JSON.stringify(currentScore.breakdown)}`,
    `Matched keywords: ${currentScore.matchedKeywords.join(', ') || 'none'}`,
    `Missing keywords: ${currentScore.missingKeywords.join(', ') || 'none'}`,
    `Match rate: ${currentScore.matchRate}%`,
    `Keyword density: ${currentScore.keywordDensity}%`,
    '',
    'Return exactly this JSON schema:',
    '{"gapAnalysis":"2-3 short paragraphs","maxPossibleScore":0-100,"recommendation":"full_generation_recommended|marginal_improvement|strong_fit"}',
    '',
    'Recommendation logic:',
    '- full_generation_recommended when gap > 15 points',
    '- marginal_improvement when gap is 5-15 points',
    '- strong_fit when gap < 5 points',
  ].join('\n');
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  const textBlock = content.find((block) => block.type === 'text' && typeof block.text === 'string');
  return textBlock?.text ?? '';
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Invalid JSON response');
  }
}

function buildAtsInput(jobDescription: string) {
  const atsResumeData: ATSResumeData = {
    title: resumeData.title,
    yearsExperience: 15,
    teamSize: '13 engineers',
    skills: resumeData.skills.flatMap((s) => s.items),
    skillsByCategory: resumeData.skills,
    experiences: resumeData.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      highlights: e.highlights,
    })),
    education: resumeData.education?.map((e) => ({
      degree: e.degree,
      institution: e.institution,
    })) ?? [],
    openToRoles: resumeData.openToRoles,
  };

  const resumeText = resumeDataToText({
    ...atsResumeData,
    name: resumeData.name,
    summary: resumeData.brandingStatement,
  });

  const atsScore = calculateATSScore({
    jobDescription,
    resumeText,
    resumeData: atsResumeData,
  });

  return { atsScore };
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

    let body: { input?: unknown };
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    if (!body.input || typeof body.input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    const resolvedInput = await resolveJobDescriptionInput(
      body.input,
      'Mozilla/5.0 (compatible; ResumeScoreBot/1.0)'
    );

    const { atsScore } = buildAtsInput(resolvedInput.text);
    const currentScore = buildScorePayload(atsScore);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: 'You are an ATS resume optimization analyst. Be concise and accurate.',
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `${buildGapAnalysisPrompt(currentScore)}\n\n<job_description>${resolvedInput.text}</job_description>`,
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

    logApiAccess('api_score_resume', authResult.apiKey, {
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      currentScore: currentScore.total,
      maxPossibleScore,
      recommendation,
    }, ip).catch((error) => {
      console.warn('[api/v1/score-resume] Failed to log audit:', error);
    });

    return apiSuccess({
      currentScore,
      maxPossibleScore,
      gapAnalysis,
      recommendation,
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/score-resume] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
