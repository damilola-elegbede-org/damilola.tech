'use client';

import { resumeData } from '@/lib/resume-data';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  title: string;
  items: string[];
  variant: 'expert' | 'proficient' | 'familiar';
}

function SkillCard({ title, items, variant }: SkillCardProps) {
  const variantStyles = {
    expert: {
      border: 'border-[var(--color-skill-expert)]',
      bg: 'bg-[var(--color-card-expert)]',
      hoverBorder: 'hover:border-[var(--color-skill-expert)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-skill-expert)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      titleColor: 'text-[var(--color-skill-expert)]',
    },
    proficient: {
      border: 'border-[var(--color-skill-proficient)]',
      bg: 'bg-[var(--color-card-proficient)]',
      hoverBorder: 'hover:border-[var(--color-skill-proficient)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(100,116,139,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-skill-proficient)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
        </svg>
      ),
      titleColor: 'text-[var(--color-skill-proficient)]',
    },
    familiar: {
      border: 'border-[var(--color-skill-familiar)]',
      bg: 'bg-[var(--color-card-familiar)]',
      hoverBorder: 'hover:border-[var(--color-skill-familiar)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(71,85,105,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-skill-familiar)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      ),
      titleColor: 'text-[var(--color-skill-familiar)]',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-6 transition-all duration-200',
        styles.border,
        styles.bg,
        styles.hoverBorder,
        styles.hoverShadow
      )}
    >
      <h3 className={`mb-4 text-lg font-semibold ${styles.titleColor}`}>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-[var(--color-text)]">
            {styles.icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkillsAssessment() {
  const { skillsAssessment } = resumeData;
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="skills-assessment"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Skills Assessment
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <SkillCard
            title="Expert"
            items={skillsAssessment.expert}
            variant="expert"
          />
          <SkillCard
            title="Proficient"
            items={skillsAssessment.proficient}
            variant="proficient"
          />
          <SkillCard
            title="Familiar"
            items={skillsAssessment.familiar}
            variant="familiar"
          />
        </div>
      </div>
    </section>
  );
}
