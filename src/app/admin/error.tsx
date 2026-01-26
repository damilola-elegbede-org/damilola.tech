'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Only show detailed errors in development
  const displayMessage =
    process.env.NODE_ENV === 'development'
      ? error.message || 'An unexpected error occurred'
      : 'An unexpected error occurred';

  return (
    <div className="p-8 text-center" role="alert" aria-live="assertive">
      <h2 className="text-xl font-semibold text-red-400 mb-4">Something went wrong</h2>
      <p className="text-[var(--color-text-muted)] mb-6">{displayMessage}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)]"
      >
        Try again
      </button>
    </div>
  );
}
