import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import {
  JobDescriptionInputError,
  resolveJobDescriptionInput,
} from '@/lib/job-description-input';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 4 * 1024;

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

    const { url } = body as Record<string, unknown>;
    const normalizedUrl = typeof url === 'string' ? url.trim() : url;

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

    const resolvedInput = await resolveJobDescriptionInput(
      normalizedUrl,
      'Mozilla/5.0 (compatible; JobDescriptionBot/1.0)'
    );

    logApiAccess('api_extract_job_description', authResult.apiKey, {
      url: normalizedUrl,
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      emptyShell: resolvedInput.isEmptyShell === true,
      charCount: resolvedInput.text.length,
    }, ip).catch((error) => {
      console.warn('[api/v1/extract-job-description] Failed to log audit:', error);
    });

    return apiSuccess({
      content: resolvedInput.text,
      char_count: resolvedInput.text.length,
      source_url: normalizedUrl,
      ...(resolvedInput.isEmptyShell ? { failure_mode: 'empty_shell' } : {}),
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/extract-job-description] Error:', error);
    return Errors.internalError('Failed to extract job description.');
  }
}
