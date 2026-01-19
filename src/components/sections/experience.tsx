'use client';

import { useState, useEffect, useMemo } from 'react';
import { resumeData } from '@/lib/resume-data';
import { ExperienceCard } from './experience-card';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';
import type { AiContext, Experience as ExperienceType } from '@/types';

export function Experience() {
  const [showAll, setShowAll] = useState(false);
  const [aiContextMap, setAiContextMap] = useState<Record<string, AiContext>>({});
  const { ref, isVisible } = useScrollReveal();

  // Fetch AI context on mount
  useEffect(() => {
    fetch('/api/ai-context')
      .then((res) => res.json())
      .then((data) => setAiContextMap(data))
      .catch((error) => console.error('Failed to load AI context:', error));
  }, []);

  // Merge AI context with experiences
  const experiencesWithContext = useMemo<ExperienceType[]>(() => {
    return resumeData.experiences.map((exp) => ({
      ...exp,
      aiContext: aiContextMap[exp.id],
    }));
  }, [aiContextMap]);

  const displayedExperiences = showAll
    ? experiencesWithContext
    : experiencesWithContext.slice(0, 3);

  return (
    <section
      id="experience"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'bg-[var(--color-bg-alt)] px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Experience
        </h2>
        <div className="space-y-6">
          {displayedExperiences.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>

        {/* Expand Button */}
        {experiencesWithContext.length > 3 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-6 w-full py-3 text-center text-[var(--color-accent)] transition-colors hover:underline"
          >
            Show {experiencesWithContext.length - 3} more position{experiencesWithContext.length - 3 > 1 ? 's' : ''}
          </button>
        )}

        {/* Collapse Button */}
        {showAll && experiencesWithContext.length > 3 && (
          <button
            onClick={() => setShowAll(false)}
            className="mt-6 w-full py-3 text-center text-[var(--color-accent)] transition-colors hover:underline"
          >
            Show less
          </button>
        )}
      </div>
    </section>
  );
}
