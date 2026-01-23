import { list } from '@vercel/blob';

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

export async function GET(req: Request) {
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

    const result = await list({ prefix, cursor, limit: limit * 2 }); // Fetch more to filter

    let events: AuditSummary[] = result.blobs.map((blob) => {
      // Extract from pathname: damilola.tech/audit/{env}/{date}/{timestamp}-{event-type}.json
      const parts = blob.pathname.split('/');
      const filename = parts.pop() || '';
      const eventDate = parts.pop() || '';
      const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-z_]+)/);

      return {
        id: blob.pathname,
        pathname: blob.pathname,
        eventType: match?.[2] || '',
        environment,
        date: eventDate,
        timestamp: match?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z') || '',
        size: blob.size,
        url: blob.url,
      };
    });

    // Filter by event type if specified
    if (eventType) {
      events = events.filter((e) => e.eventType === eventType);
    }

    // Limit results
    events = events.slice(0, limit);

    return Response.json({
      events,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('[admin/audit] Error listing events:', error);
    return Response.json({ error: 'Failed to list events' }, { status: 500 });
  }
}
