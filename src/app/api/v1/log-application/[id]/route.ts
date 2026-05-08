import { requireApiKey } from '@/lib/api-key-auth';
import { Errors } from '@/lib/api-response';
import { updateApplicationStage } from '@/lib/applications-store';
import { APPLICATION_STAGES } from '@/lib/types/application';
import type { ApplicationStage } from '@/lib/types/application';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) return authResult;

  const { id } = await params;

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
  const rawStage = b['stage'];

  if (rawStage === undefined || rawStage === null) {
    return Errors.validationError('missing required field: stage');
  }

  if (!APPLICATION_STAGES.includes(rawStage as ApplicationStage)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `invalid stage value: '${String(rawStage)}'`,
        },
      },
      { status: 422 }
    );
  }

  let updated: Awaited<ReturnType<typeof updateApplicationStage>>;
  try {
    updated = await updateApplicationStage(id, rawStage as ApplicationStage);
  } catch (err) {
    console.error('[PATCH /api/v1/log-application] updateApplicationStage failed:', err);
    return Errors.internalError('Failed to update application stage.');
  }

  if (!updated) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `application '${id}' not found`,
        },
      },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: updated });
}
