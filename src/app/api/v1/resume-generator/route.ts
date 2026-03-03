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
import { getResumeGeneratorPrompt } from '@/lib/resume-generator-prompt';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';

export const runtime = 'nodejs';
export const maxDuration = 120;

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const MAX_BODY_SIZE = 50 * 1024;
const AI_REQUEST_TIMEOUT_MS = 90_000;

function buildScoreContext(atsScore: ATSScore): string {
  const { breakdown, details } = atsScore;

  return `<pre_calculated_ats_score>
## IMPORTANT: Pre-Calculated ATS Score

The system has calculated a deterministic baseline ATS score for this job description.
Use this score as your "currentScore" in the response. DO NOT recalculate it.

### Current Score: ${atsScore.total}/100

### Breakdown:
- Keyword Relevance: ${breakdown.keywordRelevance}/45
- Skills Quality: ${breakdown.skillsQuality}/25
- Experience Alignment: ${breakdown.experienceAlignment}/20
- Match Quality: ${breakdown.contentQuality}/10

### Keyword Analysis:
- Match Rate: ${details.matchRate}%
- Keyword Density: ${details.keywordDensity}%
- Matched Keywords (${details.matchedKeywords.length}): ${details.matchedKeywords.slice(0, 15).join(', ')}${details.matchedKeywords.length > 15 ? '...' : ''}
- Missing Keywords (${details.missingKeywords.length}): ${details.missingKeywords.join(', ')}

### Your Task:
1. Use the currentScore values EXACTLY as provided above
2. Focus on incorporating MISSING KEYWORDS naturally
3. Propose changes that will increase the score toward 90+
4. Calculate optimizedScore based on your proposed changes
5. Each change should have an impactPoints estimate
</pre_calculated_ats_score>`;
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

function normalizeChanges(changes: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(changes)) {
    return [];
  }

  return changes
    .filter((change) => change && typeof change === 'object')
    .map((change) => {
      const value = change as Record<string, unknown>;
      return {
        section: typeof value.section === 'string' ? value.section : 'unknown',
        original: typeof value.original === 'string' ? value.original : '',
        modified: typeof value.modified === 'string' ? value.modified : '',
        reason: typeof value.reason === 'string' ? value.reason : '',
        keywordsAdded: Array.isArray(value.keywordsAdded)
          ? value.keywordsAdded.filter((keyword) => typeof keyword === 'string')
          : [],
        impactPoints: sanitizeScoreValue(value.impactPoints, 0, 100),
      };
    });
}

function extractGaps(gaps: unknown): string[] {
  if (!Array.isArray(gaps)) {
    return [];
  }

  return gaps
    .map((gap) => {
      if (typeof gap === 'string') {
        return gap;
      }
      if (gap && typeof gap === 'object' && typeof (gap as Record<string, unknown>).requirement === 'string') {
        return (gap as Record<string, unknown>).requirement as string;
      }
      return '';
    })
    .filter((gap) => gap.length > 0);
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

    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    if (!body.input || typeof body.input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    const resolvedInput = await resolveJobDescriptionInput(
      body.input,
      'Mozilla/5.0 (compatible; ResumeGeneratorBot/1.0)'
    );

    const systemPrompt = await getResumeGeneratorPrompt();
    const { atsScore } = buildAtsInput(resolvedInput.text);

    const message = await (async () => {
      try {
        return await client.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            temperature: 0,
            system: [
              {
                type: 'text',
                text: systemPrompt,
                cache_control: { type: 'ephemeral', ttl: '1h' },
              },
            ],
            messages: [
              {
                role: 'user',
                content: `${buildScoreContext(atsScore)}\n\nAnalyze this job description and provide ATS optimization recommendations for the resume. Return ONLY valid JSON, no markdown or code blocks.\n\n<job_description>${resolvedInput.text}</job_description>`,
              },
            ],
          },
          {
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
          }
        );
      } catch (error) {
        if (
          (error instanceof Error && error.name === 'TimeoutError') ||
          (error instanceof Error && /aborted|timeout/i.test(error.message))
        ) {
          return null;
        }
        throw error;
      }
    })();

    if (!message) {
      return Errors.internalError('Resume generation timed out');
    }

    const aiText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(aiText);

    const analysis = parsed.analysis && typeof parsed.analysis === 'object'
      ? parsed.analysis as Record<string, unknown>
      : {};

    const optimizedScoreInput = parsed.optimizedScore && typeof parsed.optimizedScore === 'object'
      ? parsed.optimizedScore as Record<string, unknown>
      : {};

    const optimizedBreakdownInput = optimizedScoreInput.breakdown && typeof optimizedScoreInput.breakdown === 'object'
      ? optimizedScoreInput.breakdown as Record<string, unknown>
      : {};

    const optimizedScore = {
      total: sanitizeScoreValue(optimizedScoreInput.total, atsScore.total, 100),
      breakdown: sanitizeBreakdown({
        keywordRelevance: sanitizeScoreValue(optimizedBreakdownInput.keywordRelevance, 0, 45),
        skillsQuality: sanitizeScoreValue(optimizedBreakdownInput.skillsQuality, 0, 25),
        experienceAlignment: sanitizeScoreValue(optimizedBreakdownInput.experienceAlignment, 0, 20),
        contentQuality: sanitizeScoreValue(optimizedBreakdownInput.contentQuality, 0, 10),
      }),
    };

    const maxFromResponse = sanitizeScoreValue(
      parsed.maxPossibleScore ?? (parsed.scoreCeiling as Record<string, unknown> | undefined)?.maximum,
      0,
      100
    );

    const maxPossibleScore = Math.max(
      atsScore.total,
      optimizedScore.total,
      maxFromResponse
    );

    const responseData = {
      generationId: crypto.randomUUID(),
      companyName: typeof analysis.companyName === 'string'
        ? analysis.companyName
        : (typeof parsed.companyName === 'string' ? parsed.companyName : 'Unknown'),
      roleTitle: typeof analysis.roleTitle === 'string'
        ? analysis.roleTitle
        : (typeof parsed.roleTitle === 'string' ? parsed.roleTitle : 'Unknown'),
      currentScore: {
        total: atsScore.total,
        coreTotal: atsScore.coreTotal,
        calibration: atsScore.calibration,
        breakdown: sanitizeBreakdown(atsScore.breakdown),
        matchedKeywords: atsScore.details.matchedKeywords,
        missingKeywords: atsScore.details.missingKeywords,
        matchRate: atsScore.details.matchRate,
        keywordDensity: atsScore.details.keywordDensity,
      },
      optimizedScore,
      maxPossibleScore,
      proposedChanges: normalizeChanges(parsed.proposedChanges),
      gapsIdentified: extractGaps(parsed.gaps),
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
    };

    try {
      await logApiAccess('api_resume_generation', authResult.apiKey, {
        inputType: resolvedInput.inputType,
        extractedUrl: resolvedInput.extractedUrl,
        currentScore: responseData.currentScore.total,
        optimizedScore: responseData.optimizedScore.total,
        proposedChanges: responseData.proposedChanges.length,
      }, ip);
    } catch (error) {
      console.warn('[api/v1/resume-generator] Failed to log audit:', error);
    }

    return apiSuccess(responseData);
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/resume-generator] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
