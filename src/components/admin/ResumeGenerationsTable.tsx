'use client';

import { useState } from 'react';
import type { ResumeGenerationSummary, ApplicationStatus } from '@/lib/types/resume-generation';

interface ResumeGenerationsTableProps {
  generations: ResumeGenerationSummary[];
  onRowClick: (generation: ResumeGenerationSummary) => void;
  onStatusChange: (generation: ResumeGenerationSummary, status: ApplicationStatus) => void;
  isLoading: boolean;
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  applied: 'bg-blue-500/20 text-blue-400',
  interview: 'bg-purple-500/20 text-purple-400',
  offer: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const STATUS_OPTIONS: ApplicationStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected'];

function StatusDropdown({
  value,
  onChange,
}: {
  value: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onChange(e.target.value as ApplicationStatus);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      aria-label="Application status"
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[value]} cursor-pointer border-none bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
    >
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status} className="bg-[var(--color-card)] text-[var(--color-text)]">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </option>
      ))}
    </select>
  );
}

function ScoreChange({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  const isPositive = diff > 0;

  return (
    <span className="font-mono text-sm">
      <span className="text-[var(--color-text-muted)]">{before}</span>
      <span className="mx-1 text-[var(--color-text-muted)]">&rarr;</span>
      <span className={isPositive ? 'text-green-400' : 'text-[var(--color-text)]'}>{after}</span>
      {diff !== 0 && (
        <span className={`ml-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          ({isPositive ? '+' : ''}{diff})
        </span>
      )}
    </span>
  );
}

export function ResumeGenerationsTable({
  generations,
  onRowClick,
  onStatusChange,
  isLoading,
}: ResumeGenerationsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (generation: ResumeGenerationSummary, status: ApplicationStatus) => {
    setUpdatingId(generation.id);
    try {
      await onStatusChange(generation, status);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-[var(--color-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-4 text-[var(--color-text-muted)]">No resume generations yet</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Generate your first ATS-optimized resume to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full">
        <thead className="bg-[var(--color-card)]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Date
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Company
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Role
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Score
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {generations.map((gen) => (
            <tr
              key={gen.id}
              onClick={() => onRowClick(gen)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(gen);
                }
              }}
              tabIndex={0}
              className="cursor-pointer bg-[var(--color-bg)] hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset"
            >
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                {new Date(gen.timestamp).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--color-text)]">{gen.companyName}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text)]">{gen.roleTitle}</td>
              <td className="px-4 py-3">
                <ScoreChange before={gen.scoreBefore} after={gen.scoreAfter} />
              </td>
              <td className="px-4 py-3">
                {updatingId === gen.id ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                ) : (
                  <StatusDropdown
                    value={gen.applicationStatus}
                    onChange={(status) => handleStatusChange(gen, status)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
