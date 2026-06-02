'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/audit-client';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50';

export function ConsultingContactForm() {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setError(null);

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value || undefined,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        trackEvent('consulting_form_submit', { section: 'contact' });
        setState('success');
      } else {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Thanks for reaching out — I&apos;ll be in touch within 48 hours.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4 text-left">
      {/* Honeypot — hidden from real users */}
      <input type="text" name="website" className="hidden" tabIndex={-1} aria-hidden="true" />

      <div>
        <label htmlFor="consulting-name" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="consulting-name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="Your name"
          className={inputClass}
          disabled={state === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="consulting-email" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="consulting-email"
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="you@company.com"
          className={inputClass}
          disabled={state === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="consulting-company" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          Company <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          id="consulting-company"
          name="company"
          type="text"
          maxLength={100}
          placeholder="Your company"
          className={inputClass}
          disabled={state === 'submitting'}
        />
      </div>

      <div>
        <label htmlFor="consulting-message" className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          Message <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="consulting-message"
          name="message"
          required
          maxLength={2000}
          rows={4}
          placeholder="What you're building, where you're stuck, and what you need."
          className={`${inputClass} resize-none`}
          disabled={state === 'submitting'}
        />
      </div>

      {state === 'error' && error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60"
      >
        {state === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
