/**
 * Build-time script to generate admin cache.
 *
 * This script:
 * 1. Computes stats for dashboard, usage (7d/30d/90d), traffic (7d/30d/90d)
 * 2. Uploads to Vercel Blob at damilola.tech/admin-cache/{env}/*.json
 * 3. Handles missing token gracefully (dev mode)
 *
 * Run: npm run generate-admin-cache
 * Or automatically via: npm run build (prebuild hook)
 *
 * Configuration via environment variables:
 * - FAIL_BUILD_ON_CACHE_ERROR: Set to "true" to fail build on cache errors (default: false)
 * - MAX_BLOBS_LIMIT: Maximum blobs to process (default: 5000)
 * - CONCURRENCY_LIMIT: Maximum concurrent blob fetches (default: 10)
 */

import { put, list } from '@vercel/blob';
import {
  CACHE_KEYS,
  getCacheBlobPath,
  type CacheKey,
} from '../src/lib/admin-cache';
import { getAggregatedStats, listSessions } from '../src/lib/usage-logger';
import { isValidChatFilename } from '../src/lib/chat-filename';
import type { AuditEvent, TrafficSource } from '../src/lib/types';

// Configuration from environment
const FAIL_BUILD_ON_CACHE_ERROR = process.env.FAIL_BUILD_ON_CACHE_ERROR === 'true';
const MAX_BLOBS_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.MAX_BLOBS_LIMIT || '5000', 10) || 5000
);
const CONCURRENCY_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.CONCURRENCY_LIMIT || '10', 10) || 10
);

interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface TrafficSourceSummary {
  source: string;
  count: number;
  percentage: number;
}

interface DashboardStats {
  chats: { total: number };
  fitAssessments: { total: number };
  resumeGenerations: { total: number; byStatus: Record<string, number> };
  audit: { total: number; byType: Record<string, number> };
  traffic: { topSources: TrafficSourceSummary[] };
  environment: string;
}

interface TrafficBreakdown {
  source: string;
  medium: string;
  count: number;
  percentage: number;
}

interface CampaignBreakdown {
  campaign: string;
  count: number;
  percentage: number;
}

interface LandingPageBreakdown {
  path: string;
  count: number;
  percentage: number;
}

interface RawEvent {
  timestamp: string;
  sessionId: string;
  source: string;
  medium: string;
  campaign: string | null;
  landingPage: string;
}

interface TrafficStats {
  totalSessions: number;
  bySource: TrafficBreakdown[];
  byMedium: TrafficBreakdown[];
  byCampaign: CampaignBreakdown[];
  topLandingPages: LandingPageBreakdown[];
  rawEvents: RawEvent[];
  environment: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// Helper to format date as YYYY-MM-DD
function formatDateForInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Get date range for a preset
function getPresetDates(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: formatDateForInput(start),
    end: formatDateForInput(end),
  };
}

// Write cache to blob
async function writeCacheToBlob<T>(
  key: CacheKey,
  data: T,
  dateRange?: { start: string; end: string },
  env?: string
): Promise<void> {
  const environment = env || process.env.VERCEL_ENV || 'production';
  const blobPath = getCacheBlobPath(key, environment);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  }

  const cacheEntry: CacheEntry<T> = {
    data,
    cachedAt: new Date().toISOString(),
    dateRange,
  };

  await put(blobPath, JSON.stringify(cacheEntry), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Count blobs with pagination
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

// Count valid chat blobs (filtering zero-byte and unparseable)
async function countValidChats(prefix: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor, limit: 1000 });
    for (const blob of result.blobs) {
      if (blob.size === 0) continue;
      const filename = blob.pathname.split('/').pop() || '';
      if (isValidChatFilename(filename)) {
        count++;
      }
    }
    cursor = result.cursor ?? undefined;
  } while (cursor);
  return count;
}

// Generate dashboard stats
async function generateDashboardStats(env: string): Promise<DashboardStats> {
  const [chatCount, assessmentCount, resumeGenCount, auditCount] =
    await Promise.all([
      countValidChats(`damilola.tech/chats/${env}/`),
      countBlobs(`damilola.tech/fit-assessments/${env}/`),
      countBlobs(`damilola.tech/resume-generations/${env}/`),
      countBlobs(`damilola.tech/audit/${env}/`),
    ]);

  // Get resume status breakdown (sample from recent 100)
  const resumeGenResult = await list({
    prefix: `damilola.tech/resume-generations/${env}/`,
    limit: 100,
  });

  const resumeByStatus: Record<string, number> = {};
  const FETCH_TIMEOUT = 5000; // 5 second timeout

  // Process in batches to control concurrency
  const statusResults: PromiseSettledResult<string>[] = [];
  for (let i = 0; i < resumeGenResult.blobs.length; i += CONCURRENCY_LIMIT) {
    const batch = resumeGenResult.blobs.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.allSettled(
      batch.map(async (blob) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        try {
          const response = await fetch(blob.url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          return data.applicationStatus || 'draft';
        } finally {
          clearTimeout(timeoutId);
        }
      })
    );
    statusResults.push(...batchResults);
  }

  for (const result of statusResults) {
    if (result.status === 'fulfilled') {
      const status = result.value;
      resumeByStatus[status] = (resumeByStatus[status] || 0) + 1;
    }
  }

  // Get audit breakdown
  const auditSampleResult = await list({
    prefix: `damilola.tech/audit/${env}/`,
    limit: 1000,
  });

  const auditByType: Record<string, number> = {};
  for (const blob of auditSampleResult.blobs) {
    const filename = blob.pathname.split('/').pop() || '';
    const match = filename.match(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{3})?Z-([a-z_]+)/
    );
    const type = match?.[1] || 'unknown';
    auditByType[type] = (auditByType[type] || 0) + 1;
  }

  // Get top traffic sources from page_view events
  const pageViewBlobs = auditSampleResult.blobs.filter((blob) => {
    const filename = blob.pathname.split('/').pop() || '';
    return filename.includes('-page_view');
  });

  const sourceCount = new Map<string, number>();
  let totalPageViews = 0;

  const pageViewFetchResults = await Promise.allSettled(
    pageViewBlobs.slice(0, 100).map(async (blob) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const response = await fetch(blob.url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as AuditEvent;
      } finally {
        clearTimeout(timeoutId);
      }
    })
  );

  for (const result of pageViewFetchResults) {
    if (result.status === 'fulfilled') {
      totalPageViews++;
      const event = result.value;
      const trafficSource = event.metadata?.trafficSource as
        | TrafficSource
        | undefined;
      const source = trafficSource?.source || 'direct';
      sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
    }
  }

  const topSources: TrafficSourceSummary[] = Array.from(sourceCount.entries())
    .map(([source, count]) => ({
      source,
      count,
      percentage:
        totalPageViews > 0 ? Math.round((count / totalPageViews) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
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
    traffic: {
      topSources,
    },
    environment: env,
  };
}

// Generate usage stats for a date range
async function generateUsageStats(
  startDate: string,
  endDate: string,
  env: string
) {
  const dateOptions = { startDate, endDate };
  const [stats, allSessions] = await Promise.all([
    getAggregatedStats(dateOptions),
    listSessions({ limit: 500, ...dateOptions }),
  ]);

  const sessions = allSessions.map((s) => ({
    sessionId: s.sessionId,
    requestCount: s.totals.requestCount,
    inputTokens: s.totals.inputTokens,
    outputTokens: s.totals.outputTokens,
    cacheReadTokens: s.totals.cacheReadTokens,
    costUsd: s.totals.estimatedCostUsd,
    lastUpdatedAt: s.lastUpdatedAt,
  }));

  return {
    ...stats,
    sessions,
    environment: env,
    dateRange: {
      start: startDate,
      end: endDate,
    },
  };
}

// Generate traffic stats for a date range
async function generateTrafficStats(
  startDate: string,
  endDate: string,
  env: string
): Promise<TrafficStats> {
  // Parse dates for blob filtering
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Set end to end of day
  end.setHours(23, 59, 59, 999);

  const pageViewEvents: AuditEvent[] = [];
  let totalBlobsProcessed = 0;

  // Generate date prefixes
  const datePrefixes: string[] = [];
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    datePrefixes.push(`damilola.tech/audit/${env}/${dateStr}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Process each date prefix
  let limitReached = false;
  for (const prefix of datePrefixes) {
    if (totalBlobsProcessed >= MAX_BLOBS_LIMIT) {
      limitReached = true;
      break;
    }

    let cursor: string | undefined;
    do {
      const result = await list({ prefix, cursor, limit: 1000 });

      const pageViewBlobs = result.blobs.filter((blob) => {
        const filename = blob.pathname.split('/').pop() || '';
        return filename.includes('-page_view');
      });

      const batchSize = 50;
      const fetchTimeout = 10000;

      for (
        let i = 0;
        i < pageViewBlobs.length && totalBlobsProcessed < MAX_BLOBS_LIMIT;
        i += batchSize
      ) {
        const batch = pageViewBlobs.slice(
          i,
          Math.min(i + batchSize, pageViewBlobs.length)
        );
        const fetchResults = await Promise.allSettled(
          batch.map(async (blob) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
            try {
              const response = await fetch(blob.url, {
                signal: controller.signal,
              });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return (await response.json()) as AuditEvent;
            } finally {
              clearTimeout(timeoutId);
            }
          })
        );

        for (const result of fetchResults) {
          if (result.status === 'fulfilled') {
            pageViewEvents.push(result.value);
          }
        }
        totalBlobsProcessed += batch.length;
      }

      cursor = result.cursor ?? undefined;
    } while (cursor && totalBlobsProcessed < MAX_BLOBS_LIMIT);
  }

  // Warn if limit was reached
  if (limitReached) {
    console.warn(
      `[generate-admin-cache] Reached MAX_BLOBS_LIMIT limit (${MAX_BLOBS_LIMIT}), traffic data may be incomplete for ${startDate} to ${endDate}`
    );
  }

  // Aggregate traffic data
  const sourceCount = new Map<string, number>();
  const mediumCount = new Map<string, number>();
  const campaignCount = new Map<string, number>();
  const landingPageCount = new Map<string, number>();
  const sessionsSeen = new Set<string>();
  const rawEvents: RawEvent[] = [];

  for (const event of pageViewEvents) {
    if (event.sessionId) {
      sessionsSeen.add(event.sessionId);
    }

    const trafficSource = event.metadata?.trafficSource as
      | TrafficSource
      | undefined;
    const source = trafficSource?.source || 'direct';
    const medium = trafficSource?.medium || 'none';
    const campaign = trafficSource?.campaign || null;
    const landingPage = trafficSource?.landingPage || event.path;

    rawEvents.push({
      timestamp: event.timestamp,
      sessionId: event.sessionId || 'unknown',
      source,
      medium,
      campaign,
      landingPage,
    });

    sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
    mediumCount.set(medium, (mediumCount.get(medium) || 0) + 1);
    if (campaign) {
      campaignCount.set(campaign, (campaignCount.get(campaign) || 0) + 1);
    }
    landingPageCount.set(
      landingPage,
      (landingPageCount.get(landingPage) || 0) + 1
    );
  }

  rawEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const totalEvents = pageViewEvents.length;

  const bySource: TrafficBreakdown[] = Array.from(sourceCount.entries())
    .map(([source, count]) => ({
      source,
      medium: '',
      count,
      percentage:
        totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byMedium: TrafficBreakdown[] = Array.from(mediumCount.entries())
    .map(([medium, count]) => ({
      source: '',
      medium,
      count,
      percentage:
        totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byCampaign: CampaignBreakdown[] = Array.from(campaignCount.entries())
    .map(([campaign, count]) => ({
      campaign,
      count,
      percentage:
        totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topLandingPages: LandingPageBreakdown[] = Array.from(
    landingPageCount.entries()
  )
    .map(([path, count]) => ({
      path,
      count,
      percentage:
        totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSessions: sessionsSeen.size,
    bySource,
    byMedium,
    byCampaign,
    topLandingPages,
    rawEvents,
    environment: env,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

async function generateAdminCache(): Promise<void> {
  console.log('=== Admin Cache Generation ===\n');

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.warn('   Blob token not configured - skipping cache generation');
    console.warn('   In production, ensure BLOB_READ_WRITE_TOKEN is set\n');
    console.log('=== Skipped ===\n');
    return;
  }

  const env = process.env.VERCEL_ENV || 'production';
  console.log(`Environment: ${env}\n`);

  // Generate all caches in parallel
  console.log('1. Generating caches in parallel...');

  const dates7d = getPresetDates(7);
  const dates30d = getPresetDates(30);
  const dates90d = getPresetDates(90);

  try {
    // Run all generations in parallel
    const [dashboard, usage7d, usage30d, usage90d, traffic7d, traffic30d, traffic90d] =
      await Promise.all([
        generateDashboardStats(env),
        generateUsageStats(dates7d.start, dates7d.end, env),
        generateUsageStats(dates30d.start, dates30d.end, env),
        generateUsageStats(dates90d.start, dates90d.end, env),
        generateTrafficStats(dates7d.start, dates7d.end, env),
        generateTrafficStats(dates30d.start, dates30d.end, env),
        generateTrafficStats(dates90d.start, dates90d.end, env),
      ]);

    console.log('   Generated dashboard stats');
    console.log('   Generated usage stats (7d, 30d, 90d)');
    console.log('   Generated traffic stats (7d, 30d, 90d)\n');

    // Write all caches to blob in parallel
    console.log('2. Writing caches to Vercel Blob...');

    await Promise.all([
      writeCacheToBlob(CACHE_KEYS.DASHBOARD, dashboard, undefined, env),
      writeCacheToBlob(CACHE_KEYS.USAGE_7D, usage7d, dates7d, env),
      writeCacheToBlob(CACHE_KEYS.USAGE_30D, usage30d, dates30d, env),
      writeCacheToBlob(CACHE_KEYS.USAGE_90D, usage90d, dates90d, env),
      writeCacheToBlob(CACHE_KEYS.TRAFFIC_7D, traffic7d, dates7d, env),
      writeCacheToBlob(CACHE_KEYS.TRAFFIC_30D, traffic30d, dates30d, env),
      writeCacheToBlob(CACHE_KEYS.TRAFFIC_90D, traffic90d, dates90d, env),
    ]);

    console.log('   Written dashboard.json');
    console.log('   Written usage-7d.json, usage-30d.json, usage-90d.json');
    console.log('   Written traffic-7d.json, traffic-30d.json, traffic-90d.json\n');

    console.log('=== Generation Complete ===\n');
  } catch (error) {
    console.error('\nError generating admin cache:', error);
    if (FAIL_BUILD_ON_CACHE_ERROR) {
      throw error;
    }
    console.log('\n=== Cache generation failed (non-fatal) ===\n');
  }
}

// Run the script
generateAdminCache()
  .then(() => {
    console.log('Admin cache generation finished!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('Fatal error:', error.message);
    if (FAIL_BUILD_ON_CACHE_ERROR) {
      console.error('Build failing due to FAIL_BUILD_ON_CACHE_ERROR=true');
      process.exit(1);
    }
    console.warn('Continuing build despite cache error (set FAIL_BUILD_ON_CACHE_ERROR=true to fail)');
    process.exit(0);
  });
