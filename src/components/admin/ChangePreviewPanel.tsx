'use client';

import { useState } from 'react';
import type { ProposedChange, Gap } from '@/lib/types/resume-generation';

interface ChangePreviewPanelProps {
  changes: ProposedChange[];
  gaps: Gap[];
  onAcceptChange: (index: number) => void;
  onRejectChange: (index: number) => void;
  acceptedIndices: Set<number>;
  rejectedIndices: Set<number>;
}

function ChangeCard({
  change,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
}: {
  change: ProposedChange;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={`rounded-lg border ${
        isAccepted
          ? 'border-green-500/50 bg-green-500/5'
          : isRejected
            ? 'border-red-500/50 bg-red-500/5 opacity-60'
            : 'border-[var(--color-border)] bg-[var(--color-card)]'
      } overflow-hidden`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[var(--color-accent)]/10 px-2 py-1 text-xs font-medium text-[var(--color-accent)]">
            {change.section}
          </span>
          <span className="text-sm text-[var(--color-text)]">
            +{change.impactPoints} pts
          </span>
          {isAccepted && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
              Accepted
            </span>
          )}
          {isRejected && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              Rejected
            </span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--color-border)] p-4">
          <div className="space-y-4">
            {/* Original */}
            <div>
              <p className="mb-1 text-xs font-medium text-red-400">Original</p>
              <p className="rounded-md bg-red-500/5 p-3 text-sm text-[var(--color-text-muted)] line-through">
                {change.original}
              </p>
            </div>

            {/* Modified */}
            <div>
              <p className="mb-1 text-xs font-medium text-green-400">Proposed</p>
              <p className="rounded-md bg-green-500/5 p-3 text-sm text-[var(--color-text)]">
                {change.modified}
              </p>
            </div>

            {/* Reason */}
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">Reason</p>
              <p className="text-sm text-[var(--color-text-muted)]">{change.reason}</p>
            </div>

            {/* Keywords Added */}
            {change.keywordsAdded.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">Keywords Added</p>
                <div className="flex flex-wrap gap-1">
                  {change.keywordsAdded.map((keyword, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs text-[var(--color-accent)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {!isAccepted && !isRejected && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onAccept}
                  className="flex-1 rounded-md bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                  Accept
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GapCard({ gap }: { gap: Gap }) {
  const severityColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    moderate: 'border-yellow-500/50 bg-yellow-500/5',
    minor: 'border-blue-500/50 bg-blue-500/5',
  };

  const severityBadge = {
    critical: 'bg-red-500/20 text-red-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    minor: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className={`rounded-lg border ${severityColors[gap.severity]} p-4`}>
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{gap.requirement}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityBadge[gap.severity]}`}
            >
              {gap.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{gap.mitigation}</p>
        </div>
      </div>
    </div>
  );
}

export function ChangePreviewPanel({
  changes,
  gaps,
  onAcceptChange,
  onRejectChange,
  acceptedIndices,
  rejectedIndices,
}: ChangePreviewPanelProps) {
  const acceptAll = () => {
    changes.forEach((_, index) => {
      if (!acceptedIndices.has(index) && !rejectedIndices.has(index)) {
        onAcceptChange(index);
      }
    });
  };

  const rejectAll = () => {
    changes.forEach((_, index) => {
      if (!acceptedIndices.has(index) && !rejectedIndices.has(index)) {
        onRejectChange(index);
      }
    });
  };

  const pendingCount = changes.filter(
    (_, i) => !acceptedIndices.has(i) && !rejectedIndices.has(i)
  ).length;

  return (
    <div className="space-y-6">
      {/* Changes Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            Proposed Changes ({changes.length})
          </h3>
          {pendingCount > 0 && (
            <div className="flex gap-2">
              <button
                onClick={acceptAll}
                className="rounded-md bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
              >
                Accept All
              </button>
              <button
                onClick={rejectAll}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
              >
                Reject All
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {changes.map((change, index) => (
            <ChangeCard
              key={index}
              change={change}
              isAccepted={acceptedIndices.has(index)}
              isRejected={rejectedIndices.has(index)}
              onAccept={() => onAcceptChange(index)}
              onReject={() => onRejectChange(index)}
            />
          ))}
        </div>
      </div>

      {/* Gaps Section */}
      {gaps.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            Gaps Identified ({gaps.length})
          </h3>
          <div className="space-y-3">
            {gaps.map((gap, index) => (
              <GapCard key={index} gap={gap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
