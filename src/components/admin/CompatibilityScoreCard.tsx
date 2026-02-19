'use client';

import type { ScoreBreakdown } from '@/lib/types/resume-generation';

interface CompatibilityScoreCardProps {
  title: string;
  score: number;
  breakdown: ScoreBreakdown;
  assessment: string;
  highlight?: boolean;
  targetScore?: number;
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Weak';
}

function ScoreBar({
  label,
  value,
  maxValue,
  description,
}: {
  label: string;
  value: number;
  maxValue: number;
  description: string;
}) {
  const percentage = ((value ?? 0) / maxValue) * 100;
  const barColor =
    percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-blue-500' : percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-muted)]" title={description}>
          {label}
        </span>
        <span className="text-[var(--color-text)]">
          {Math.round((value ?? 0) * 10) / 10}/{maxValue}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-alt)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function CompatibilityScoreCard({
  title,
  score,
  breakdown,
  assessment,
  highlight,
  targetScore,
}: CompatibilityScoreCardProps) {
  const showTarget = targetScore !== undefined && targetScore > score;
  return (
    <div className={`rounded-lg border bg-[var(--color-card)] p-6 ${highlight ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30' : 'border-[var(--color-border)]'}`}>
      <h3 className="text-sm font-medium text-[var(--color-text-muted)]">{title}</h3>

      <div className="mt-4 flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{Math.round(score * 10) / 10}</span>
        {showTarget && (
          <>
            <span className="text-2xl text-[var(--color-text-muted)]">→</span>
            <span className={`text-2xl font-medium ${getScoreColor(targetScore)}`}>{Math.round(targetScore * 10) / 10}</span>
          </>
        )}
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
            score >= 85
              ? 'bg-green-500/20 text-green-400'
              : score >= 70
                ? 'bg-blue-500/20 text-blue-400'
                : score >= 55
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
          }`}
        >
          {getScoreLabel(score)}
        </span>
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{assessment}</p>

      <div className="mt-6 space-y-3">
        <ScoreBar
          label="Keyword Relevance"
          value={breakdown.keywordRelevance}
          maxValue={45}
          description="Matching JD keywords in resume (45 pts max)"
        />
        <ScoreBar
          label="Skills Quality"
          value={breakdown.skillsQuality}
          maxValue={25}
          description="Skills section completeness and organization (25 pts max)"
        />
        <ScoreBar
          label="Experience Alignment"
          value={breakdown.experienceAlignment}
          maxValue={20}
          description="Years, scope, title, and education match (20 pts max)"
        />
        <ScoreBar
          label="Match Quality"
          value={breakdown.contentQuality}
          maxValue={10}
          description="Exact match ratio, keyword density, and section completeness (10 pts max)"
        />
      </div>
    </div>
  );
}
