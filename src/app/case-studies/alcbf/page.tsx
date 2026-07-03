import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "A Lo Cubano Boulder Fest — Case Study | Damilola Elegbede",
  description:
    "How I debugged a production ticketing platform weeks before a live dance event — fixing analytics undercounting, QR atomicity failures, and silent data corruption with 7 concurrent PRs under real deadline pressure.",
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

export default function AlcbfCaseStudy() {
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
          A Lo Cubano Boulder Fest
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          A production ticketing platform serving a live Latin dance event — and the three
          critical bugs I found and fixed in the weeks before May 15 go-live: an analytics
          undercount, a QR validation race condition, and a silent data corruption in checkout.
        </p>
      </header>

      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric value="7" label="PRs shipped concurrently" />
        <Metric value="17/17" label="CI checks green" />
        <Metric value="3" label="Production data bugs fixed" />
        <Metric value="May 15" label="Go-live with verified data" />
      </div>

      <Section title="Context">
        <p className="mb-4 text-[var(--color-text-muted)]">
          A Lo Cubano Boulder Fest is a Latin dance festival I built from scratch — full
          ticketing, payment processing, QR-code check-in, and an admin analytics dashboard.
          The stack is Node.js, Vercel, Stripe, and Turso (LibSQL edge database).
        </p>
        <p className="text-[var(--color-text-muted)]">
          Three weeks before the May 15 event, a systematic audit of the analytics dashboard
          surfaced four distinct data correctness bugs. Each was independent in cause but
          convergent in effect: every revenue and attendance figure shown to the event organizer
          was wrong.
        </p>
      </Section>

      <Section title="The Bugs">
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Bug 1 — Donation analytics undercount
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              The admin dashboard{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                /api/admin/dashboard
              </code>{" "}
              stats query omitted{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                manual_entry
              </code>{" "}
              donation rows from its{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                transaction_stats
              </code>{" "}
              CTE. Pure-donation transactions were invisible on the dashboard. The fix:
              two PRs surfacing donations in the top-level stats and including the payment
              method in revenue aggregation.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Bug 2 — QR validation atomicity failure
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              QR code scan processing updated three tables:{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                tickets
              </code>
              ,{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                scan_logs
              </code>
              , and{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                qr_validations
              </code>
              — none wrapped in a transaction. A crash between writes left partial state,
              allowing double-entry at the door. The fix wrapped the full scan sequence in a
              LibSQL transaction with rollback on any failure.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Bug 3 — Silent null attendee corruption
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              The checkout API accepted attendee payloads with missing{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                firstName
              </code>{" "}
              /{" "}
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                lastName
              </code>{" "}
              fields, silently storing null in the database. These surfaced as unnamed attendees
              at check-in. Explicit boundary validation at the API layer — before any write —
              closed the gap.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="mb-2 font-semibold text-[var(--color-text)]">
              Bug 4 — Comp ticket revenue inflation
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[var(--color-accent)]">
                getEventStatistics()
              </code>{" "}
              included complimentary (free) tickets in the revenue-per-attendee denominator,
              deflating the figure. The fix excluded comp tickets from revenue aggregation so
              statistics reflect paying attendees only.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Execution Approach">
        <p className="mb-6 text-[var(--color-text-muted)]">
          Each bug was independent — no shared root cause. The right approach was parallel:
          7 targeted PRs, each fixing one specific behavior with its own test. This minimized
          merge conflict risk and let CI verify each fix in isolation.
        </p>
        <ul className="space-y-3">
          <Bullet>
            <strong className="text-[var(--color-text)]">Audit-first:</strong>{" "}
            ran a full Turso prod snapshot before any fixes shipped — establishing
            source-of-truth figures to verify against post-merge.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Parallel PRs, independent branches:</strong>{" "}
            each of the 7 PRs targeted a single function or API endpoint with no file overlap.
            No merge conflicts on the critical path.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Regression pins:</strong>{" "}
            a defensive test pinning the{" "}
            <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-[var(--color-accent)]">
              countSql
            </code>{" "}
            placeholder ↔ args invariant locked the fix in place against future regressions.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Prod verification protocol:</strong>{" "}
            after all 7 PRs merged, post-merge verification diffed live API figures
            against the Turso snapshot — zero discrepancies.
          </Bullet>
        </ul>
      </Section>

      <Section title="Quantified Results">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              metric: "7 PRs, all CI green",
              detail: "17 required checks passed across all 7 PRs — zero rollbacks, zero hotfixes after merge.",
            },
            {
              metric: "Database integrity restored",
              detail: "QR scan writes wrapped in a transaction for the first time. Double-entry at check-in physically impossible.",
            },
            {
              metric: "Accurate financial reporting",
              detail: "All four revenue/attendance aggregation bugs fixed before D presented event financials to the nonprofit.",
            },
            {
              metric: "May 15 go-live",
              detail: "Event-day monitoring runbook documented failure modes. Organizer had a single source of truth for attendee counts and revenue.",
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
          {["Node.js", "Vercel", "Turso (LibSQL)", "Stripe", "Brevo", "GitHub Actions", "Vitest", "Playwright"].map(
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
            <strong className="text-[var(--color-text)]">Deadline pressure exposes assumptions.</strong>{" "}
            The atomicity bug had been in the codebase since launch. It only became urgent when
            we needed certainty for a non-repeatable live event.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Parallel PRs over a single omnibus fix.</strong>{" "}
            Seven targeted PRs — each independently reviewable, testable, and reversible —
            outperformed one large PR in every dimension that mattered at deadline.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Establish the baseline before shipping fixes.</strong>{" "}
            A Turso prod snapshot gave a concrete target to verify against. Without it,
            &ldquo;the numbers look right&rdquo; is judgment, not verification.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Boundary validation is the last line of defense.</strong>{" "}
            The null attendee bug passed through frontend, API handler, and service layer
            because none treated a missing name as an error. Explicit validation at the API
            boundary is the only reliable guarantee.
          </Bullet>
        </ul>
      </Section>

      <div className="mt-16 border-t border-[var(--color-border)] pt-8 flex items-center justify-between">
        <Link
          href="/case-studies"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← All Case Studies
        </Link>
        <Link
          href="/case-studies/scf-dance"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          Next: Salsa Con Flow Dance →
        </Link>
      </div>
    </main>
  );
}
