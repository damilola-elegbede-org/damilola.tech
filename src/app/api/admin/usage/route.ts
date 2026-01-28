import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { getAggregatedStats, listSessions } from '@/lib/usage-logger';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse date range parameters
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    return Response.json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' }, { status: 400 });
  }
  if (endDate && !dateRegex.test(endDate)) {
    return Response.json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const dateOptions = { startDate, endDate };
    const [stats, allSessions] = await Promise.all([
      getAggregatedStats(dateOptions),
      listSessions({ limit: 500, ...dateOptions }),
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
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    });
  } catch (error) {
    console.error('[admin/usage] Error getting usage stats:', error);
    return Response.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
