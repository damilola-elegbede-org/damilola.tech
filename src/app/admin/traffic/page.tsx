'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatNumber } from '@/lib/format-number';
import { truncateSessionId } from '@/lib/session';
import { formatInMT } from '@/lib/timezone';

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

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
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
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetType>('30d');
  const [startDate, setStartDate] = useState(() => getPresetDates('30d').start);
  const [endDate, setEndDate] = useState(() => getPresetDates('30d').end);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchStats() {
      setError(null);
      setIsLoading(true);
      setCurrentPage(1); // Reset pagination when filters change
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
        });
        const res = await fetch(`/api/admin/traffic?${params}`);
        if (!res.ok) throw new Error('Failed to fetch traffic stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [startDate, endDate]);

  const handlePresetClick = (newPreset: '7d' | '30d' | '90d') => {
    const dates = getPresetDates(newPreset);
    setPreset(newPreset);
    setStartDate(dates.start);
    setEndDate(dates.end);
  };

  const handleStartDateChange = (value: string) => {
    setPreset('custom');
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    setPreset('custom');
    setEndDate(value);
  };

  const isValidDateRange = startDate <= endDate;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading traffic data" aria-live="polite" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        {error}
      </div>
    );
  }

  const pieData = stats?.bySource.map((item) => ({
    name: item.source,
    value: item.count,
  })) || [];

  return (
    <div className="space-y-8">
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
            {formatNumber(stats?.totalSessions || 0)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Unique Sources</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {stats?.bySource.length || 0}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Active Campaigns</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {stats?.byCampaign.length || 0}
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
            <div className="h-80" role="img" aria-label={`Pie chart showing traffic by source: ${pieData.map(d => `${d.name}: ${d.value} sessions`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart id="traffic-source-chart">
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                {stats?.bySource.map((item, index) => (
                  <tr key={item.source} className="border-b border-[var(--color-border)]/50">
                    <td className="py-2">
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
                {(!stats?.bySource || stats.bySource.length === 0) && (
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
          {stats?.byMedium.map((item) => (
            <div key={item.medium} className="rounded-lg bg-[var(--color-bg)] p-3">
              <p className="text-sm text-[var(--color-text-muted)]">{item.medium || 'none'}</p>
              <p className="text-xl font-semibold text-[var(--color-text)]">
                {formatNumber(item.count)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.percentage}%</p>
            </div>
          ))}
          {(!stats?.byMedium || stats.byMedium.length === 0) && (
            <p className="text-sm text-[var(--color-text-muted)]">No data available</p>
          )}
        </div>
      </div>

      {/* Campaigns */}
      {stats?.byCampaign && stats.byCampaign.length > 0 && (
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
                {stats.byCampaign.map((item) => (
                  <tr key={item.campaign} className="border-b border-[var(--color-border)]/50">
                    <td className="py-2 text-sm text-[var(--color-text)]">{item.campaign}</td>
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
              {stats?.topLandingPages.map((item) => (
                <tr key={item.path} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 text-sm font-mono text-[var(--color-text)]">{item.path}</td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatNumber(item.count)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text-muted)]">
                    {item.percentage}%
                  </td>
                </tr>
              ))}
              {(!stats?.topLandingPages || stats.topLandingPages.length === 0) && (
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
        const totalPages = Math.ceil((stats?.rawEvents.length || 0) / ITEMS_PER_PAGE);
        const paginatedEvents = stats?.rawEvents.slice(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE
        ) || [];

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
                      <td colSpan={6} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                        No page views available
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
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, stats?.rawEvents.length || 0)} of {stats?.rawEvents.length || 0} page views
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

            {stats?.rawEvents && stats.rawEvents.length > 0 && totalPages <= 1 && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                Showing {stats.rawEvents.length} page view{stats.rawEvents.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
