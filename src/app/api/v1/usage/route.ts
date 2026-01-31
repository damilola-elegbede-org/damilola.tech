import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { getAggregatedStats, listSessions } from '@/lib/usage-logger';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    return Errors.validationError('Invalid startDate format. Use YYYY-MM-DD.');
  }
  if (endDate && !dateRegex.test(endDate)) {
    return Errors.validationError('Invalid endDate format. Use YYYY-MM-DD.');
  }

  try {
    const dateOptions = { startDate, endDate };
    const [stats, allSessions] = await Promise.all([
      getAggregatedStats(dateOptions),
      listSessions({ limit: 500, ...dateOptions }),
    ]);
    const environment = process.env.VERCEL_ENV || 'development';

    const sessions = allSessions.map((s) => ({
      sessionId: s.sessionId,
      requestCount: s.totals.requestCount,
      inputTokens: s.totals.inputTokens,
      outputTokens: s.totals.outputTokens,
      cacheReadTokens: s.totals.cacheReadTokens,
      costUsd: s.totals.estimatedCostUsd,
      lastUpdatedAt: s.lastUpdatedAt,
    }));

    // Log API access audit event
    logApiAccess('api_usage_accessed', authResult.apiKey, {
      environment,
      dateRange: { start: startDate || null, end: endDate || null },
      sessionCount: sessions.length,
    }, ip).catch((err) => console.warn('[api/v1/usage] Failed to log audit:', err));

    return apiSuccess({
      ...stats,
      sessions,
      environment,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    });
  } catch (error) {
    console.error('[api/v1/usage] Error getting usage stats:', error);
    return Errors.internalError('Failed to get usage stats');
  }
}
