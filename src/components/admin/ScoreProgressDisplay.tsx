'use client';

import type { ScoreBreakdown } from '@/lib/types/resume-generation';

interface ScoreProgressDisplayProps {
  currentScore: number;
  projectedScore: number;
  currentBreakdown: ScoreBreakdown;
  projectedBreakdown: ScoreBreakdown;
  acceptedCount: number;
  totalChanges: number;
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

function getProgressBarColor(percentage: number): string {
  if (percentage >= 75) return 'bg-green-500';
  if (percentage >= 50) return 'bg-blue-500';
  if (percentage >= 25) return 'bg-yellow-500';
  return 'bg-red-500';
}

interface BreakdownBarProps {
  label: string;
  currentValue: number;
  projectedValue: number;
  maxValue: number;
  description: string;
}

function BreakdownBar({
  label,
  currentValue,
  projectedValue,
  maxValue,
  description,
}: BreakdownBarProps) {
  const currentPercentage = (currentValue / maxValue) * 100;
  const projectedPercentage = (projectedValue / maxValue) * 100;
  const hasImprovement = projectedValue > currentValue;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-muted)]" title={description}>
          {label}
        </span>
        <span className="text-[var(--color-text)]">
          {hasImprovement ? (
            <>
              <span className="text-[var(--color-text-muted)]">{currentValue}</span>
              <span className="mx-1 text-[var(--color-accent)]">&rarr;</span>
              <span>{projectedValue}</span>
            </>
          ) : (
            currentValue
          )}{' '}
          / {maxValue}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--color-bg-alt)]">
        {/* Current value bar */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${getProgressBarColor(currentPercentage)}`}
          style={{ width: `${currentPercentage}%` }}
        />
        {/* Projected improvement overlay */}
        {hasImprovement && (
          <div
            className="absolute inset-y-0 rounded-full bg-[var(--color-accent)] opacity-60 transition-all"
            style={{
              left: `${currentPercentage}%`,
              width: `${projectedPercentage - currentPercentage}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ScoreProgressDisplay({
  currentScore,
  projectedScore,
  currentBreakdown,
  projectedBreakdown,
  acceptedCount,
  totalChanges,
}: ScoreProgressDisplayProps) {
  const hasImprovement = projectedScore > currentScore;
  const cappedProjectedScore = Math.min(100, projectedScore);

  return (
    <>
      {/* Fixed header */}
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 shadow-lg backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Main score display */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">ATS Score</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${getScoreColor(currentScore)}`}>
                    {currentScore}
                  </span>
                  {hasImprovement && (
                    <>
                      <span className="mx-1 text-lg text-[var(--color-text-muted)]">&rarr;</span>
                      <span className={`text-3xl font-bold ${getScoreColor(cappedProjectedScore)}`}>
                        {cappedProjectedScore}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* Status badge */}
              <span className="rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-sm text-[var(--color-accent)]">
                accepting {acceptedCount} of {totalChanges} changes
              </span>
            </div>

            {/* Breakdown bars */}
            <div className="grid flex-1 gap-2 lg:max-w-xl">
              <BreakdownBar
                label="Keyword Relevance"
                currentValue={currentBreakdown.keywordRelevance}
                projectedValue={projectedBreakdown.keywordRelevance}
                maxValue={40}
                description="Matching JD keywords in resume (40 pts max)"
              />
              <BreakdownBar
                label="Skills Quality"
                currentValue={currentBreakdown.skillsQuality}
                projectedValue={projectedBreakdown.skillsQuality}
                maxValue={25}
                description="Skills section completeness and organization (25 pts max)"
              />
              <BreakdownBar
                label="Experience Alignment"
                currentValue={currentBreakdown.experienceAlignment}
                projectedValue={projectedBreakdown.experienceAlignment}
                maxValue={20}
                description="Years, scope, and title match (20 pts max)"
              />
              <BreakdownBar
                label="Format Parseability"
                currentValue={currentBreakdown.formatParseability}
                projectedValue={projectedBreakdown.formatParseability}
                maxValue={15}
                description="ATS-friendly format compliance (15 pts max)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from hiding behind fixed header */}
      <div className="h-[180px] lg:h-[140px]" />
    </>
  );
}
