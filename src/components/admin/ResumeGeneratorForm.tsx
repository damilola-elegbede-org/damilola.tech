'use client';

import { useState } from 'react';

interface ResumeGeneratorFormProps {
  onSubmit: (jobDescription: string) => void;
  isLoading: boolean;
}

export function ResumeGeneratorForm({ onSubmit, isLoading }: ResumeGeneratorFormProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="job-description"
          className="block text-sm font-medium text-[var(--color-text)]"
        >
          Job Description
        </label>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Paste a job posting URL or the full job description text
        </p>
        <textarea
          id="job-description"
          rows={12}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="https://jobs.lever.co/company/position... or paste the full job description here"
          className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing...
            </span>
          ) : (
            'Analyze & Optimize'
          )}
        </button>

        {input.startsWith('http') && (
          <span className="text-sm text-[var(--color-text-muted)]">
            URL detected - will fetch and extract content
          </span>
        )}
      </div>
    </form>
  );
}
