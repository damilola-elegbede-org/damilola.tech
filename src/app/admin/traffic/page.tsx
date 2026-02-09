'use client';

import { useState, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { RefreshIndicator } from '@/components/admin/RefreshIndicator';
import { formatNumber } from '@/lib/format-number';
import { truncateSessionId } from '@/lib/session';
import { formatInMT } from '@/lib/timezone';
import { useAdminCacheWithFallback } from '@/hooks/use-admin-cache';
import { PRESET_TO_TRAFFIC_CACHE_KEY, type CacheKey } from '@/lib/admin-cache';

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

const COLORS = [
  '#0066FF', // accent blue
  '#00C49F', // teal
  '#FFBB28', // yellow
  '#FF8042', // orange
  '#8884D8', // purple
  '#82CA9D', // green
  '#FFC658', // gold
  '#FF6B6B', // red
  '#4ECDC4', // cyan
  '#95A5A6', // gray
];

type PresetType = '7d' | '30d' | '90d' | 'custom';

interface FilterState {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPage: string | null;
  hideTestTraffic: boolean;
}

interface AggregatedStats {
  totalSessions: number;
  bySource: TrafficBreakdown[];
  byMedium: TrafficBreakdown[];
  byCampaign: CampaignBreakdown[];
  topLandingPages: LandingPageBreakdown[];
}

// Utility function to aggregate events into stats
function aggregateEvents(events: RawEvent[]): AggregatedStats {
  const sourceCount = new Map<string, number>();
  const mediumCount = new Map<string, number>();
  const campaignCount = new Map<string, number>();
  const landingPageCount = new Map<string, number>();
  const sessionsSeen = new Set<string>();

  for (const event of events) {
    const source = event.source || 'direct';
    const medium = event.medium || 'none';
    const campaign = event.campaign;
    const landingPage = event.landingPage || '/';

    sessionsSeen.add(event.sessionId || 'unknown');
    sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
    mediumCount.set(medium, (mediumCount.get(medium) || 0) + 1);
    if (campaign) {
      campaignCount.set(campaign, (campaignCount.get(campaign) || 0) + 1);
    }
    landingPageCount.set(landingPage, (landingPageCount.get(landingPage) || 0) + 1);
  }

  const totalEvents = events.length;

  const bySource = Array.from(sourceCount.entries())
    .map(([source, count]) => ({
      source,
      medium: '', // Not used in aggregated view
      count,
      percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byMedium = Array.from(mediumCount.entries())
    .map(([medium, count]) => ({
      source: '', // Not used in aggregated view
      medium,
      count,
      percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byCampaign = Array.from(campaignCount.entries())
    .map(([campaign, count]) => ({
      campaign,
      count,
      percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topLandingPages = Array.from(landingPageCount.entries())
    .map(([path, count]) => ({
      path,
      count,
      percentage: totalEvents > 0 ? Number(((count / totalEvents) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSessions: sessionsSeen.size,
    bySource,
    byMedium,
    byCampaign,
    topLandingPages,
  };
}

function formatDateForInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getPresetDates(preset: '7d' | '30d' | '90d'): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  start.setDate(start.getDate() - daysMap[preset]);
  return {
    start: formatDateForInput(start),
    end: formatDateForInput(end),
  };
}

const ITEMS_PER_PAGE = 20;

export default function TrafficPage() {
  const [preset, setPreset] = useState<PresetType>('30d');
  const [startDate, setStartDate] = useState(() => getPresetDates('30d').start);
  const [endDate, setEndDate] = useState(() => getPresetDates('30d').end);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    source: null,
    medium: null,
    campaign: null,
    landingPage: null,
    hideTestTraffic: false,
  });

  // Determine cache key based on preset (null for custom ranges)
  const cacheKey = PRESET_TO_TRAFFIC_CACHE_KEY[preset] as CacheKey | null;

  // Fetcher function for traffic stats
  const fetchTrafficStats = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate });
    const res = await fetch(`/api/admin/traffic?${params}`);
    if (!res.ok) throw new Error('Failed to fetch traffic stats');
    return res.json();
  }, [startDate, endDate]);

  const { data: stats, error, isLoading, isValidating } = useAdminCacheWithFallback<TrafficStats>({
    cacheKey,
    fetcher: fetchTrafficStats,
    dateRange: { start: startDate, end: endDate },
  });

  // Apply filters to raw events
  const filteredRawEvents = useMemo(() => {
    let events = stats?.rawEvents || [];

    // Test traffic filter
    if (filters.hideTestTraffic) {
      events = events.filter((e) => {
        const source = e.source || 'direct';
        const medium = e.medium || 'none';
        return source !== 'test' && !medium.startsWith('e2e');
      });
    }

    // Dimension filters (AND logic)
    if (filters.source) {
      events = events.filter((e) => (e.source || 'direct') === filters.source);
    }
    if (filters.medium) {
      events = events.filter((e) => (e.medium || 'none') === filters.medium);
    }
    if (filters.campaign) {
      events = events.filter((e) => e.campaign === filters.campaign);
    }
    if (filters.landingPage) {
      events = events.filter((e) => (e.landingPage || '/') === filters.landingPage);
    }

    return events;
  }, [stats?.rawEvents, filters]);

  // Re-aggregate filtered events for updated stats
  const filteredStats = useMemo(() => {
    return aggregateEvents(filteredRawEvents);
  }, [filteredRawEvents]);

  // Filter event handlers
  const toggleFilter = (dimension: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [dimension]: prev[dimension] === value ? null : value,
    }));
    setCurrentPage(1);
  };

  const removeFilter = (dimension: keyof FilterState) => {
    setFilters((prev) => ({
      ...prev,
      [dimension]: dimension === 'hideTestTraffic' ? false : null,
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilters({
      source: null,
      medium: null,
      campaign: null,
      landingPage: null,
      hideTestTraffic: false,
    });
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filters.source ||
    filters.medium ||
    filters.campaign ||
    filters.landingPage ||
    filters.hideTestTraffic;

  const handlePresetClick = (newPreset: '7d' | '30d' | '90d') => {
    const dates = getPresetDates(newPreset);
    setPreset(newPreset);
    setStartDate(dates.start);
    setEndDate(dates.end);
    setCurrentPage(1); // Reset pagination when date range changes
  };

  const handleStartDateChange = (value: string) => {
    setPreset('custom');
    setStartDate(value);
    setCurrentPage(1); // Reset pagination when date range changes
  };

  const handleEndDateChange = (value: string) => {
    setPreset('custom');
    setEndDate(value);
    setCurrentPage(1); // Reset pagination when date range changes
  };

  const isValidDateRange = startDate <= endDate;

  if (isLoading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading traffic data" aria-live="polite" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        {error.message}
      </div>
    );
  }

  // Use UNFILTERED data for pie chart (it acts as a filter selector)
  const pieData = stats?.bySource.map((item) => ({
    name: item.source,
    value: item.count,
  })) || [];

  return (
    <div className="space-y-8" aria-busy={isLoading}>
      <RefreshIndicator isRefreshing={isValidating && !isLoading} />

      {/* Filter bar */}
      {stats && stats.rawEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          {/* Active filter chips */}
          {filters.source && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white">
              <span>source: {filters.source}</span>
              <button
                onClick={() => removeFilter('source')}
                className="hover:opacity-70"
                aria-label={`Remove filter: source equals ${filters.source}`}
              >
                ✕
              </button>
            </div>
          )}
          {filters.medium && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white">
              <span>medium: {filters.medium}</span>
              <button
                onClick={() => removeFilter('medium')}
                className="hover:opacity-70"
                aria-label={`Remove filter: medium equals ${filters.medium}`}
              >
                ✕
              </button>
            </div>
          )}
          {filters.campaign && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white">
              <span>campaign: {filters.campaign}</span>
              <button
                onClick={() => removeFilter('campaign')}
                className="hover:opacity-70"
                aria-label={`Remove filter: campaign equals ${filters.campaign}`}
              >
                ✕
              </button>
            </div>
          )}
          {filters.landingPage && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white">
              <span>page: {filters.landingPage}</span>
              <button
                onClick={() => removeFilter('landingPage')}
                className="hover:opacity-70"
                aria-label={`Remove filter: landing page equals ${filters.landingPage}`}
              >
                ✕
              </button>
            </div>
          )}

          {/* Clear all button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Clear all filters
            </button>
          )}

          {/* Test traffic toggle */}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hideTestTraffic}
              onChange={(e) => setFilters((prev) => ({ ...prev, hideTestTraffic: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Hide test traffic</span>
          </label>

          {/* Session count indicator */}
          <div className="text-sm text-[var(--color-text-muted)]">
            Showing {formatNumber(filteredStats.totalSessions)} of {formatNumber(stats.totalSessions)} sessions
          </div>
        </div>
      )}

      {/* Live region for screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {hasActiveFilters && `Showing ${filteredStats.totalSessions} of ${stats?.totalSessions || 0} sessions`}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Traffic Sources</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Environment: {stats?.environment || 'unknown'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Time range selector */}
          <span className="text-sm text-[var(--color-text-muted)]">Time:</span>
          <div className="flex gap-1" role="group" aria-label="Preset time ranges">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  preset === p
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] hover:bg-[var(--color-border)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="text-[var(--color-text-muted)]">|</span>
          <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm text-[var(--color-text-muted)]">
              From:
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              max={endDate}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-text)]"
            />
            <label htmlFor="endDate" className="text-sm text-[var(--color-text-muted)]">
              To:
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              min={startDate}
              max={formatDateForInput(new Date())}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-text)]"
            />
          </div>
          {!isValidDateRange && (
            <span className="text-sm text-red-400">End date must be after start date</span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Total Sessions</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {formatNumber(filteredStats.totalSessions)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Unique Sources</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {filteredStats.bySource.length}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Active Campaigns</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {filteredStats.byCampaign.length}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Date Range</p>
          <p className="mt-1 text-sm text-[var(--color-text)]">
            {stats?.dateRange.start ? new Date(stats.dateRange.start).toLocaleDateString() : '-'} to{' '}
            {stats?.dateRange.end ? new Date(stats.dateRange.end).toLocaleDateString() : '-'}
          </p>
        </div>
      </div>

      {/* Pie chart and source breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie chart */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Traffic by Source
          </h2>
          {pieData.length > 0 ? (
            <>
              <div className="h-80" role="img" aria-label="Pie chart showing traffic distribution - click to filter">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      onClick={(data) => {
                        const clickedSource = data.name;
                        toggleFilter('source', clickedSource);
                      }}
                      cursor="pointer"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={filters.source && filters.source !== entry.name ? 0.3 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'var(--color-text)' }}
                      itemStyle={{ color: 'var(--color-text)' }}
                    />
                    <Legend
                      wrapperStyle={{ color: 'var(--color-text-muted)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Accessible table alternative for screen readers */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  View chart data as table
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="py-2 text-left text-[var(--color-text-muted)]">Source</th>
                      <th className="py-2 text-right text-[var(--color-text-muted)]">Sessions</th>
                      <th className="py-2 text-right text-[var(--color-text-muted)]">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieData.map((item) => (
                      <tr key={item.name} className="border-b border-[var(--color-border)]">
                        <td className="py-2 text-[var(--color-text)]">{item.name}</td>
                        <td className="py-2 text-right text-[var(--color-text)]">{item.value}</td>
                        <td className="py-2 text-right text-[var(--color-text-muted)]">
                          {((item.value / pieData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <div className="flex h-80 items-center justify-center text-[var(--color-text-muted)]">
              No traffic data available
            </div>
          )}
        </div>

        {/* Source breakdown table */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Source Details
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                    Source
                  </th>
                  <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                    Sessions
                  </th>
                  <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.bySource.map((item, index) => (
                  <tr key={item.source} className="border-b border-[var(--color-border)]/50">
                    <td
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleFilter('source', item.source)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFilter('source', item.source);
                        }
                      }}
                      className={`cursor-pointer py-2 transition-colors hover:text-[var(--color-accent)] hover:underline ${
                        filters.source === item.source ? 'bg-[var(--color-border)] font-bold' : ''
                      }`}
                      aria-pressed={filters.source === item.source}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-[var(--color-text)]">{item.source}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-sm text-[var(--color-text)]">
                      {formatNumber(item.count)}
                    </td>
                    <td className="py-2 text-right text-sm text-[var(--color-text-muted)]">
                      {item.percentage}%
                    </td>
                  </tr>
                ))}
                {filteredStats.bySource.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Medium breakdown */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          Traffic by Medium
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredStats.byMedium.map((item) => (
            <div
              key={item.medium}
              role="button"
              tabIndex={0}
              onClick={() => toggleFilter('medium', item.medium)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFilter('medium', item.medium);
                }
              }}
              className={`cursor-pointer rounded-lg bg-[var(--color-bg)] p-3 transition-all hover:ring-2 hover:ring-[var(--color-accent)] ${
                filters.medium === item.medium ? 'ring-2 ring-[var(--color-accent)]' : ''
              }`}
              aria-pressed={filters.medium === item.medium}
            >
              <p className="text-sm text-[var(--color-text-muted)]">{item.medium || 'none'}</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">
                {formatNumber(item.count)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.percentage}%</p>
            </div>
          ))}
          {filteredStats.byMedium.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">No data available</p>
          )}
        </div>
      </div>

      {/* Campaigns */}
      {filteredStats.byCampaign.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Campaigns
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                    Campaign
                  </th>
                  <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                    Sessions
                  </th>
                  <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.byCampaign.map((item) => (
                  <tr key={item.campaign} className="border-b border-[var(--color-border)]/50">
                    <td
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleFilter('campaign', item.campaign)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFilter('campaign', item.campaign);
                        }
                      }}
                      className={`cursor-pointer py-2 text-sm text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)] hover:underline ${
                        filters.campaign === item.campaign ? 'bg-[var(--color-border)] font-bold' : ''
                      }`}
                      aria-pressed={filters.campaign === item.campaign}
                    >
                      {item.campaign}
                    </td>
                    <td className="py-2 text-right text-sm text-[var(--color-text)]">
                      {formatNumber(item.count)}
                    </td>
                    <td className="py-2 text-right text-sm text-[var(--color-text-muted)]">
                      {item.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top landing pages */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          Top Landing Pages
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                  Page
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Sessions
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.topLandingPages.map((item) => (
                <tr key={item.path} className="border-b border-[var(--color-border)]/50">
                  <td
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleFilter('landingPage', item.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFilter('landingPage', item.path);
                      }
                    }}
                    className={`cursor-pointer py-2 font-mono text-sm text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)] hover:underline ${
                      filters.landingPage === item.path ? 'bg-[var(--color-border)] font-bold' : ''
                    }`}
                    aria-pressed={filters.landingPage === item.path}
                  >
                    {item.path}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatNumber(item.count)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text-muted)]">
                    {item.percentage}%
                  </td>
                </tr>
              ))}
              {filteredStats.topLandingPages.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual page views table */}
      {(() => {
        const totalPages = Math.ceil(filteredRawEvents.length / ITEMS_PER_PAGE);
        const paginatedEvents = filteredRawEvents.slice(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE
        );

        return (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
              Individual Page Views
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Timestamp
                    </th>
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Session
                    </th>
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Source
                    </th>
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Medium
                    </th>
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Campaign
                    </th>
                    <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                      Landing Page
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((event, index) => (
                    <tr key={`${event.sessionId}-${event.timestamp}-${index}`} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 text-sm text-[var(--color-text-muted)]">
                        {formatInMT(new Date(event.timestamp))}
                      </td>
                      <td className="py-2 text-sm font-mono text-[var(--color-text)]" title={event.sessionId}>
                        {truncateSessionId(event.sessionId)}
                      </td>
                      <td className="py-2 text-sm text-[var(--color-text)]">
                        {event.source}
                      </td>
                      <td className="py-2 text-sm text-[var(--color-text)]">
                        {event.medium}
                      </td>
                      <td className="py-2 text-sm text-[var(--color-text-muted)]">
                        {event.campaign || '-'}
                      </td>
                      <td className="py-2 text-sm font-mono text-[var(--color-text)]">
                        {event.landingPage}
                      </td>
                    </tr>
                  ))}
                  {paginatedEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                          {hasActiveFilters
                            ? 'No page views match the selected filters.'
                            : 'No page views available.'}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearAllFilters}
                            className="text-sm text-[var(--color-accent)] hover:underline"
                          >
                            Clear all filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRawEvents.length)} of {filteredRawEvents.length} page views
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {filteredRawEvents.length > 0 && totalPages <= 1 && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                Showing {filteredRawEvents.length} page view{filteredRawEvents.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
