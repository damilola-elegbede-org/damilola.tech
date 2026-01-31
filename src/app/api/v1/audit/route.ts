import { list, ListBlobResult } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const AUDIT_PREFIX = 'damilola.tech/audit/';

interface AuditSummary {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

interface AuditSummaryWithSort extends AuditSummary {
  _sortKey: number;
}

function parseBlob(
  blob: { pathname: string; size: number; url: string },
  environment: string
): AuditSummaryWithSort {
  const parts = blob.pathname.split('/');
  const filename = parts.pop() || '';
  const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{3})?Z)-([a-z_]+)(?:-[a-zA-Z0-9]+)?\.json$/);

  let isoTimestamp = '';
  let sortKey = 0;
  if (match?.[1]) {
    const utcTimestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
    const utcDate = new Date(utcTimestamp);
    sortKey = utcDate.getTime();
    isoTimestamp = utcDate.toISOString();
  }

  return {
    id: blob.pathname,
    pathname: blob.pathname,
    eventType: match?.[2] || '',
    environment,
    timestamp: isoTimestamp,
    size: blob.size,
    url: blob.url,
    _sortKey: sortKey,
  };
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
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'development';
    const date = searchParams.get('date');
    const eventType = searchParams.get('eventType');
    // Note: accessType filtering would require fetching each blob to check metadata
    // For performance, we skip this filter in the API version
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const basePrefix = `${AUDIT_PREFIX}${environment}/`;
    let prefix = basePrefix;
    if (date) {
      prefix += `${date}/`;
    }

    const allBlobs: ListBlobResult['blobs'] = [];
    let cursor: string | undefined;
    do {
      const result = await list({ prefix, cursor, limit: 1000 });
      allBlobs.push(...result.blobs);
      cursor = result.cursor ?? undefined;
    } while (cursor);

    let allEvents: AuditSummaryWithSort[] = allBlobs
      .map((blob) => parseBlob(blob, environment))
      .filter((e) => e.eventType);

    allEvents.sort((a, b) => b._sortKey - a._sortKey);

    if (eventType) {
      allEvents = allEvents.filter((e) => e.eventType === eventType);
    }

    const totalCount = allEvents.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const offset = (page - 1) * limit;

    const events: AuditSummary[] = allEvents
      .slice(offset, offset + limit)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _sortKey, ...rest }) => rest);

    // Log audit access with API context (await to ensure it completes)
    await logAdminEvent('admin_audit_accessed', { environment, date, eventType, page }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(
      { events },
      {
        environment,
        totalCount,
        totalPages,
        page,
        pagination: {
          hasMore: page < totalPages,
        },
      }
    );
  } catch (error) {
    console.error('[api/v1/audit] Error listing events:', error);
    return Errors.internalError('Failed to list events');
  }
}
