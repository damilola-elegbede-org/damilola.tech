import { list, del } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

// 90 days in milliseconds
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const CHATS_PREFIX = 'damilola.tech/chats/';
const FIT_ASSESSMENTS_PREFIX = 'damilola.tech/fit-assessments/';
const AUDIT_PREFIX = 'damilola.tech/audit/';

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

/**
 * Timing-safe token comparison to prevent timing attacks
 */
function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

interface CleanupResult {
  deleted: number;
  kept: number;
  skipped: number;
  errors: number;
}

/**
 * Clean up blobs with a given prefix older than the cutoff date
 */
async function cleanupPrefix(
  prefix: string,
  cutoffDate: number
): Promise<CleanupResult> {
  let deleted = 0;
  let kept = 0;
  let skipped = 0;
  let errors = 0;
  let cursor: string | undefined;
  const toDelete: string[] = [];

  do {
    const result = await list({ prefix, cursor });

    for (const blob of result.blobs) {
      const timestamp = parseTimestampFromPathname(blob.pathname);

      if (!timestamp) {
        console.warn(`Could not parse timestamp from: ${blob.pathname}`);
        skipped++;
        continue;
      }

      if (timestamp.getTime() < cutoffDate) {
        toDelete.push(blob.url);
      } else {
        kept++;
      }
    }

    cursor = result.cursor ?? undefined;
  } while (cursor);

  // Batch delete
  const BATCH_SIZE = 10;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => del(url)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted++;
      } else {
        console.error('Failed to delete blob:', result.reason);
        errors++;
      }
    }
  }

  return { deleted, kept, skipped, errors };
}

export async function GET(req: Request) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  // Fail fast if CRON_SECRET not configured
  if (!expectedToken) {
    console.error('[cron/cleanup-chats] CRON_SECRET not configured');
    return Response.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!verifyToken(token, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const cutoffDate = now - RETENTION_MS;

    // Clean all prefixes in parallel
    const [chatsResult, assessmentsResult, auditResult] = await Promise.all([
      cleanupPrefix(CHATS_PREFIX, cutoffDate),
      cleanupPrefix(FIT_ASSESSMENTS_PREFIX, cutoffDate),
      cleanupPrefix(AUDIT_PREFIX, cutoffDate),
    ]);

    return Response.json({
      success: true,
      chats: chatsResult,
      fitAssessments: assessmentsResult,
      audit: auditResult,
      totals: {
        deleted: chatsResult.deleted + assessmentsResult.deleted + auditResult.deleted,
        kept: chatsResult.kept + assessmentsResult.kept + auditResult.kept,
        skipped: chatsResult.skipped + assessmentsResult.skipped + auditResult.skipped,
        errors: chatsResult.errors + assessmentsResult.errors + auditResult.errors,
      },
    });
  } catch (error) {
    console.error('[cron/cleanup] Error during cleanup:', error);
    return Response.json({ error: 'Failed to run cleanup' }, { status: 500 });
  }
}
