import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Salsa Con Flow Dance — Case Study | Damilola Elegbede",
  description:
    "How I built and hardened a full-stack booking platform for a professional Latin dance instructor — delivering CI reliability, security layers, and Node.js 20 upgrade before a GitHub Actions deprecation deadline.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-semibold text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
      <div className="text-2xl font-bold text-[var(--color-accent)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[var(--color-text-muted)]">
      <span className="mt-1 flex-shrink-0 text-[var(--color-accent)]">›</span>
      <span>{children}</span>
    </li>
  );
}

export default function ScfDanceCaseStudy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <nav className="mb-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/case-studies" className="hover:text-[var(--color-accent)] transition-colors">
          ← Case Studies
        </Link>
      </nav>

      <header className="mb-12">
        <p className="mb-2 text-sm uppercase tracking-widest text-[var(--color-accent)]">
          Case Study
        </p>
        <h1 className="mb-4 text-4xl font-bold text-[var(--color-text)] md:text-5xl">
          Salsa Con Flow Dance
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          A full-stack booking platform for a professional Latin dance instructor — built on
          Next.js and Vercel, then systematically hardened: rate limiting, CSP headers,
          Vercel Analytics, and a Node.js 20 upgrade shipped before a GitHub Actions
          deprecation deadline.
        </p>
      </header>

      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric value="4" label="CI checks added" />
        <Metric value="0" label="CI failures on merge" />
        <Metric value="Node 20" label="Upgraded before June deadline" />
        <Metric value="4" label="Security layers shipped" />
      </div>

      <Section title="Context">
        <p className="mb-4 text-[var(--color-text-muted)]">
          Salsa Con Flow Dance needed a professional web presence: booking form, testimonials,
          contact management, and analytics — all production-grade and maintainable. The
          stack is Next.js (App Router), TypeScript, Tailwind, and Vercel.
        </p>
        <p className="text-[var(--color-text-muted)]">
          After the initial feature build, the platform needed systematic hardening: the CI
          pipeline lacked coverage, security headers were absent, and the GitHub Actions
          Node.js version was facing a June 2026 deprecation. Each of these was an independent
          work track managed in parallel.
        </p>
      </Section>

      <Section title="Key Challenges">
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Challenge 1 — Rate limiting on testimonial submissions
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              The{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                POST /api/testimonials
              </code>{" "}
              endpoint accepted unlimited submissions with no IP-based throttle. A simple
              form automation could flood the testimonials queue. The fix added a sliding-window
              rate limiter keyed by IP: 5 submissions per hour per client. Excess requests
              receive a{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                429 Too Many Requests
              </code>{" "}
              with a{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                Retry-After
              </code>{" "}
              header.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Challenge 2 — Security hardening: CSP + strict headers
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              The platform shipped without a Content Security Policy. A CSP audit identified
              inline script/style risks and missing frame-ancestors directives. The fix added
              a strict CSP via Next.js{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                headers()
              </code>{" "}
              config: nonce-based{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                script-src
              </code>
              , locked{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                object-src none
              </code>
              ,{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                frame-ancestors none
              </code>
              , plus{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                X-Content-Type-Options
              </code>
              ,{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                Referrer-Policy
              </code>
              , and{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                Permissions-Policy
              </code>
              .
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Challenge 3 — Node.js 20 upgrade before June 2026 deprecation
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              GitHub Actions deprecated Node.js 16 runners in June 2026. The CI pipeline
              used{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                actions/setup-node@v3
              </code>{" "}
              with{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                node-version: 18
              </code>
              . The fix upgraded to{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                actions/setup-node@v4
              </code>{" "}
              with{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                node-version: 20
              </code>{" "}
              across all workflow files — shipped 5 weeks before the deadline.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Challenge 4 — Booking form integration test coverage
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              The booking form submission path had zero automated test coverage — a regression
              in the happy path would be invisible until a real user hit it. Playwright
              integration tests were added covering the happy path (successful submission),
              validation errors (empty required fields), and boundary conditions (long inputs,
              special characters). Tests run in CI on every PR.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Execution Approach">
        <p className="mb-6 text-[var(--color-text-muted)]">
          Each work track was independent with its own branch, its own CI validation, and
          its own merge window. No track blocked another — all could proceed in parallel.
        </p>
        <ul className="space-y-3">
          <Bullet>
            <strong className="text-[var(--color-text)]">CI-first discipline:</strong>{" "}
            every change required all existing checks to pass before merge. No exceptions
            for &ldquo;small changes&rdquo; — the CI gate caught two regressions that would
            have shipped to production without it.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Deadline-driven prioritization:</strong>{" "}
            the Node.js 20 upgrade was fast-tracked because a hard external deadline (GitHub
            Actions deprecation) made deferral costly. Shipped and in CI before the deadline
            window opened.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Security-first additions:</strong>{" "}
            rate limiting and CSP were added proactively — not in response to an incident.
            Both are significantly cheaper to add before a platform has real user traffic.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Test coverage as insurance:</strong>{" "}
            the booking form tests gave the team confidence to iterate on the form without
            manually verifying the happy path after every change. Coverage for the core
            user flow is the floor, not the ceiling.
          </Bullet>
        </ul>
      </Section>

      <Section title="Quantified Results">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              metric: "Zero CI failures on merge",
              detail: "All 4 security/hardening PRs merged with full CI pass — no rollbacks, no hotfixes.",
            },
            {
              metric: "Node 20 before deadline",
              detail: "Upgraded 5 weeks before GitHub Actions' Node.js 16 deprecation window. Zero CI disruption.",
            },
            {
              metric: "Rate limiting live",
              detail: "POST /api/testimonials now throttled at 5 req/hr/IP with RFC-compliant 429 + Retry-After headers.",
            },
            {
              metric: "Booking form fully tested",
              detail: "Playwright E2E tests cover happy path, validation errors, and boundary conditions. Runs on every PR.",
            },
          ].map(({ metric, detail }) => (
            <div
              key={metric}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="mb-2 font-semibold text-[var(--color-text)]">{metric}</div>
              <p className="text-sm text-[var(--color-text-muted)]">{detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tech Stack">
        <div className="flex flex-wrap gap-2">
          {["Next.js", "TypeScript", "Tailwind CSS", "Vercel", "GitHub Actions", "Playwright", "Vitest"].map(
            (tech) => (
              <span
                key={tech}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-sm text-[var(--color-text-muted)]"
              >
                {tech}
              </span>
            )
          )}
        </div>
      </Section>

      <Section title="Lessons">
        <ul className="space-y-3">
          <Bullet>
            <strong className="text-[var(--color-text)]">Security hardening is cheaper early.</strong>{" "}
            Adding CSP and rate limiting before the platform had real traffic required no
            compatibility retrofitting. The same work post-launch would have required
            auditing live usage patterns for CSP violations.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">External deadlines are forcing functions.</strong>{" "}
            The Node.js 20 upgrade happened because there was a hard date. Without a deadline,
            &ldquo;update the CI&rdquo; lives in the backlog indefinitely. Build the upgrade into
            the sprint before the deadline window opens.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Test the form, not just the API.</strong>{" "}
            Unit tests on the API handler miss UX-level regressions. The booking form tests
            caught a field-order validation bug that the API tests would never have seen.
          </Bullet>
        </ul>
      </Section>

      <div className="mt-16 border-t border-[var(--color-border)] pt-8 flex items-center justify-between">
        <Link
          href="/case-studies/alcbf"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← A Lo Cubano Boulder Fest
        </Link>
        <Link
          href="/case-studies"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          All Case Studies →
        </Link>
      </div>
    </main>
  );
}
