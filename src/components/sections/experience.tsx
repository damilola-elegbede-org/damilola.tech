'use client';

import { useState } from 'react';
import { resumeData } from '@/lib/resume-data';
import { cn } from '@/lib/utils';

export function Experience() {
  const [expandedId, setExpandedId] = useState<string | null>(
    resumeData.experiences[0]?.id || null
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section id="experience" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-center text-[var(--color-primary)]">
          Experience
        </h2>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-0 top-0 h-full w-0.5 bg-[var(--color-border)] md:left-1/2 md:-translate-x-1/2" />

          {resumeData.experiences.map((exp, index) => (
            <div
              key={exp.id}
              className={cn(
                'relative mb-8 pl-8 md:w-1/2 md:pl-0',
                index % 2 === 0 ? 'md:pr-12' : 'md:ml-auto md:pl-12'
              )}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-0 top-2 h-3 w-3 rounded-full bg-[var(--color-accent)] md:left-auto',
                  index % 2 === 0 ? 'md:-right-1.5' : 'md:-left-1.5'
                )}
              />

              <button
                onClick={() => toggleExpand(exp.id)}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                aria-expanded={expandedId === exp.id}
              >
                <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                        {exp.company}
                      </h3>
                      <p className="font-medium text-[var(--color-accent)]">
                        {exp.title}
                      </p>
                    </div>
                    <svg
                      className={cn(
                        'h-5 w-5 text-[var(--color-text-muted)] transition-transform',
                        expandedId === exp.id && 'rotate-180'
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {exp.startDate} - {exp.endDate} | {exp.location}
                  </p>

                  {expandedId === exp.id && (
                    <ul className="mt-4 space-y-2">
                      {exp.highlights.map((highlight, i) => (
                        <li
                          key={i}
                          className="flex items-start text-[var(--color-text)]"
                        >
                          <span className="mr-2 text-[var(--color-accent)]">
                            •
                          </span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
