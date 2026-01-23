'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/admin/StatsCard';

interface Stats {
  chats: { total: number };
  fitAssessments: { total: number };
  audit: { total: number; byType: Record<string, number> };
  environment: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
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
      <div className="flex h-64 items-center justify-center">
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          title="Audit Events"
          value={stats?.audit.total ?? 0}
          subtitle="Recent activity logs"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </div>

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
                <p className="text-xl font-semibold text-[var(--color-text)]">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-4">
        <Link
          href="/admin/chats"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
        >
          View All Chats →
        </Link>
        <Link
          href="/admin/fit-assessments"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
        >
          View All Assessments →
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
        >
          View Audit Log →
        </Link>
      </div>
    </div>
  );
}
