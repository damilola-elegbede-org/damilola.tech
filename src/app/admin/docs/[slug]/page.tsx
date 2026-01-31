'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocData {
  slug: string;
  fileName: string;
  content: string;
}

// Map slug to display title
const DOC_TITLES: Record<string, string> = {
  'readme': 'README',
  'claude-md': 'CLAUDE.md',
  'docs-index': 'Documentation Index',
  'admin-portal': 'Admin Portal Guide',
  'api-documentation': 'API Documentation',
  'rate-limiting': 'Rate Limiting',
  'deployment': 'Deployment Guide',
  'utm-tracking': 'UTM Tracking Guide',
  'external-api': 'External API Documentation',
};

export default function DocPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [doc, setDoc] = useState<DocData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDoc() {
      try {
        const res = await fetch(`/api/admin/docs/${slug}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Document not found');
          } else {
            throw new Error('Failed to fetch document');
          }
          return;
        }
        const data = await res.json();
        setDoc(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDoc();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading document">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/docs"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const title = DOC_TITLES[slug] || doc?.fileName || slug;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/docs"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{title}</h1>
        {doc?.fileName && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Source: <code className="rounded bg-[var(--color-bg)] px-1 py-0.5">{doc.fileName}</code>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <article className="admin-docs-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc?.content || ''}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
