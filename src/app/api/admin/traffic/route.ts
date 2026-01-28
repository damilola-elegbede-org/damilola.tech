import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
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

    // Parse date range parameters
    // Priority: explicit dates > days param > default 30 days
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      // Use explicit date range (interpret dates in Mountain Time)
      const startBounds = getMTDayBounds(startDateParam);
      const endBounds = getMTDayBounds(endDateParam);

      startDate = new Date(startBounds.startUTC);
      endDate = new Date(endBounds.endUTC);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return Response.json({ error: 'Invalid date format. Use YYYY-MM-DD format.' }, { status: 400 });
      }

      // Ensure end date is not before start date
      if (endDate < startDate) {
        return Response.json({ error: 'End date must be after start date.' }, { status: 400 });
      }
    } else {
      // Fall back to days parameter with validation
      const rawDays = Number.parseInt(searchParams.get('days') ?? '30', 10);
      if (!Number.isFinite(rawDays)) {
        return Response.json({ error: 'Invalid days parameter' }, { status: 400 });
      }
      const days = Math.min(365, Math.max(1, rawDays));
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Fetch page_view events from audit log
    // Use date-based prefixes to reduce search space
    const pageViewEvents: AuditEvent[] = [];
    const MAX_BLOBS = 5000; // Limit total blobs to prevent memory exhaustion
    let totalBlobsProcessed = 0;

    // Generate date prefixes for the date range to filter at list level
    const datePrefixes: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      datePrefixes.push(`damilola.tech/audit/${environment}/${dateStr}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process each date prefix to get better filtering
    for (const prefix of datePrefixes) {
      if (totalBlobsProcessed >= MAX_BLOBS) break;

      let cursor: string | undefined;
      do {
        const result = await list({ prefix, cursor, limit: 1000 });

        // Filter for page_view events
        const pageViewBlobs = result.blobs.filter((blob) => {
          const filename = blob.pathname.split('/').pop() || '';
          return filename.includes('-page_view');
        });

        // Fetch events in parallel with timeout (batch of 50)
        const batchSize = 50;
        const fetchTimeout = 10000; // 10 second timeout

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

    // Aggregate traffic data
    const sourceCount = new Map<string, number>();
    const mediumCount = new Map<string, number>();
    const campaignCount = new Map<string, number>();
    const landingPageCount = new Map<string, number>();
    const sessionsSeen = new Set<string>();
    const rawEvents: RawEvent[] = [];

    for (const event of pageViewEvents) {
      // Count unique sessions
      if (event.sessionId) {
        sessionsSeen.add(event.sessionId);
      }

      const trafficSource = event.metadata?.trafficSource as TrafficSource | undefined;

      // Extract source info (use 'direct' if no traffic source data)
      const source = trafficSource?.source || 'direct';
      const medium = trafficSource?.medium || 'none';
      const campaign = trafficSource?.campaign || null;
      const landingPage = trafficSource?.landingPage || event.path;

      // Collect raw event data
      rawEvents.push({
        timestamp: event.timestamp,
        sessionId: event.sessionId || 'unknown',
        source,
        medium,
        campaign,
        landingPage,
      });

      // Aggregate counts
      sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
      mediumCount.set(medium, (mediumCount.get(medium) || 0) + 1);
      if (campaign) {
        campaignCount.set(campaign, (campaignCount.get(campaign) || 0) + 1);
      }
      landingPageCount.set(landingPage, (landingPageCount.get(landingPage) || 0) + 1);
    }

    // Sort raw events by timestamp (most recent first)
    rawEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalEvents = pageViewEvents.length;

    // Convert to sorted arrays with percentages
    const bySource: TrafficBreakdown[] = Array.from(sourceCount.entries())
      .map(([source, count]) => ({
        source,
        medium: '', // Will be filled in combined view if needed
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
      .slice(0, 10); // Top 10 landing pages

    const stats: TrafficStats = {
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
    };

    return Response.json(stats);
  } catch (error) {
    console.error('[admin/traffic] Error getting traffic stats:', error);
    return Response.json({ error: 'Failed to get traffic stats' }, { status: 500 });
  }
}
