'use client';

import { useState } from 'react';
import type { Experience } from '@/types';
import { cn } from '@/lib/utils';

interface ExperienceCardProps {
  experience: Experience;
}

export function ExperienceCard({ experience }: ExperienceCardProps) {
  const [isAiContextOpen, setIsAiContextOpen] = useState(false);
  const [showAllHighlights, setShowAllHighlights] = useState(false);

  const displayedHighlights = showAllHighlights
    ? experience.highlights
    : experience.highlights.slice(0, 3);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-all duration-200 hover:border-[var(--color-accent)] hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-[var(--color-text)]">
          {experience.company}
        </h3>
        <p className="text-lg font-medium text-[var(--color-accent)]">
          {experience.title}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {experience.startDate} - {experience.endDate} • {experience.location}
        </p>
      </div>

      {/* Highlights */}
      <ul className="space-y-3">
        {displayedHighlights.map((highlight, i) => (
          <li key={`${experience.id}-highlight-${i}`} className="flex items-start text-[var(--color-text)]">
            <span className="mr-3 mt-0.5 flex-shrink-0 text-[var(--color-accent)]">›</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      {/* Show More/Less Button */}
      {experience.highlights.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAllHighlights(!showAllHighlights)}
          className="mt-4 text-sm text-[var(--color-accent)] transition-colors hover:underline"
        >
          {showAllHighlights
            ? '‹ Show less'
            : `Show ${experience.highlights.length - 3} more ›`}
        </button>
      )}

      {/* AI Context Toggle - only shown if aiContext data exists */}
      {experience.aiContext && (
        <>
          <button
            type="button"
            onClick={() => setIsAiContextOpen(!isAiContextOpen)}
            className="mt-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
            aria-expanded={isAiContextOpen}
            aria-controls={`ai-context-${experience.id}`}
          >
            <span className="text-[var(--color-accent)]">✨</span>
            <span>View AI Context</span>
            <svg
              className={cn(
                'h-4 w-4 transition-transform',
                isAiContextOpen && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* AI Context Content */}
          {isAiContextOpen && (
            <div
              id={`ai-context-${experience.id}`}
              className="mt-4 space-y-4 rounded-lg bg-[var(--color-bg-alt)] p-4 text-sm"
            >
              <div>
                <h4 className="font-semibold text-[var(--color-text)]">Strategic Context</h4>
                <p className="mt-1 text-[var(--color-text-muted)]">
                  {experience.aiContext.strategicContext}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[var(--color-text)]">Leadership Challenge</h4>
                <p className="mt-1 text-[var(--color-text-muted)]">
                  {experience.aiContext.leadershipChallenge}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[var(--color-text)]">Key Insight</h4>
                <p className="mt-1 italic text-[var(--color-text-muted)]">
                  {experience.aiContext.keyInsight}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
