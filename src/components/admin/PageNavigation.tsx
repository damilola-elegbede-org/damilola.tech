interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
  isLoading?: boolean;
}

export function PageNavigation({
  currentPage,
  totalPages,
  onNext,
  onPrev,
  isLoading,
}: PageNavigationProps) {
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  return (
    <div className="mt-4 flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev || isLoading}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Previous page"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <span className="min-w-[100px] text-center text-sm text-[var(--color-text)]">
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        ) : (
          `Page ${currentPage} of ${totalPages}`
        )}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext || isLoading}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Next page"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
