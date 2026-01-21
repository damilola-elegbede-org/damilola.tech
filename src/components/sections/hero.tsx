'use client';

import { Button, InitialsBadge, NavMenu } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

interface HeroProps {
  onOpenChat: () => void;
}

export function Hero({ onOpenChat }: HeroProps) {
  return (
    <>
      {/* Fixed Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[var(--color-border)]/50 bg-[var(--color-bg)]/80 px-6 py-4 backdrop-blur-sm">
        <InitialsBadge />
        <NavMenu />
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative flex min-h-screen flex-col justify-center px-6 py-20"
      >
        <div className="mx-auto w-full max-w-5xl">
          {/* Open to Roles */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#39FF14]"
                aria-hidden="true"
              />
              <span className="sr-only">Currently available - </span>
              Open to {resumeData.openToRoles.join(', ')}
            </span>
          </div>

          {/* Name */}
          <h1 className="mb-4 text-[var(--color-text)]">{resumeData.name}</h1>

          {/* Title */}
          <p className="mb-4 text-3xl font-medium text-[var(--color-accent)] md:text-4xl">
            {resumeData.title}
          </p>

          {/* Tagline */}
          <p className="mb-8 max-w-2xl text-base italic text-[var(--color-text-muted)]">
            {resumeData.tagline}
          </p>

          {/* Experience Tags */}
          <div className="mb-6 flex flex-wrap gap-3">
            {resumeData.experienceTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={onOpenChat}
              size="lg"
              className="bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent)]/90 hover:shadow-[0_0_20px_rgba(0,102,255,0.4)] transition-shadow"
            >
              Ask AI About Me
            </Button>
            <Button
              onClick={() => {
                document
                  .getElementById('fit-assessment')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              size="lg"
              className="bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent)]/90 hover:shadow-[0_0_20px_rgba(0,102,255,0.4)] transition-shadow"
              aria-label="Scroll to fit assessment section"
            >
              Run Fit Assessment
            </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            Scroll to explore
          </p>
          <svg
            aria-hidden="true"
            focusable="false"
            className="mx-auto h-5 w-5 animate-bounce text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>
    </>
  );
}
