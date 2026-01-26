'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ResumeGenerationsTable } from '@/components/admin/ResumeGenerationsTable';
import { Pagination } from '@/components/admin/Pagination';
import { trackEvent } from '@/lib/audit-client';
import type {
  ResumeGenerationSummary,
  ResumeGenerationLog,
  ApplicationStatus,
} from '@/lib/types/resume-generation';

// Allowed blob storage domain pattern for URL validation
const ALLOWED_BLOB_HOSTS = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
];

function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_BLOB_HOSTS.some(host => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

export default function ResumeGeneratorHistoryPage() {
  const [generations, setGenerations] = useState<ResumeGenerationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState<ResumeGenerationLog | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const fetchGenerations = async (append = false) => {
    try {
      setError(null);
      setIsLoading(true);
      const params = new URLSearchParams();
      if (cursor && append) params.set('cursor', cursor);

      const res = await fetch(`/api/admin/resume-generations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch generations');

      const data = await res.json();
      setGenerations(prev => append ? [...prev, ...data.generations] : data.generations);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClick = async (generation: ResumeGenerationSummary) => {
    // Validate URL before fetching (security)
    if (!isValidBlobUrl(generation.url)) {
      setError('Invalid generation URL');
      return;
    }

    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/resume-generations/${encodeURIComponent(generation.url)}`);
      if (!res.ok) throw new Error('Failed to fetch generation details');
      const data = await res.json();
      setSelectedGeneration(data);

      // Track viewing generation details
      trackEvent('admin_resume_generation_viewed', {
        metadata: {
          generationId: data.generationId,
          companyName: data.companyName,
          roleTitle: data.roleTitle,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleStatusChange = async (generation: ResumeGenerationSummary, status: ApplicationStatus) => {
    try {
      const res = await fetch(`/api/admin/resume-generations/${encodeURIComponent(generation.url)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationStatus: status }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Update local state
      setGenerations((prev) =>
        prev.map((g) => (g.id === generation.id ? { ...g, applicationStatus: status } : g))
      );

      // Update selected generation if viewing details
      if (selectedGeneration?.generationId === generation.generationId) {
        setSelectedGeneration({ ...selectedGeneration, applicationStatus: status });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedGeneration(null);
  }, []);

  // Handle escape key and focus trap for modal
  useEffect(() => {
    if (!selectedGeneration && !isDetailLoading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDetail();
      }
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus close button when modal opens
    closeButtonRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedGeneration, isDetailLoading, closeDetail]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Resume Generation History</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Track your ATS-optimized resume generations and application status
          </p>
        </div>
        <Link
          href="/admin/resume-generator"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
        >
          Generate New
        </Link>
      </div>

      {/* Table */}
      <ResumeGenerationsTable
        generations={generations}
        onRowClick={handleRowClick}
        onStatusChange={handleStatusChange}
        isLoading={isLoading && generations.length === 0}
      />

      {/* Pagination */}
      <Pagination hasMore={hasMore} onLoadMore={() => fetchGenerations(true)} isLoading={isLoading} />

      {/* Detail Modal */}
      {(selectedGeneration || isDetailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div
            ref={modalRef}
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {isDetailLoading ? (
              <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading generation details">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
              </div>
            ) : selectedGeneration ? (
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 id="modal-title" className="text-xl font-semibold text-[var(--color-text)]">
                      {selectedGeneration.companyName}
                    </h2>
                    <p className="text-[var(--color-text-muted)]">{selectedGeneration.roleTitle}</p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    onClick={closeDetail}
                    aria-label="Close details modal"
                    className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-card)]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Score Summary */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                    <p className="text-sm text-[var(--color-text-muted)]">Score Before</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                      {selectedGeneration.estimatedCompatibility.before}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                    <p className="text-sm text-[var(--color-text-muted)]">Score After</p>
                    <p className="mt-1 text-2xl font-bold text-green-400">
                      {selectedGeneration.estimatedCompatibility.after}
                      <span className="ml-2 text-sm text-green-400">
                        (+{selectedGeneration.estimatedCompatibility.after - selectedGeneration.estimatedCompatibility.before})
                      </span>
                    </p>
                  </div>
                </div>

                {/* Changes Summary */}
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">Changes Applied</h3>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span className="text-green-400">
                      {selectedGeneration.changesAccepted.length} accepted
                    </span>
                    <span className="text-red-400">
                      {selectedGeneration.changesRejected.length} rejected
                    </span>
                    <span className="text-yellow-400">
                      {selectedGeneration.gapsIdentified.length} gaps identified
                    </span>
                  </div>
                </div>

                {/* Gaps */}
                {selectedGeneration.gapsIdentified.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-[var(--color-text)]">Gaps Identified</h3>
                    <ul className="mt-2 space-y-2">
                      {selectedGeneration.gapsIdentified.map((gap, i) => (
                        <li key={i} className="text-sm text-[var(--color-text-muted)]">
                          <span className="font-medium">{gap.requirement}</span>
                          <span className="ml-2 text-xs text-[var(--color-text-muted)]">({gap.severity})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-4 border-t border-[var(--color-border)] pt-6">
                  {selectedGeneration.pdfUrl && (
                    <a
                      href={selectedGeneration.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackEvent('resume_generation_download', {
                          metadata: {
                            generationId: selectedGeneration.generationId,
                            companyName: selectedGeneration.companyName,
                            roleTitle: selectedGeneration.roleTitle,
                            source: 'history',
                          },
                        });
                      }}
                      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
                    >
                      Download PDF
                    </a>
                  )}
                  <button
                    onClick={closeDetail}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
                  >
                    Close
                  </button>
                </div>

                {/* Metadata */}
                <div className="mt-6 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-muted)]">
                  <p>Generated: {new Date(selectedGeneration.createdAt).toLocaleString()}</p>
                  <p>Generation ID: {selectedGeneration.generationId}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
