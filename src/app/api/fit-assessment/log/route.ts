import { put } from '@vercel/blob';
import type { FitAssessmentLog } from '@/lib/types/fit-assessment-log';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 50 * 1024; // 50KB

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LogRequest {
  assessmentId: string;
  inputType: 'text' | 'url';
  inputLength: number;
  extractedUrl?: string;
  jobDescriptionSnippet: string;
  completionLength: number;
  streamDurationMs: number;
  roleTitle?: string;
  downloadedPdf: boolean;
  downloadedMd: boolean;
  userAgent?: string;
}

function validateRequest(body: unknown): { valid: true; data: LogRequest } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Invalid request body' };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.assessmentId !== 'string' || !UUID_REGEX.test(req.assessmentId.toLowerCase())) {
    return { valid: false, error: 'assessmentId must be a valid UUID' };
  }

  if (req.inputType !== 'text' && req.inputType !== 'url') {
    return { valid: false, error: 'inputType must be "text" or "url"' };
  }

  if (typeof req.inputLength !== 'number' || req.inputLength < 0) {
    return { valid: false, error: 'inputLength must be a non-negative number' };
  }

  if (typeof req.jobDescriptionSnippet !== 'string') {
    return { valid: false, error: 'jobDescriptionSnippet is required' };
  }

  if (typeof req.completionLength !== 'number' || req.completionLength < 0) {
    return { valid: false, error: 'completionLength must be a non-negative number' };
  }

  if (typeof req.streamDurationMs !== 'number' || req.streamDurationMs < 0) {
    return { valid: false, error: 'streamDurationMs must be a non-negative number' };
  }

  if (typeof req.downloadedPdf !== 'boolean') {
    return { valid: false, error: 'downloadedPdf must be a boolean' };
  }

  if (typeof req.downloadedMd !== 'boolean') {
    return { valid: false, error: 'downloadedMd must be a boolean' };
  }

  return {
    valid: true,
    data: {
      assessmentId: req.assessmentId.toLowerCase(),
      inputType: req.inputType,
      inputLength: req.inputLength,
      extractedUrl: typeof req.extractedUrl === 'string' ? req.extractedUrl : undefined,
      jobDescriptionSnippet: req.jobDescriptionSnippet.slice(0, 200),
      completionLength: req.completionLength,
      streamDurationMs: req.streamDurationMs,
      roleTitle: typeof req.roleTitle === 'string' ? req.roleTitle : undefined,
      downloadedPdf: req.downloadedPdf,
      downloadedMd: req.downloadedMd,
      userAgent: typeof req.userAgent === 'string' ? req.userAgent : undefined,
    },
  };
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function getShortId(uuid: string): string {
  return uuid.split('-')[0];
}

export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const environment = process.env.VERCEL_ENV || 'development';
    const now = new Date();

    const log: FitAssessmentLog = {
      version: 1,
      assessmentId: data.assessmentId,
      environment,
      createdAt: now.toISOString(),
      inputType: data.inputType,
      inputLength: data.inputLength,
      extractedUrl: data.extractedUrl,
      jobDescriptionSnippet: data.jobDescriptionSnippet,
      completionLength: data.completionLength,
      streamDurationMs: data.streamDurationMs,
      roleTitle: data.roleTitle,
      downloadedPdf: data.downloadedPdf,
      downloadedMd: data.downloadedMd,
      userAgent: data.userAgent,
    };

    const timestamp = formatTimestamp(now);
    const shortId = getShortId(data.assessmentId);
    const pathname = `damilola.tech/fit-assessments/${environment}/${timestamp}-${shortId}.json`;

    await put(pathname, JSON.stringify(log), {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[fit-assessment/log] Error logging assessment:', error);
    return Response.json({ error: 'Failed to log assessment' }, { status: 500 });
  }
}
