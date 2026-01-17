'use client';

import { useState } from 'react';
import { resumeData } from '@/lib/resume-data';
import { ExperienceCard } from './experience-card';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

export function Experience() {
  const [showAll, setShowAll] = useState(false);
  const { ref, isVisible } = useScrollReveal();
  const displayedExperiences = showAll
    ? resumeData.experiences
    : resumeData.experiences.slice(0, 3);

  return (
    <section
      id="experience"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
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
        {resumeData.experiences.length > 3 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-6 w-full py-3 text-center text-[var(--color-accent)] transition-colors hover:underline"
          >
            Show {resumeData.experiences.length - 3} more position{resumeData.experiences.length - 3 > 1 ? 's' : ''}
          </button>
        )}

        {/* Collapse Button */}
        {showAll && resumeData.experiences.length > 3 && (
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
