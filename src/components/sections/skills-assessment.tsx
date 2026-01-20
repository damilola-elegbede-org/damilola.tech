'use client';

import { resumeData } from '@/lib/resume-data';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  title: string;
  items: string[];
  variant: 'expert' | 'proficient' | 'familiar';
}

const proficiencyLabels = {
  expert: 'Expert',
  proficient: 'Proficient',
  familiar: 'Familiar',
};

function SkillCard({ title, items, variant }: SkillCardProps) {
  const variantStyles = {
    expert: {
      border: 'border-[var(--color-skill-expert)]',
      bg: 'bg-[var(--color-card-expert)]',
      hoverBorder: 'hover:border-[var(--color-skill-expert)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]',
      titleColor: 'text-[var(--color-skill-expert)]',
      pillBorder: 'border-blue-400/50',
      pillBg: 'bg-blue-500/10',
      pillText: 'text-blue-300',
    },
    proficient: {
      border: 'border-[var(--color-skill-proficient)]',
      bg: 'bg-[var(--color-card-proficient)]',
      hoverBorder: 'hover:border-[var(--color-skill-proficient)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(100,116,139,0.2)]',
      titleColor: 'text-[var(--color-skill-proficient)]',
      pillBorder: 'border-slate-400/50',
      pillBg: 'bg-slate-500/10',
      pillText: 'text-slate-300',
    },
    familiar: {
      border: 'border-[var(--color-skill-familiar)]',
      bg: 'bg-[var(--color-card-familiar)]',
      hoverBorder: 'hover:border-[var(--color-skill-familiar)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(71,85,105,0.2)]',
      titleColor: 'text-[var(--color-skill-familiar)]',
      pillBorder: 'border-slate-500/50',
      pillBg: 'bg-slate-600/10',
      pillText: 'text-slate-400',
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
      <div className="flex flex-wrap gap-2" role="list" aria-label={`${title} skills`}>
        {items.map((item, i) => (
          <span
            key={i}
            role="listitem"
            className={cn(
              'rounded-full px-3 py-1 text-sm border',
              styles.pillBorder,
              styles.pillBg,
              styles.pillText
            )}
          >
            <span className="sr-only">{proficiencyLabels[variant]}: </span>
            {item}
          </span>
        ))}
      </div>
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
