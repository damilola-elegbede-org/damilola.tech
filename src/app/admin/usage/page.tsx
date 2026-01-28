'use client';

import { useEffect, useState } from 'react';

interface SessionData {
  sessionId: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  lastUpdatedAt: string;
}

interface UsageStats {
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
  sessions: SessionData[];
  environment: string;
}

const ITEMS_PER_PAGE = 20;

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateSessionId(sessionId: string): string {
  if (sessionId === 'anonymous') return sessionId;
  if (sessionId.endsWith('-anonymous')) return sessionId;
  if (sessionId.length <= 20) return sessionId;
  return `${sessionId.slice(0, 16)}...`;
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/usage');
        if (!res.ok) throw new Error('Failed to fetch usage stats');
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
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading usage statistics" aria-live="polite">
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

  const totalPages = Math.ceil((stats?.sessions.length || 0) / ITEMS_PER_PAGE);
  const paginatedSessions = stats?.sessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">API Usage</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Environment: {stats?.environment || 'unknown'}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-xs">
          <p className="font-medium text-[var(--color-text-muted)] mb-2">Claude Sonnet 4 Pricing</p>
          <div className="space-y-1 text-[var(--color-text-muted)]">
            <p>Input: <span className="text-[var(--color-text)]">$3.00</span>/M</p>
            <p>Output: <span className="text-[var(--color-text)]">$15.00</span>/M</p>
            <p>Cache write: <span className="text-[var(--color-text)]">$3.75</span>/M</p>
            <p>Cache read: <span className="text-[var(--color-text)]">$0.30</span>/M</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">API Calls</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
            {formatNumber(stats?.totalRequests || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {stats?.totalSessions || 0} sessions
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Tokens Used</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
            {formatNumber((stats?.totalInputTokens || 0) + (stats?.totalOutputTokens || 0))}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {formatNumber(stats?.totalInputTokens || 0)} in / {formatNumber(stats?.totalOutputTokens || 0)} out
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Cache Hit Rate</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-accent)]">
            {stats?.cacheHitRate || 0}%
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {formatNumber(stats?.totalCacheReadTokens || 0)} tokens cached
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Estimated Cost</p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
            {formatCurrency(stats?.totalCostUsd || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Claude Sonnet 4
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Cost Savings</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {formatCurrency(stats?.costSavingsUsd || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            From prompt caching
          </p>
        </div>
      </div>

      {/* Usage by endpoint */}
      {stats?.byEndpoint && Object.keys(stats.byEndpoint).length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            By Endpoint
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(stats.byEndpoint).map(([endpoint, data]) => (
              <div key={endpoint} className="rounded-lg bg-[var(--color-bg)] p-3">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {endpoint}
                </p>
                <div className="mt-2 flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{data.requestCount} calls</span>
                  <span>{formatNumber(data.inputTokens + data.outputTokens)} tokens</span>
                  <span>{formatCurrency(data.costUsd)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          Sessions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-2 text-left text-sm font-medium text-[var(--color-text-muted)]">
                  Session ID
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Requests
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Input Tokens
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Output Tokens
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Cache Hits
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Cost
                </th>
                <th className="pb-2 text-right text-sm font-medium text-[var(--color-text-muted)]">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedSessions.map((session) => (
                <tr key={session.sessionId} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 text-sm font-mono text-[var(--color-text)]" title={session.sessionId}>
                    {truncateSessionId(session.sessionId)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {session.requestCount}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatNumber(session.inputTokens)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatNumber(session.outputTokens)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatNumber(session.cacheReadTokens)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text)]">
                    {formatCurrency(session.costUsd)}
                  </td>
                  <td className="py-2 text-right text-sm text-[var(--color-text-muted)]">
                    {formatTimestamp(session.lastUpdatedAt)}
                  </td>
                </tr>
              ))}
              {paginatedSessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
                    No sessions available
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
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, stats?.sessions.length || 0)} of {stats?.sessions.length || 0} sessions
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
      </div>
    </div>
  );
}
