'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SHORTLINKS } from '@/lib/shortlinks';

interface UtmExample {
  name: string;
  description: string;
  source: string;
  medium: string;
  campaign?: string;
}

const examples: UtmExample[] = [
  {
    name: 'LinkedIn Bio',
    description: 'Link in your LinkedIn profile bio',
    source: 'linkedin',
    medium: 'bio',
  },
  {
    name: 'LinkedIn Post',
    description: 'Links shared in LinkedIn posts',
    source: 'linkedin',
    medium: 'post',
  },
  {
    name: 'Recruiter Outreach',
    description: 'Links sent directly to recruiters',
    source: 'recruiter',
    medium: 'outreach',
    campaign: '{company}',
  },
  {
    name: 'Email Signature',
    description: 'Link in your email signature',
    source: 'email',
    medium: 'signature',
  },
  {
    name: 'Resume PDF',
    description: 'Link embedded in your resume PDF',
    source: 'resume',
    medium: 'pdf',
  },
  {
    name: 'GitHub Profile',
    description: 'Link in your GitHub profile',
    source: 'github',
    medium: 'profile',
  },
  {
    name: 'Twitter/X Bio',
    description: 'Link in your Twitter/X bio',
    source: 'twitter',
    medium: 'bio',
  },
  {
    name: 'Conference Talk',
    description: 'QR code or link in presentation slides',
    source: 'conference',
    medium: 'slides',
    campaign: '{event-name}',
  },
];

function buildUrl(example: UtmExample, baseUrl: string): string {
  const params = new URLSearchParams();
  params.set('utm_source', example.source);
  params.set('utm_medium', example.medium);
  if (example.campaign) {
    params.set('utm_campaign', example.campaign);
  }
  return `${baseUrl}?${params.toString()}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied to clipboard' : error ? 'Copy failed' : 'Copy to clipboard'}
      className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {copied ? 'Copied!' : error ? 'Failed' : 'Copy'}
    </button>
  );
}

export default function UtmTrackingPage() {
  const baseUrl = 'https://damilola.tech';

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
        <h1 className="text-2xl font-bold text-[var(--color-text)]">UTM Tracking Guide</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Track where your visitors come from using UTM parameters
        </p>
      </div>

      {/* What are UTM parameters */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          What are UTM Parameters?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          UTM (Urchin Tracking Module) parameters are tags added to URLs that help track where
          traffic comes from. When someone clicks a link with UTM parameters, those values are
          captured and stored, allowing you to see which sources drive the most visitors.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Parameter</th>
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Purpose</th>
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Example</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-border)]/50">
                <td className="py-2 font-mono text-[var(--color-accent)]">utm_source</td>
                <td className="py-2 text-[var(--color-text-muted)]">Where the traffic comes from</td>
                <td className="py-2 font-mono text-[var(--color-text)]">linkedin, google, email</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/50">
                <td className="py-2 font-mono text-[var(--color-accent)]">utm_medium</td>
                <td className="py-2 text-[var(--color-text-muted)]">The marketing medium</td>
                <td className="py-2 font-mono text-[var(--color-text)]">bio, post, signature</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/50">
                <td className="py-2 font-mono text-[var(--color-accent)]">utm_campaign</td>
                <td className="py-2 text-[var(--color-text-muted)]">Specific campaign name</td>
                <td className="py-2 font-mono text-[var(--color-text)]">google-q1, acme-corp</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]/50">
                <td className="py-2 font-mono text-[var(--color-accent)]">utm_term</td>
                <td className="py-2 text-[var(--color-text-muted)]">Search keywords (optional)</td>
                <td className="py-2 font-mono text-[var(--color-text)]">engineering+manager</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-[var(--color-accent)]">utm_content</td>
                <td className="py-2 text-[var(--color-text-muted)]">Differentiate similar links</td>
                <td className="py-2 font-mono text-[var(--color-text)]">header-link, footer-cta</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Shortlinks */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Vanity Shortlinks</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Memorable URLs that redirect to the homepage with UTM parameters. Perfect for verbal
          sharing, business cards, or when you need a simple link to remember.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Shortlink</th>
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Source</th>
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Medium</th>
                <th className="pb-2 text-left font-medium text-[var(--color-text)]">Use Case</th>
              </tr>
            </thead>
            <tbody>
              {SHORTLINKS.map((link) => (
                <tr key={link.slug} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2">
                    <code className="rounded bg-[var(--color-bg)] px-2 py-0.5 font-mono text-[var(--color-accent)]">
                      /{link.slug}
                    </code>
                  </td>
                  <td className="py-2 font-mono text-[var(--color-text)]">{link.utm_source}</td>
                  <td className="py-2 font-mono text-[var(--color-text)]">{link.utm_medium}</td>
                  <td className="py-2 text-[var(--color-text-muted)]">{link.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          Example: Share <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 font-mono">damilola.tech/recruiter</code> with
          a recruiter, and their visit will be tracked with source=recruiter, medium=verbal.
        </p>
      </div>

      {/* Automatic tracking */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Automatic Tracking</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Even without UTM parameters, the site automatically tracks:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
          <li>
            <span className="text-[var(--color-text)]">Referrer</span> - The page that linked to you
            (e.g., linkedin.com)
          </li>
          <li>
            <span className="text-[var(--color-text)]">Landing page</span> - Which page they first
            visited
          </li>
          <li>
            <span className="text-[var(--color-text)]">Session ID</span> - Unique identifier for
            each visit
          </li>
        </ul>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          The referrer is automatically classified into known sources (google, linkedin, twitter,
          github) or shown as the domain name.
        </p>
      </div>

      {/* Example links */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          Ready-to-Use Links
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Copy these links for different use cases. Replace {'{company}'} or {'{event-name}'} with
          actual values when applicable.
        </p>
        <div className="space-y-4">
          {examples.map((example) => {
            const url = buildUrl(example, baseUrl);
            // Decode URL-encoded placeholders for readability
            const displayUrl = url.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
            return (
              <div
                key={example.name}
                className="rounded-lg bg-[var(--color-bg)] p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-[var(--color-text)]">{example.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{example.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-[var(--color-card)] px-3 py-2 font-mono text-xs text-[var(--color-text)]">
                    {displayUrl}
                  </code>
                  <CopyButton text={displayUrl} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom link builder */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Tips</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-[var(--color-text-muted)]">
          <li>Use lowercase for all UTM values for consistency</li>
          <li>Use hyphens instead of spaces (e.g., acme-corp not acme corp)</li>
          <li>Be specific with campaign names to identify individual outreach efforts</li>
          <li>
            For recruiter outreach, include the company name as the campaign:
            <code className="ml-1 rounded bg-[var(--color-bg)] px-1 py-0.5 font-mono text-xs">
              utm_campaign=google
            </code>
          </li>
          <li>Traffic data appears in the Traffic dashboard after at least one visit</li>
        </ul>
      </div>
    </div>
  );
}
