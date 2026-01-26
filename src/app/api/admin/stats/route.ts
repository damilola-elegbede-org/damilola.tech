import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

export const runtime = 'nodejs';

interface Stats {
  chats: { total: number };
  fitAssessments: { total: number };
  resumeGenerations: { total: number; byStatus: Record<string, number> };
  audit: { total: number; byType: Record<string, number> };
  environment: string;
}

export async function GET(req: Request) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';

    // Count blobs in each category (using pagination)
    async function countBlobs(prefix: string): Promise<number> {
      let count = 0;
      let cursor: string | undefined;
      do {
        const result = await list({ prefix, cursor, limit: 1000 });
        count += result.blobs.length;
        cursor = result.cursor ?? undefined;
      } while (cursor);
      return count;
    }

    // Count valid chats (filtering zero-byte and unparseable filenames like chats list API)
    async function countValidChats(prefix: string): Promise<number> {
      let count = 0;
      let cursor: string | undefined;
      // Regex patterns matching those in /api/admin/chats/route.ts
      const newFormatRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9-]{36})(?:-.+)?\.json$/i;
      const legacyFormatRegex =
        /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/;

      do {
        const result = await list({ prefix, cursor, limit: 1000 });
        for (const blob of result.blobs) {
          if (blob.size === 0) continue;
          const filename = blob.pathname.split('/').pop() || '';
          if (newFormatRegex.test(filename) || legacyFormatRegex.test(filename)) {
            count++;
          }
        }
        cursor = result.cursor ?? undefined;
      } while (cursor);
      return count;
    }

    const [chatCount, assessmentCount, resumeGenCount, auditCount] = await Promise.all([
      countValidChats(`damilola.tech/chats/${environment}/`),
      countBlobs(`damilola.tech/fit-assessments/${environment}/`),
      countBlobs(`damilola.tech/resume-generations/${environment}/`),
      countBlobs(`damilola.tech/audit/${environment}/`),
    ]);

    // For resume generations, also count by status (fetch in parallel for performance)
    // Note: This is a sampled count from the most recent 100 entries
    const resumeGenResult = await list({
      prefix: `damilola.tech/resume-generations/${environment}/`,
      limit: 100,
    });

    const resumeByStatus: Record<string, number> = {};
    const statusResults = await Promise.allSettled(
      resumeGenResult.blobs.map(async (blob) => {
        const response = await fetch(blob.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.applicationStatus || 'draft';
      })
    );

    for (const result of statusResults) {
      if (result.status === 'fulfilled') {
        const status = result.value;
        resumeByStatus[status] = (resumeByStatus[status] || 0) + 1;
      }
    }

    // For audit byType breakdown, fetch recent events only (performance)
    // The total count above is paginated; byType is a sample of recent events
    const auditSampleResult = await list({
      prefix: `damilola.tech/audit/${environment}/`,
      limit: 1000,
    });

    const auditByType: Record<string, number> = {};
    for (const blob of auditSampleResult.blobs) {
      const filename = blob.pathname.split('/').pop() || '';
      // Match: {timestamp}-{event_type}.json or {timestamp}-{event_type}-{suffix}.json
      const match = filename.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{3})?Z-([a-z_]+)/);
      const type = match?.[1] || 'unknown';
      auditByType[type] = (auditByType[type] || 0) + 1;
    }

    const stats: Stats = {
      chats: { total: chatCount },
      fitAssessments: { total: assessmentCount },
      resumeGenerations: {
        total: resumeGenCount,
        byStatus: resumeByStatus,
      },
      audit: {
        total: auditCount,
        byType: auditByType,
      },
      environment,
    };

    return Response.json(stats);
  } catch (error) {
    console.error('[admin/stats] Error getting stats:', error);
    return Response.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
