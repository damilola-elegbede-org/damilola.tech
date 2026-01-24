import { cookies } from 'next/headers';
import { list, ListBlobResult } from '@vercel/blob';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const AUDIT_PREFIX = 'damilola.tech/audit/';

interface AuditSummary {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  date: string;
  timestamp: string;
  size: number;
  url: string;
}

interface AuditSummaryWithSort extends AuditSummary {
  _sortKey: number; // UTC timestamp for sorting
}

function parseBlob(
  blob: { pathname: string; size: number; url: string },
  environment: string
): AuditSummaryWithSort {
  // Extract from pathname: damilola.tech/audit/{env}/{date}/{timestamp}-{event-type}.json
  const parts = blob.pathname.split('/');
  const filename = parts.pop() || '';
  const eventDate = parts.pop() || '';
  // Handle timestamps with or without milliseconds, and optional random suffix from Vercel Blob
  // Format: 2024-01-24T12-00-00.000Z-event_type.json or 2024-01-24T12-00-00.000Z-event_type-randomsuffix.json
  const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{3})?Z)-([a-z_]+)(?:-[a-zA-Z0-9]+)?\.json$/);

  // Convert UTC timestamp to Mountain Time for display
  let displayTimestamp = '';
  let displayDate = eventDate; // Fallback to UTC date from path
  let sortKey = 0;
  if (match?.[1]) {
    const utcTimestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
    const utcDate = new Date(utcTimestamp);
    sortKey = utcDate.getTime();

    // Get Mountain Time date (YYYY-MM-DD format)
    displayDate = utcDate.toLocaleDateString('en-CA', {
      timeZone: 'America/Denver',
    }); // en-CA gives YYYY-MM-DD format

    // Get Mountain Time timestamp (HH:MM:SS AM/PM format)
    displayTimestamp = utcDate.toLocaleTimeString('en-US', {
      timeZone: 'America/Denver',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  return {
    id: blob.pathname,
    pathname: blob.pathname,
    eventType: match?.[2] || '',
    environment,
    date: displayDate,
    timestamp: displayTimestamp,
    size: blob.size,
    url: blob.url,
    _sortKey: sortKey,
  };
}

export async function GET(req: Request) {
  const ip = getClientIp(req);

  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const eventType = searchParams.get('eventType');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Build prefix
    const basePrefix = `${AUDIT_PREFIX}${environment}/`;
    let prefix = basePrefix;
    if (date) {
      prefix += `${date}/`;
    }

    // Fetch ALL blobs with flat prefix (same approach as stats API)
    const allBlobs: ListBlobResult['blobs'] = [];
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix,
        cursor,
        limit: 1000,
      });
      allBlobs.push(...result.blobs);
      cursor = result.cursor ?? undefined;
    } while (cursor);

    // Parse all blobs to events
    let allEvents: AuditSummaryWithSort[] = allBlobs
      .map((blob) => parseBlob(blob, environment))
      .filter((e) => e.eventType); // Filter out invalid entries

    // Sort by timestamp descending (latest first)
    allEvents.sort((a, b) => b._sortKey - a._sortKey);

    // Apply event type filter if specified
    if (eventType) {
      allEvents = allEvents.filter((e) => e.eventType === eventType);
    }

    // Calculate pagination
    const totalCount = allEvents.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const offset = (page - 1) * limit;

    // Get page of events and remove sort key
    const events: AuditSummary[] = allEvents
      .slice(offset, offset + limit)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _sortKey, ...rest }) => rest);

    // Log audit access (non-blocking)
    logAdminEvent('admin_audit_accessed', { environment, date, eventType, page }, ip);

    return Response.json({
      events,
      totalCount,
      totalPages,
      page,
      hasMore: page < totalPages,
    });
  } catch (error) {
    console.error('[admin/audit] Error listing events:', error);
    return Response.json({ error: 'Failed to list events' }, { status: 500 });
  }
}
