import { randomUUID } from 'crypto';
import { requireApiKey } from '@/lib/api-key-auth';
import { Errors } from '@/lib/api-response';
import { saveApplication, listApplicationIds, getApplications } from '@/lib/applications-store';
import { APPLICATION_STATUSES } from '@/lib/types/application';
import type { Application, ApplicationStatus } from '@/lib/types/application';

// stage always defaults to 'Applied' on creation — advancement via PATCH /[id]

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Errors.validationError('Request body must be a JSON object.');
  }

  const b = body as Record<string, unknown>;

  // Required fields
  const company = typeof b['company'] === 'string' ? b['company'].trim() : '';
  const title = typeof b['title'] === 'string' ? b['title'].trim() : '';

  if (!company) {
    return Errors.validationError('missing required field: company');
  }
  if (!title) {
    return Errors.validationError('missing required field: title');
  }

  // Optional fields
  const url = typeof b['url'] === 'string' ? b['url'].trim() : null;
  const role_id = typeof b['role_id'] === 'string' ? b['role_id'].trim() : null;
  const notes = typeof b['notes'] === 'string' ? b['notes'].trim() : null;
  const cover_letter_draft = typeof b['cover_letter_draft'] === 'string' ? b['cover_letter_draft'] : null;

  // status — default "applied", validate against enum
  const rawStatus = b['status'];
  const status: ApplicationStatus =
    rawStatus === undefined || rawStatus === null ? 'applied' : (rawStatus as ApplicationStatus);

  if (!APPLICATION_STATUSES.includes(status)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `invalid status value: '${String(rawStatus)}'`,
        },
      },
      { status: 422 }
    );
  }

  // score — optional 0–100
  let score: number | null = null;
  if (b['score'] !== undefined && b['score'] !== null) {
    if (typeof b['score'] !== 'number' || !Number.isFinite(b['score'])) {
      return Errors.validationError('score must be a number between 0 and 100.');
    }
    if (b['score'] < 0 || b['score'] > 100) {
      return Errors.validationError('score must be between 0 and 100.');
    }
    score = b['score'];
  }

  // applied_at — optional ISO-Z string, default now
  let applied_at: string;
  if (b['applied_at'] !== undefined && b['applied_at'] !== null) {
    if (typeof b['applied_at'] !== 'string') {
      return Errors.validationError('applied_at must be an ISO date string.');
    }
    const parsed = Date.parse(b['applied_at']);
    if (isNaN(parsed)) {
      return Errors.validationError('applied_at must be a valid ISO date string.');
    }
    applied_at = b['applied_at'];
  } else {
    applied_at = new Date().toISOString();
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const application: Application = {
    id,
    company,
    title,
    url,
    role_id,
    applied_at,
    status,
    stage: 'Applied',
    score,
    notes,
    cover_letter_draft,
    created_at: now,
    updated_at: now,
  };

  try {
    await saveApplication(application);
  } catch (err) {
    console.error('[api/v1/log-application] Failed to save application:', err);
    return Errors.internalError('Failed to save application.');
  }

  return Response.json(
    {
      success: true,
      data: {
        id,
        company,
        title,
        applied_at,
        status,
        score,
        url,
        cover_letter_draft,
      },
    },
    { status: 201 }
  );
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(req.url);

  // ?stage= is the pipeline-facing alias for ?status=
  const statusParam = searchParams.get('stage') ?? searchParams.get('status');
  if (statusParam !== null && !APPLICATION_STATUSES.includes(statusParam as ApplicationStatus)) {
    return Errors.validationError(`invalid status value: '${statusParam}'`);
  }
  const statusFilter = statusParam as ApplicationStatus | null;

  // ?since= — include only applications with applied_at >= since
  const sinceParam = searchParams.get('since');
  let sinceMs: number | null = null;
  if (sinceParam !== null) {
    sinceMs = Date.parse(sinceParam);
    if (isNaN(sinceMs)) {
      return Errors.validationError('since must be a valid ISO date string.');
    }
  }

  // ?limit=
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(1, rawLimit), MAX_LIMIT);

  try {
    const allIds = await listApplicationIds();
    const allApps = await getApplications(allIds);

    const filtered = allApps.filter((app: Application) => {
      if (statusFilter !== null && app.status !== statusFilter) return false;
      if (sinceMs !== null && Date.parse(app.applied_at) < sinceMs) return false;
      return true;
    });

    const page = filtered.slice(0, limit);

    return Response.json({
      success: true,
      data: {
        applications: page,
        total: filtered.length,
        limit,
      },
    });
  } catch (err) {
    console.error('[api/v1/log-application GET] Failed to list applications:', err);
    return Errors.internalError('Failed to list applications.');
  }
}
