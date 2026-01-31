'use client';

import Link from 'next/link';

interface DocCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const docs: DocCard[] = [
  // Project Root
  {
    title: 'README',
    description: 'Project overview, tech stack, setup instructions, and architecture.',
    href: '/admin/docs/readme',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'CLAUDE.md',
    description: 'AI assistant configuration, development guidelines, and conventions.',
    href: '/admin/docs/claude-md',
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  // Documentation Guides
  {
    title: 'Documentation Index',
    description: 'Central navigation hub for all project documentation.',
    href: '/admin/docs/docs-index',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    title: 'Admin Portal',
    description: 'Complete guide to admin features: dashboard, traffic, chats, and more.',
    href: '/admin/docs/admin-portal',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'API Documentation',
    description: 'Complete API endpoint reference with examples and error codes.',
    href: '/admin/docs/api-documentation',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    title: 'Rate Limiting',
    description: 'Distributed rate limiting architecture with Redis and circuit breakers.',
    href: '/admin/docs/rate-limiting',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Deployment Guide',
    description: 'Production deployment to Vercel with environment setup.',
    href: '/admin/docs/deployment',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  },
  {
    title: 'UTM Tracking Guide',
    description: 'Use UTM parameters to track where your visitors come from.',
    href: '/admin/docs/utm-tracking',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'External API',
    description: 'REST API access with API keys for external integrations like OpenClaw.',
    href: '/admin/docs/external-api',
    icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
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
