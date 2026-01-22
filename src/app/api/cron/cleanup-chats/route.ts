import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';

// 90 days in milliseconds
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const CHATS_PREFIX = 'damilola.tech/chats/';

/**
 * Parse timestamp from blob pathname
 * Expected format: damilola.tech/chats/{env}/{timestamp}-{uuid}.json
 * Timestamp format: 2025-01-22T14-30-00Z
 */
function parseTimestampFromPathname(pathname: string): Date | null {
  try {
    // Extract filename from pathname
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];

    // Extract timestamp portion (before the uuid)
    // Format: 2025-01-22T14-30-00Z-a1b2c3d4.json
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)/);
    if (!match) return null;

    // Convert dashes back to colons for ISO format
    const isoTimestamp = match[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3Z'
    );

    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return null;

    return date;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!authHeader || !authHeader.startsWith('Bearer ') || !expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (token !== expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const cutoffDate = now - RETENTION_MS;

    let deleted = 0;
    let kept = 0;
    let skipped = 0;
    let errors = 0;
    let cursor: string | undefined;

    // Paginate through all blobs in chats folder
    do {
      const result = await list({
        prefix: CHATS_PREFIX,
        cursor,
      });

      for (const blob of result.blobs) {
        const timestamp = parseTimestampFromPathname(blob.pathname);

        if (!timestamp) {
          console.warn(`Could not parse timestamp from: ${blob.pathname}`);
          skipped++;
          continue;
        }

        if (timestamp.getTime() < cutoffDate) {
          // Blob is older than retention period, delete it
          try {
            await del(blob.url);
            deleted++;
          } catch (error) {
            console.error(`Failed to delete blob: ${blob.pathname}`, error);
            errors++;
          }
        } else {
          kept++;
        }
      }

      cursor = result.cursor ?? undefined;
    } while (cursor);

    return Response.json({
      success: true,
      deleted,
      kept,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('[cron/cleanup-chats] Error during cleanup:', error);
    return Response.json({ error: 'Failed to run cleanup' }, { status: 500 });
  }
}
