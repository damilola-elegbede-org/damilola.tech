'use client';

import { useEffect, useState } from 'react';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  stargazers_count: number;
}

interface GitHubData {
  contributionCount: number;
  repos: Repo[];
  error?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  JavaScript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Python: 'bg-green-500/20 text-green-300 border-green-500/30',
  Go: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Rust: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Shell: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const DEFAULT_LANG_COLOR = 'bg-slate-500/20 text-slate-300 border-slate-500/30';

function RepoCard({ repo }: { repo: Repo }) {
  const langColor = repo.language
    ? (LANGUAGE_COLORS[repo.language] ?? DEFAULT_LANG_COLOR)
    : DEFAULT_LANG_COLOR;

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5',
        'transition-all duration-200 hover:border-[var(--color-accent)]/50 hover:shadow-[0_0_16px_rgba(0,102,255,0.12)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">{repo.name}</h3>
        {repo.stargazers_count > 0 && (
          <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
            ★ {repo.stargazers_count}
          </span>
        )}
      </div>
      {repo.description && (
        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">
          {repo.description}
        </p>
      )}
      {repo.language && (
        <span
          className={cn(
            'mt-3 inline-block rounded-full border px-2 py-0.5 text-xs font-medium',
            langColor,
          )}
        >
          {repo.language}
        </span>
      )}
    </a>
  );
}

export function GitHubActivity() {
  const { ref, isVisible } = useScrollReveal();
  const [data, setData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/github-activity')
      .then((r) => r.json())
      .then((d: GitHubData) => setData(d))
      .catch(() => setData({ contributionCount: 0, repos: [], error: 'Failed to load' }))
      .finally(() => setLoading(false));
  }, []);

  const hasData = data && !data.error && (data.contributionCount > 0 || data.repos.length > 0);

  if (!loading && !hasData) return null;

  return (
    <section
      id="github-activity"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
      )}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl text-[var(--color-text)] md:text-4xl">Engineering Activity</h2>
          {loading ? (
            <div className="h-8 w-40 animate-pulse rounded bg-[var(--color-card)]" />
          ) : (
            data && data.contributionCount > 0 && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-accent)]">
                  {data.contributionCount.toLocaleString()}
                </span>{' '}
                contributions in the last 90 days
              </span>
            )
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-[var(--color-card)]" />
            ))}
          </div>
        ) : (
          data && data.repos.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.repos.map((repo) => (
                <RepoCard key={repo.name} repo={repo} />
              ))}
            </div>
          )
        )}

        <p className="mt-6 text-right text-xs text-[var(--color-text-secondary)]">
          <a
            href={`https://github.com/damilola-elegbede`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-accent)] transition-colors"
          >
            View full GitHub profile →
          </a>
        </p>
      </div>
    </section>
  );
}
