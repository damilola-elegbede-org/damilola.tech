import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { getAggregatedStats, listSessions } from '@/lib/usage-logger';

export const runtime = 'nodejs';

export async function GET() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [stats, allSessions] = await Promise.all([
      getAggregatedStats(),
      listSessions({ limit: 500 }),
    ]);
    const environment = process.env.VERCEL_ENV || 'development';

    // Transform sessions to include per-session details for the table
    const sessions = allSessions.map((s) => ({
      sessionId: s.sessionId,
      requestCount: s.totals.requestCount,
      inputTokens: s.totals.inputTokens,
      outputTokens: s.totals.outputTokens,
      cacheReadTokens: s.totals.cacheReadTokens,
      costUsd: s.totals.estimatedCostUsd,
      lastUpdatedAt: s.lastUpdatedAt,
    }));

    return Response.json({
      ...stats,
      sessions,
      environment,
    });
  } catch (error) {
    console.error('[admin/usage] Error getting usage stats:', error);
    return Response.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
