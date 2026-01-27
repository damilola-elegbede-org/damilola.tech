'use client';

import Link from 'next/link';

interface DocCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const docs: DocCard[] = [
  {
    title: 'README',
    description: 'Project overview, tech stack, setup instructions, and architecture documentation.',
    href: '/admin/docs/readme',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'CLAUDE.md',
    description: 'AI assistant configuration, development guidelines, and project conventions.',
    href: '/admin/docs/claude-md',
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'UTM Tracking Guide',
    description: 'Learn how to use UTM parameters to track where your visitors come from.',
    href: '/admin/docs/utm-tracking',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Documentation</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Guides and references for using the admin portal
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-accent)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <svg
                className="h-6 w-6 text-[var(--color-accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={doc.icon}
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
              {doc.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{doc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
