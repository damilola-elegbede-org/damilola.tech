import { list } from '@vercel/blob';

export const runtime = 'nodejs';

interface Stats {
  chats: { total: number };
  fitAssessments: { total: number };
  audit: { total: number; byType: Record<string, number> };
  environment: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || 'production';

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

    const [chatCount, assessmentCount] = await Promise.all([
      countBlobs(`damilola.tech/chats/${environment}/`),
      countBlobs(`damilola.tech/fit-assessments/${environment}/`),
    ]);

    // For audit, also count by type (limited to recent events for performance)
    const auditResult = await list({
      prefix: `damilola.tech/audit/${environment}/`,
      limit: 1000,
    });

    const auditByType: Record<string, number> = {};
    for (const blob of auditResult.blobs) {
      const filename = blob.pathname.split('/').pop() || '';
      const match = filename.match(/-([a-z_]+)\.json/);
      const type = match?.[1] || 'unknown';
      auditByType[type] = (auditByType[type] || 0) + 1;
    }

    const stats: Stats = {
      chats: { total: chatCount },
      fitAssessments: { total: assessmentCount },
      audit: {
        total: auditResult.blobs.length,
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
