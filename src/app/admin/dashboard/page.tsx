'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/admin/StatsCard';
import { formatNumber } from '@/lib/format-number';

interface TrafficSourceSummary {
  source: string;
  count: number;
  percentage: number;
}

interface Stats {
  chats: { total: number };
  fitAssessments: { total: number };
  resumeGenerations: { total: number; byStatus: Record<string, number> };
  audit: { total: number; byType: Record<string, number> };
  traffic: { topSources: TrafficSourceSummary[] };
  environment: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const statsRes = await fetch('/api/admin/stats');

        if (!statsRes.ok) throw new Error('Failed to fetch stats');
        const data = await statsRes.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading statistics" aria-live="polite">
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Environment: {stats?.environment || 'unknown'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Chat Sessions"
          value={stats?.chats.total ?? 0}
          subtitle="Total archived conversations"
          icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
        <StatsCard
          title="Fit Assessments"
          value={stats?.fitAssessments.total ?? 0}
          subtitle="Role fit analyses"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
        <StatsCard
          title="Resume Generations"
          value={stats?.resumeGenerations.total ?? 0}
          subtitle="ATS-optimized resumes"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <StatsCard
          title="Audit Events"
          value={stats?.audit.total ?? 0}
          subtitle="Recent activity logs"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </div>

      {/* Resume generation status breakdown */}
      {stats?.resumeGenerations.byStatus && Object.keys(stats.resumeGenerations.byStatus).length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Applications by Status
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(stats.resumeGenerations.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-lg bg-[var(--color-bg)] p-3">
                <p className="text-sm capitalize text-[var(--color-text-muted)]">
                  {status}
                </p>
                <p className="text-xl font-semibold text-[var(--color-text)]">{formatNumber(count)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top traffic sources */}
      {stats?.traffic?.topSources && stats.traffic.topSources.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Top Traffic Sources
            </h2>
            <Link
              href="/admin/traffic"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.traffic.topSources.map((item) => (
              <div key={item.source} className="rounded-lg bg-[var(--color-bg)] p-3">
                <p className="text-sm capitalize text-[var(--color-text-muted)]">
                  {item.source}
                </p>
                <p className="text-xl font-semibold text-[var(--color-text)]">{formatNumber(item.count)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event breakdown */}
      {stats?.audit.byType && Object.keys(stats.audit.byType).length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Recent Events by Type
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats.audit.byType).map(([type, count]) => (
              <div key={type} className="rounded-lg bg-[var(--color-bg)] p-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {type.replace(/_/g, ' ')}
                </p>
                <p className="text-xl font-semibold text-[var(--color-text)]">{formatNumber(count)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
