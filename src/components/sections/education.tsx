'use client';

import { Card, CardContent } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

export function Education() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="education"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Education
        </h2>
        <div className="space-y-4">
          {resumeData.education.map((edu) => (
            <Card key={edu.id}>
              <CardContent>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  {edu.degree}
                </h3>
                <p className="text-[var(--color-text-muted)]">
                  {edu.institution}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
