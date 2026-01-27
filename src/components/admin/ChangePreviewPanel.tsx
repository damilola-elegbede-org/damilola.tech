'use client';

import { useState } from 'react';
import type { ProposedChange, Gap, ReviewedChange } from '@/lib/types/resume-generation';

interface ChangePreviewPanelProps {
  changes: ProposedChange[];
  gaps: Gap[];
  reviewedChanges: Map<number, ReviewedChange>;
  onAcceptChange: (index: number, editedText?: string) => void;
  onRejectChange: (index: number, feedback?: string) => void;
  onRevertChange: (index: number) => void;
  onModifyChange?: (index: number, prompt: string) => Promise<void>;
}

type CardMode = 'view' | 'edit' | 'reject' | 'modify';

function ChangeCard({
  change,
  index,
  review,
  onAccept,
  onReject,
  onRevert,
  onModify,
}: {
  change: ProposedChange;
  index: number;
  review?: ReviewedChange;
  onAccept: (editedText?: string) => void;
  onReject: (feedback?: string) => void;
  onRevert: () => void;
  onModify?: (prompt: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mode, setMode] = useState<CardMode>('view');
  const [editText, setEditText] = useState(change.modified);
  const [feedback, setFeedback] = useState('');
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);

  const status = review?.status ?? 'pending';
  const isAccepted = status === 'accepted';
  const isRejected = status === 'rejected';
  const isPending = status === 'pending';
  const wasEdited = review?.editedText !== undefined;

  const handleEditClick = () => {
    setEditText(change.modified);
    setMode('edit');
  };

  const handleSaveEdit = () => {
    onAccept(editText);
    setMode('view');
  };

  const handleCancelEdit = () => {
    setEditText(change.modified);
    setMode('view');
  };

  const handleRejectClick = () => {
    setFeedback('');
    setMode('reject');
  };

  const handleConfirmReject = () => {
    onReject(feedback || undefined);
    setMode('view');
  };

  const handleCancelReject = () => {
    setFeedback('');
    setMode('view');
  };

  const handleModifyClick = () => {
    setModifyPrompt('');
    setModifyError(null);
    setMode('modify');
  };

  const handleSubmitModify = async () => {
    if (!onModify || !modifyPrompt.trim()) return;

    setIsModifying(true);
    setModifyError(null);

    try {
      await onModify(modifyPrompt);
      setMode('view');
      setModifyPrompt('');
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : 'Failed to modify change');
    } finally {
      setIsModifying(false);
    }
  };

  const handleCancelModify = () => {
    setModifyPrompt('');
    setModifyError(null);
    setMode('view');
  };

  return (
    <div
      data-testid={`change-card-${index}`}
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
        aria-label={`Toggle change details for ${change.section}`}
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
          {isAccepted && wasEdited && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
              Edited
            </span>
          )}
          {isRejected && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              Rejected
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
              Pending
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

            {/* Modified / Edit Mode */}
            {mode === 'edit' ? (
              <div>
                <label htmlFor={`edit-textarea-${index}`} className="mb-1 block text-xs font-medium text-blue-400">
                  Your Edit
                </label>
                <textarea
                  id={`edit-textarea-${index}`}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  aria-label="Edit proposed change text"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  rows={4}
                />
              </div>
            ) : (
              <div>
                <p className="mb-1 text-xs font-medium text-green-400">Proposed</p>
                <p className="rounded-md bg-green-500/5 p-3 text-sm text-[var(--color-text)]">
                  {wasEdited && isAccepted ? review?.editedText : change.modified}
                </p>
              </div>
            )}

            {/* Rejected feedback display */}
            {isRejected && review?.feedback && mode === 'view' && (
              <div>
                <p className="mb-1 text-xs font-medium text-red-400">Feedback</p>
                <p className="rounded-md bg-red-500/5 p-3 text-sm text-[var(--color-text-muted)]">
                  {review.feedback}
                </p>
              </div>
            )}

            {/* Reject feedback input */}
            {mode === 'reject' && (
              <div>
                <label htmlFor={`reject-feedback-${index}`} className="mb-1 block text-xs font-medium text-red-400">
                  Rejection Feedback
                </label>
                <input
                  id={`reject-feedback-${index}`}
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback for why you're rejecting this change..."
                  aria-label="Rejection feedback (optional)"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm text-[var(--color-text)] focus:border-red-500 focus:outline-none"
                />
              </div>
            )}

            {/* Reason (only in view mode for pending) */}
            {mode === 'view' && (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">Reason</p>
                <p className="text-sm text-[var(--color-text-muted)]">{change.reason}</p>
              </div>
            )}

            {/* Keywords Added (only in view mode for pending) */}
            {mode === 'view' && change.keywordsAdded.length > 0 && (
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
            {isPending && mode === 'view' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onAccept(undefined)}
                  className="flex-1 rounded-md bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                  Accept
                </button>
                <button
                  onClick={handleEditClick}
                  className="flex-1 rounded-md border border-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                >
                  Edit & Accept
                </button>
                {onModify && (
                  <button
                    onClick={handleModifyClick}
                    className="flex-1 rounded-md border border-purple-500 px-3 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/10"
                  >
                    Modify
                  </button>
                )}
                <button
                  onClick={handleRejectClick}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Reject
                </button>
              </div>
            )}

            {/* Edit mode actions */}
            {mode === 'edit' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-md bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                  Save & Accept
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Reject mode actions */}
            {mode === 'reject' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleConfirmReject}
                  className="flex-1 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={handleCancelReject}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Modify mode UI */}
            {mode === 'modify' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label htmlFor={`modify-textarea-${index}`} className="mb-1 block text-xs font-medium text-purple-400">
                    Modification Request
                  </label>
                  <textarea
                    id={`modify-textarea-${index}`}
                    value={modifyPrompt}
                    onChange={(e) => setModifyPrompt(e.target.value)}
                    placeholder="Describe how to modify this change (e.g., 'Make it more concise', 'Add more metrics', 'Use different keywords')..."
                    aria-label="Describe how to modify this change"
                    aria-describedby={modifyError ? `modify-error-${index}` : undefined}
                    aria-disabled={isModifying}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm text-[var(--color-text)] focus:border-purple-500 focus:outline-none"
                    rows={3}
                    disabled={isModifying}
                  />
                </div>
                {modifyError && (
                  <p id={`modify-error-${index}`} role="alert" aria-live="assertive" className="text-sm text-red-400">
                    {modifyError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitModify}
                    disabled={isModifying || !modifyPrompt.trim()}
                    className="flex-1 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isModifying ? 'Revising...' : 'Submit'}
                  </button>
                  <button
                    onClick={handleCancelModify}
                    disabled={isModifying}
                    className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Revert action for accepted/rejected */}
            {(isAccepted || isRejected) && mode === 'view' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onRevert}
                  className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Revert to Pending
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
  reviewedChanges,
  onAcceptChange,
  onRejectChange,
  onRevertChange,
  onModifyChange,
}: ChangePreviewPanelProps) {
  const pendingCount = changes.filter(
    (_, i) => !reviewedChanges.has(i) || reviewedChanges.get(i)?.status === 'pending'
  ).length;

  const reviewedCount = changes.filter(
    (_, i) => reviewedChanges.has(i) && reviewedChanges.get(i)?.status !== 'pending'
  ).length;

  const acceptAllPending = () => {
    changes.forEach((_, index) => {
      const review = reviewedChanges.get(index);
      if (!review || review.status === 'pending') {
        onAcceptChange(index, undefined);
      }
    });
  };

  const rejectAllPending = () => {
    changes.forEach((_, index) => {
      const review = reviewedChanges.get(index);
      if (!review || review.status === 'pending') {
        onRejectChange(index, undefined);
      }
    });
  };

  const revertAll = () => {
    changes.forEach((_, index) => {
      const review = reviewedChanges.get(index);
      if (review && review.status !== 'pending') {
        onRevertChange(index);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Changes Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            Proposed Changes ({changes.length})
          </h3>
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <>
                <button
                  onClick={acceptAllPending}
                  className="rounded-md bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
                >
                  Accept All Pending
                </button>
                <button
                  onClick={rejectAllPending}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
                >
                  Reject All Pending
                </button>
              </>
            )}
            {reviewedCount > 0 && (
              <button
                onClick={revertAll}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)]"
              >
                Revert All
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {changes.map((change, index) => (
            <ChangeCard
              key={index}
              change={change}
              index={index}
              review={reviewedChanges.get(index)}
              onAccept={(editedText) => onAcceptChange(index, editedText)}
              onReject={(feedback) => onRejectChange(index, feedback)}
              onRevert={() => onRevertChange(index)}
              onModify={onModifyChange ? (prompt) => onModifyChange(index, prompt) : undefined}
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
