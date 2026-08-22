import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { xmlEscape } from '@/lib/xml-escape';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';
import {
  scoreAts,
} from '@/lib/score-core';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 50 * 1024;

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

    const atsScore = await scoreAts(resolvedInput.text);

    logApiAccess('api_score_resume', authResult.apiKey, {
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      currentScore: atsScore.current.total,
      maxPossibleScore: atsScore.max.total,
    }, ip).catch((error) => {
      console.warn('[api/v1/score-resume] Failed to log audit:', error);
    });

    return apiSuccess({
      atsScore,
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/score-resume] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
