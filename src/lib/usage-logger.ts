import { put, list } from '@vercel/blob';

/**
 * API Usage Logger
 *
 * Tracks per-session API usage and costs in Vercel Blob.
 * Path: damilola.tech/usage/{env}/sessions/{sessionId}.json
 */

export interface UsageRequest {
  timestamp: string;
  endpoint: 'chat' | 'fit-assessment' | 'resume-generator';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  durationMs: number;
  costUsd: number;
}

export interface UsageSession {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  requests: UsageRequest[];
  totals: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    estimatedCostUsd: number;
  };
}

// Claude Sonnet 4 pricing (per million tokens)
const PRICING: Record<string, {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
}> = {
  'claude-sonnet-4-20250514': {
    inputPerMillion: 3.0,       // $3/M input tokens
    outputPerMillion: 15.0,     // $15/M output tokens
    cacheWritePerMillion: 3.75, // $3.75/M cache write
    cacheReadPerMillion: 0.3,   // $0.30/M cache read (90% discount)
  },
};

/**
 * Calculate the USD cost for a single API request.
 */
export function calculateCost(request: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
}): number {
  const pricing = PRICING[request.model];
  if (!pricing) {
    // Fallback to Claude Sonnet 4 pricing for unknown models
    const fallback = PRICING['claude-sonnet-4-20250514'];
    return calculateCostWithPricing(request, fallback);
  }
  return calculateCostWithPricing(request, pricing);
}

function calculateCostWithPricing(
  request: {
    inputTokens: number;
    outputTokens: number;
    cacheCreation: number;
    cacheRead: number;
  },
  pricing: typeof PRICING[string]
): number {
  // Input tokens that weren't read from cache
  const uncachedInput = request.inputTokens - request.cacheRead;

  const cost =
    (uncachedInput / 1_000_000) * pricing.inputPerMillion +
    (request.cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (request.cacheCreation / 1_000_000) * pricing.cacheWritePerMillion +
    (request.outputTokens / 1_000_000) * pricing.outputPerMillion;

  // Round to 6 decimal places for precision
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Calculate cost savings from cache hits vs full input pricing.
 */
export function calculateCostSavings(request: {
  model: string;
  cacheRead: number;
}): number {
  const pricing = PRICING[request.model] || PRICING['claude-sonnet-4-20250514'];
  const fullCost = (request.cacheRead / 1_000_000) * pricing.inputPerMillion;
  const cachedCost = (request.cacheRead / 1_000_000) * pricing.cacheReadPerMillion;
  return Math.round((fullCost - cachedCost) * 1_000_000) / 1_000_000;
}

/**
 * Get the blob path for a session.
 */
function getSessionPath(sessionId: string): string {
  const env = process.env.VERCEL_ENV || 'development';
  return `damilola.tech/usage/${env}/sessions/${sessionId}.json`;
}

/**
 * Fetch an existing session from blob storage.
 */
export async function getSession(sessionId: string): Promise<UsageSession | null> {
  try {
    const path = getSessionPath(sessionId);

    // List blobs with exact prefix to find the session
    const result = await list({ prefix: path, limit: 1 });

    if (result.blobs.length === 0) {
      return null;
    }

    const response = await fetch(result.blobs[0].url);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as UsageSession;
  } catch (error) {
    console.warn('[usage-logger] Failed to fetch session:', error);
    return null;
  }
}

/**
 * Log a usage request for a session.
 * Fetches existing session data, appends the new request, and overwrites.
 */
export async function logUsage(
  sessionId: string,
  request: Omit<UsageRequest, 'timestamp' | 'costUsd'>
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const costUsd = calculateCost(request);

    const usageRequest: UsageRequest = {
      ...request,
      timestamp,
      costUsd,
    };

    // Fetch existing session or create new one
    let session = await getSession(sessionId);

    if (session) {
      // Append to existing session
      session.requests.push(usageRequest);
      session.lastUpdatedAt = timestamp;
      session.totals = calculateTotals(session.requests);
    } else {
      // Create new session
      session = {
        sessionId,
        createdAt: timestamp,
        lastUpdatedAt: timestamp,
        requests: [usageRequest],
        totals: calculateTotals([usageRequest]),
      };
    }

    // Write back to blob (overwrite existing)
    const path = getSessionPath(sessionId);
    await put(path, JSON.stringify(session, null, 2), {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`[usage-logger] Logged usage for session ${sessionId.slice(0, 8)}:`, {
      endpoint: request.endpoint,
      tokens: request.inputTokens + request.outputTokens,
      cost: `$${costUsd.toFixed(6)}`,
    });
  } catch (error) {
    // Fire-and-forget: log errors but don't fail the request
    console.warn('[usage-logger] Failed to log usage:', error);
  }
}

/**
 * Calculate totals from a list of requests.
 */
function calculateTotals(requests: UsageRequest[]): UsageSession['totals'] {
  return requests.reduce(
    (acc, req) => ({
      requestCount: acc.requestCount + 1,
      inputTokens: acc.inputTokens + req.inputTokens,
      outputTokens: acc.outputTokens + req.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + req.cacheCreation,
      cacheReadTokens: acc.cacheReadTokens + req.cacheRead,
      estimatedCostUsd:
        Math.round((acc.estimatedCostUsd + req.costUsd) * 1_000_000) / 1_000_000,
    }),
    {
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      estimatedCostUsd: 0,
    }
  );
}

/**
 * List all sessions in the current environment.
 * Returns session summaries sorted by lastUpdatedAt (most recent first).
 */
export async function listSessions(options?: {
  limit?: number;
}): Promise<UsageSession[]> {
  const env = process.env.VERCEL_ENV || 'development';
  const prefix = `damilola.tech/usage/${env}/sessions/`;
  const limit = options?.limit ?? 100;

  const sessions: UsageSession[] = [];

  try {
    let cursor: string | undefined;

    do {
      const result = await list({ prefix, cursor, limit: 100 });

      // Fetch sessions in parallel (batch of 20)
      const batchSize = 20;
      for (let i = 0; i < result.blobs.length && sessions.length < limit; i += batchSize) {
        const batch = result.blobs.slice(i, Math.min(i + batchSize, result.blobs.length));
        const fetchResults = await Promise.allSettled(
          batch.map(async (blob) => {
            const response = await fetch(blob.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return (await response.json()) as UsageSession;
          })
        );

        for (const result of fetchResults) {
          if (result.status === 'fulfilled' && sessions.length < limit) {
            sessions.push(result.value);
          }
        }
      }

      cursor = result.cursor ?? undefined;
    } while (cursor && sessions.length < limit);

    // Sort by lastUpdatedAt (most recent first)
    sessions.sort(
      (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    );

    return sessions.slice(0, limit);
  } catch (error) {
    console.warn('[usage-logger] Failed to list sessions:', error);
    return [];
  }
}

/**
 * Get aggregated usage statistics across all sessions.
 */
export async function getAggregatedStats(): Promise<{
  totalSessions: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  costSavingsUsd: number;
  byEndpoint: Record<string, {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  recentSessions: Array<{
    sessionId: string;
    lastUpdatedAt: string;
    requestCount: number;
    costUsd: number;
  }>;
}> {
  const sessions = await listSessions({ limit: 500 });

  const byEndpoint: Record<string, {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }> = {};

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCostUsd = 0;

  for (const session of sessions) {
    totalRequests += session.totals.requestCount;
    totalInputTokens += session.totals.inputTokens;
    totalOutputTokens += session.totals.outputTokens;
    totalCacheCreationTokens += session.totals.cacheCreationTokens;
    totalCacheReadTokens += session.totals.cacheReadTokens;
    totalCostUsd += session.totals.estimatedCostUsd;

    // Aggregate by endpoint
    for (const req of session.requests) {
      if (!byEndpoint[req.endpoint]) {
        byEndpoint[req.endpoint] = {
          requestCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        };
      }
      byEndpoint[req.endpoint].requestCount += 1;
      byEndpoint[req.endpoint].inputTokens += req.inputTokens;
      byEndpoint[req.endpoint].outputTokens += req.outputTokens;
      byEndpoint[req.endpoint].costUsd += req.costUsd;
    }
  }

  // Round endpoint costs
  for (const endpoint of Object.keys(byEndpoint)) {
    byEndpoint[endpoint].costUsd =
      Math.round(byEndpoint[endpoint].costUsd * 1_000_000) / 1_000_000;
  }

  // Calculate cache hit rate: cached tokens / (cached + non-cached input tokens)
  const totalInputWithCache = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalInputWithCache > 0
      ? Math.round((totalCacheReadTokens / totalInputWithCache) * 1000) / 10
      : 0;

  // Calculate cost savings from caching
  const pricing = PRICING['claude-sonnet-4-20250514'];
  const fullCost = (totalCacheReadTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedCost = (totalCacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;
  const costSavingsUsd = Math.round((fullCost - cachedCost) * 1_000_000) / 1_000_000;

  // Get recent sessions (top 10)
  const recentSessions = sessions.slice(0, 10).map((s) => ({
    sessionId: s.sessionId,
    lastUpdatedAt: s.lastUpdatedAt,
    requestCount: s.totals.requestCount,
    costUsd: s.totals.estimatedCostUsd,
  }));

  return {
    totalSessions: sessions.length,
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    cacheHitRate,
    costSavingsUsd,
    byEndpoint,
    recentSessions,
  };
}
