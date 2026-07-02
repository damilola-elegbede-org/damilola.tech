'use client';

import { useEffect, useState } from 'react';
import type { Application, ApplicationStatus } from '@/lib/types/application';

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: 'applied', label: 'Applied' },
  { status: 'screen', label: 'Screening' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
  { status: 'rejected', label: 'Rejected' },
];

function sortByScore(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 85
      ? 'bg-green-500/15 text-green-400'
      : score >= 70
      ? 'bg-yellow-500/15 text-yellow-400'
      : 'bg-red-500/15 text-red-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>{score}</span>
  );
}

function AppCard({ app }: { app: Application }) {
  const appliedDate = new Date(app.applied_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--color-text)]">{app.company}</p>
          <p className="truncate text-[var(--color-text-muted)]">{app.title}</p>
        </div>
        <ScoreChip score={app.score} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">{appliedDate}</span>
        {app.url && (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            JD ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/applications')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch applications');
        return res.json();
      })
      .then((data) => setApplications(data.data.applications ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'An error occurred'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        role="status"
        aria-label="Loading applications"
        aria-live="polite"
        aria-busy="true"
      >
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

  const byStatus = Object.fromEntries(
    COLUMNS.map(({ status }) => [
      status,
      sortByScore(applications.filter((a) => a.status === status)),
    ])
  );

  const total = applications.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Job Pipeline</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {total} application{total !== 1 ? 's' : ''} tracked
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map(({ status, label }) => {
          const cards = byStatus[status] ?? [];
          return (
            <div key={status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {label}
                </span>
                <span className="rounded-full bg-[var(--color-bg-alt)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  {cards.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {cards.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] opacity-50">—</p>
                ) : (
                  cards.map((app) => <AppCard key={app.id} app={app} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
