interface PaginationProps {
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading?: boolean;
}

export function Pagination({ hasMore, onLoadMore, isLoading }: PaginationProps) {
  if (!hasMore) return null;

  return (
    <div className="mt-4 flex justify-center">
      <button
        onClick={onLoadMore}
        disabled={isLoading}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
      >
        {isLoading ? 'Loading...' : 'Load More'}
      </button>
    </div>
  );
}
