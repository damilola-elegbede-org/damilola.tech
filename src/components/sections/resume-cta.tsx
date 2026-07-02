'use client';

import Link from 'next/link';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

export function ResumeCta() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="resume-generator"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 md:p-12">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-[var(--color-accent)]">
            AI-Powered Tool
          </p>
          <h2 className="mb-4 text-2xl font-semibold text-[var(--color-text)] md:text-3xl">
            Generate a Tailored Resume
          </h2>
          <p className="mb-8 max-w-xl text-[var(--color-text-muted)]">
            Paste a job description and get an AI-tailored version of my resume—scored for fit,
            with proposed changes you can accept or edit. Built for recruiters and hiring managers
            who want to skip the guesswork.
          </p>
          <Link
            href="/admin/resume-generator"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-base font-medium text-white transition-shadow hover:bg-[var(--color-accent)]/90 hover:shadow-[0_0_20px_rgba(0,102,255,0.4)]"
          >
            Try Resume Generator
            <svg
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No account required</p>
        </div>
      </div>
    </section>
  );
}
