'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

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

interface TrafficStats {
  totalSessions: number;
  bySource: TrafficBreakdown[];
  byMedium: TrafficBreakdown[];
  byCampaign: CampaignBreakdown[];
  topLandingPages: LandingPageBreakdown[];
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

export default function TrafficPage() {
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchStats() {
      setError(null); // Clear previous errors before new fetch
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/traffic?days=${days}`);
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
  }, [days]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Traffic Sources</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Environment: {stats?.environment || 'unknown'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="days" className="text-sm text-[var(--color-text-muted)]">
            Time range:
          </label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            aria-describedby="days-description"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text)]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <span id="days-description" className="sr-only">Select time range to filter traffic data</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Total Sessions</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text)]">
            {stats?.totalSessions.toLocaleString() || 0}
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
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={{ stroke: 'var(--color-text-muted)' }}
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
                      {item.count.toLocaleString()}
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
                {item.count.toLocaleString()}
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
                      {item.count.toLocaleString()}
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
                    {item.count.toLocaleString()}
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
    </div>
  );
}
