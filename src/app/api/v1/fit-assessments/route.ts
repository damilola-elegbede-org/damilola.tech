import { list } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const ASSESSMENTS_PREFIX = 'damilola.tech/fit-assessments/';

interface AssessmentSummary {
  id: string;
  pathname: string;
  assessmentId: string;
  environment: string;
  timestamp: string;
  size: number;
}

export async function GET(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.max(1, Math.min(isNaN(limitParam) ? 50 : limitParam, 100));
    const cursor = searchParams.get('cursor') || undefined;

    const prefix = `${ASSESSMENTS_PREFIX}${environment}/`;
    const result = await list({ prefix, cursor, limit });

    const assessments: AssessmentSummary[] = result.blobs.map((blob) => {
      const filename = blob.pathname.split('/').pop() || '';
      const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]+)/);

      return {
        id: blob.pathname,
        pathname: blob.pathname,
        assessmentId: match?.[2] || '',
        environment,
        timestamp: match?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z') || '',
        size: blob.size,
      };
    });

    // Log API access audit event
    logApiAccess('api_fit_assessments_list', authResult.apiKey, {
      environment,
      resultCount: assessments.length,
      hasMore: result.hasMore,
    }, ip).catch((err) => console.warn('[api/v1/fit-assessments] Failed to log audit:', err));

    return apiSuccess(
      { assessments },
      {
        environment,
        pagination: {
          cursor: result.cursor || undefined,
          hasMore: result.hasMore,
        },
      }
    );
  } catch (error) {
    console.error('[api/v1/fit-assessments] Error listing assessments:', error);
    return Errors.internalError('Failed to list assessments');
  }
}
