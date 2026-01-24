import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
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
    const environment = searchParams.get('env') || 'production';
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const eventType = searchParams.get('eventType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    // Build prefix: damilola.tech/audit/{env}/ or damilola.tech/audit/{env}/{date}/
    let prefix = `${AUDIT_PREFIX}${environment}/`;
    if (date) {
      prefix += `${date}/`;
    }

    // When filtering by eventType, we need to fetch more to ensure we get enough results
    const fetchLimit = eventType ? limit * 3 : limit;
    const result = await list({ prefix, cursor, limit: fetchLimit });

    let eventsWithSort: AuditSummaryWithSort[] = result.blobs.map((blob) => {
      // Extract from pathname: damilola.tech/audit/{env}/{date}/{timestamp}-{event-type}.json
      const parts = blob.pathname.split('/');
      const filename = parts.pop() || '';
      const eventDate = parts.pop() || '';
      // Handle timestamps with or without milliseconds: 2024-01-24T12-00-00.000Z or 2024-01-24T12-00-00Z
      const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{3})?Z)-([a-z_]+)/);

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
    });

    // Filter by event type if specified
    if (eventType) {
      eventsWithSort = eventsWithSort.filter((e) => e.eventType === eventType);
    }

    // Sort by timestamp descending (latest first)
    eventsWithSort.sort((a, b) => b._sortKey - a._sortKey);

    // Check if we have more results than requested (for accurate hasMore)
    const hasMoreFiltered = eventsWithSort.length > limit;

    // Remove sort key before returning and apply limit
    const events: AuditSummary[] = eventsWithSort.slice(0, limit).map(({ _sortKey, ...rest }) => rest);

    // Log audit access (non-blocking)
    logAdminEvent('admin_audit_accessed', { environment, date, eventType }, ip);

    return Response.json({
      events,
      cursor: result.cursor,
      // hasMore is true if the underlying list has more OR if we filtered out items
      hasMore: result.hasMore || hasMoreFiltered,
    });
  } catch (error) {
    console.error('[admin/audit] Error listing events:', error);
    return Response.json({ error: 'Failed to list events' }, { status: 500 });
  }
}
