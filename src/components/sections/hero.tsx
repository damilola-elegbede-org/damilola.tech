'use client';

import { Button } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

interface HeroProps {
  onOpenChat: () => void;
}

export function Hero({ onOpenChat }: HeroProps) {
  return (
    <section
      id="hero"
      className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-20 text-center"
    >
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-[var(--color-primary)]">{resumeData.name}</h1>
        <p className="mb-6 text-xl font-medium text-[var(--color-accent)]">
          {resumeData.title}
        </p>
        <p className="mb-10 text-2xl text-[var(--color-text-muted)]">
          {resumeData.tagline}
        </p>
        <Button onClick={onOpenChat} size="lg">
          Ask AI About My Experience
        </Button>
      </div>
    </section>
  );
}
