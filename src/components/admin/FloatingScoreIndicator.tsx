'use client';

interface FloatingScoreIndicatorProps {
  initialScore: number;
  currentScore: number;
  maximumScore: number;
  isVisible: boolean;
  onScrollToScores: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

export function FloatingScoreIndicator({
  initialScore,
  currentScore,
  maximumScore,
  isVisible,
  onScrollToScores,
}: FloatingScoreIndicatorProps) {
  if (!isVisible) return null;

  const hasImprovement = currentScore > initialScore;

  return (
    <button
      onClick={onScrollToScores}
      className="fixed bottom-6 right-6 z-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/95 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-[var(--color-accent)] hover:shadow-xl"
      aria-label="Scroll to score cards"
    >
      <p className="text-xs font-medium text-[var(--color-text-muted)]">ATS Score</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-lg font-bold ${getScoreColor(initialScore)}`}>
          {initialScore}
        </span>
        {hasImprovement && (
          <>
            <span className="text-sm text-[var(--color-text-muted)]">→</span>
            <span className={`text-lg font-bold ${getScoreColor(currentScore)}`}>
              {currentScore}
            </span>
          </>
        )}
        <span className="text-xs text-[var(--color-text-muted)]">
          (of {maximumScore})
        </span>
      </div>
    </button>
  );
}
