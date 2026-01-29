'use client';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
}

export function RefreshIndicator({ isRefreshing }: RefreshIndicatorProps) {
  if (!isRefreshing) return null;

  return (
    <div
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text-muted)] shadow-lg">
        <div
          className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent"
          aria-hidden="true"
        />
        Refreshing...
      </div>
    </div>
  );
}
