import { list } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import { getMTDayBounds } from '@/lib/timezone';
import type { AuditEvent, TrafficSource } from '@/lib/types';

export const runtime = 'nodejs';

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

export async function GET(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      const startBounds = getMTDayBounds(startDateParam);
      const endBounds = getMTDayBounds(endDateParam);

      startDate = new Date(startBounds.startUTC);
      endDate = new Date(endBounds.endUTC);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return Errors.validationError('Invalid date format. Use YYYY-MM-DD format.');
      }

      if (endDate < startDate) {
        return Errors.validationError('End date must be after start date.');
      }
    } else {
      const rawDays = Number.parseInt(searchParams.get('days') ?? '30', 10);
      if (!Number.isFinite(rawDays)) {
        return Errors.validationError('Invalid days parameter');
      }
      const days = Math.min(365, Math.max(1, rawDays));
      endDate = new Date();
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (days - 1));
    }

    const pageViewEvents: AuditEvent[] = [];
    const MAX_BLOBS = 5000;
    let totalBlobsProcessed = 0;

    const datePrefixes: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      datePrefixes.push(`damilola.tech/audit/${environment}/${dateStr}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (const prefix of datePrefixes) {
      if (totalBlobsProcessed >= MAX_BLOBS) break;

      let cursor: string | undefined;
      do {
        const result = await list({ prefix, cursor, limit: 1000 });

        const pageViewBlobs = result.blobs.filter((blob) => {
          const filename = blob.pathname.split('/').pop() || '';
          return filename.includes('-page_view');
        });

        const batchSize = 50;
        const fetchTimeout = 10000;

        for (let i = 0; i < pageViewBlobs.length && totalBlobsProcessed < MAX_BLOBS; i += batchSize) {
          const batch = pageViewBlobs.slice(i, Math.min(i + batchSize, pageViewBlobs.length));
          const fetchResults = await Promise.allSettled(
            batch.map(async (blob) => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
              try {
                const response = await fetch(blob.url, { signal: controller.signal });
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
      } while (cursor && totalBlobsProcessed < MAX_BLOBS);
    }

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

      const trafficSource = event.metadata?.trafficSource as TrafficSource | undefined;
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
      landingPageCount.set(landingPage, (landingPageCount.get(landingPage) || 0) + 1);
    }

    rawEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalEvents = pageViewEvents.length;

    const bySource: TrafficBreakdown[] = Array.from(sourceCount.entries())
      .map(([source, count]) => ({
        source,
        medium: '',
        count,
        percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byMedium: TrafficBreakdown[] = Array.from(mediumCount.entries())
      .map(([medium, count]) => ({
        source: '',
        medium,
        count,
        percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byCampaign: CampaignBreakdown[] = Array.from(campaignCount.entries())
      .map(([campaign, count]) => ({
        campaign,
        count,
        percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topLandingPages: LandingPageBreakdown[] = Array.from(landingPageCount.entries())
      .map(([path, count]) => ({
        path,
        count,
        percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Log API access audit event
    logApiAccess('api_traffic_accessed', authResult.apiKey, {
      environment,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalSessions: sessionsSeen.size,
    }, ip).catch((err) => console.warn('[api/v1/traffic] Failed to log audit:', err));

    return apiSuccess({
      truncated: totalBlobsProcessed >= MAX_BLOBS,
      totalSessions: sessionsSeen.size,
      bySource,
      byMedium,
      byCampaign,
      topLandingPages,
      rawEvents,
      environment,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('[api/v1/traffic] Error getting traffic stats:', error);
    return Errors.internalError('Failed to get traffic stats');
  }
}
