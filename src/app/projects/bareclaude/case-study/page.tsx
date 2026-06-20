import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BareClaude Agent Fleet — Case Study | Damilola Elegbede",
  description:
    "How I built a production multi-agent AI system with autonomous task orchestration, fleet-wide cohesion, and 73+ completed engineering tasks — from first principles.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-semibold text-[var(--color-text)]">
        {title}
      </h2>
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

export default function BareClaudeCaseStudy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/#projects" className="hover:text-[var(--color-accent)] transition-colors">
          ← Back to Projects
        </Link>
      </nav>

      {/* Header */}
      <header className="mb-12">
        <p className="mb-2 text-sm uppercase tracking-widest text-[var(--color-accent)]">
          Case Study
        </p>
        <h1 className="mb-4 text-4xl font-bold text-[var(--color-text)] md:text-5xl">
          BareClaude Agent Fleet
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          A production multi-agent AI system that autonomously manages engineering operations
          — from PR lifecycle to job search infrastructure — with 73+ tasks completed and
          5 repos under active AI-driven development.
        </p>
      </header>

      {/* Impact Metrics */}
      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric value="73+" label="Tasks completed autonomously" />
        <Metric value="20+" label="PRs in D's review queue" />
        <Metric value="5" label="Repos actively maintained" />
        <Metric value="14.5M" label="Tokens/week (post-efficiency trim)" />
      </div>

      <Section title="The Problem">
        <p className="mb-4 text-[var(--color-text-muted)]">
          Managing a multi-project engineering operation solo — active job search, client
          projects (ALCBF non-profit, SCF Dance), and open-source infrastructure — created
          a coordination bottleneck. Context evaporated between sessions, tasks fell through
          cracks, and driving work from idea to merged PR required constant manual steering.
        </p>
        <p className="text-[var(--color-text-muted)]">
          The deeper problem: AI coding tools are stateless. Each session starts cold. Without
          a durable cross-session memory architecture and a systematic way to delegate and
          verify, any &quot;AI-assisted&quot; workflow is just autocomplete with extra steps.
        </p>
      </Section>

      <Section title="The Solution">
        <p className="mb-6 text-[var(--color-text-muted)]">
          BareClaude is a production multi-agent platform with 3 autonomous principals — Dara Fox
          (Distinguished Engineer), Clara Nova (Chief of Staff), and TARS (Personal Assistant) —
          each with distinct domain authority, dedicated identity wrappers, and a shared launchd
          and queue infrastructure running 24/7 on a Mac Mini.
        </p>

        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          Fleet Architecture
        </h3>
        <ul className="mb-6 space-y-2">
          <Bullet>
            <strong>3 autonomous principals</strong> — Clara Nova (Chief of Staff), Dara Fox
            (Distinguished Engineer), and TARS (Personal Assistant to Ana). Each principal has
            domain-isolated authority, dedicated Slack and Telegram identities, and owns its
            surfaces end-to-end.
          </Bullet>
          <Bullet>
            <strong>8+ specialist sub-agents on-demand</strong> — frontend-engineer,
            backend-engineer, devops, security-auditor, test-engineer, docs-writer, and
            others. Each operates with a constrained tool set and a full delegation brief.
          </Bullet>
          <Bullet>
            <strong>Fleet cohesion via dual primitives</strong> — a rolling{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              current-state.md
            </code>{" "}
            (regenerated every 30 min by heartbeat cron) and an append-only{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              activity.jsonl
            </code>{" "}
            stream written by every component. Any process reads these two files at start
            and achieves cross-session coherence without shared memory.
          </Bullet>
          <Bullet>
            <strong>Queue-based dispatch</strong> — cron jobs enqueue work via flock-protected
            temp scripts, solving the tmux send-keys payload size limit that caused a
            7-hour fleet-wide dispatch wedge in April 2026.
          </Bullet>
        </ul>

        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          Autonomous Scheduling
        </h3>
        <ul className="mb-6 space-y-2">
          <Bullet>
            <strong>Execute cron (every 3h)</strong> — advances up to 3 open Notion tasks
            per run: CI monitoring, CodeRabbit resolution, rebases, PR promotion through
            a 3-gate quality check (CI green + CodeRabbit clean + mergeable).
          </Bullet>
          <Bullet>
            <strong>Plan cron (every 4h)</strong> — scans active projects, creates up to
            5 new tasks per run, promotes Backlog → Ready for unblocked tasks with clear
            acceptance criteria.
          </Bullet>
          <Bullet>
            <strong>Heartbeat cron (every 30 min)</strong> — pings 7 identity services,
            checks cron cadence, posts to #alerts only on failure, regenerates current-state.md.
          </Bullet>
          <Bullet>
            <strong>PR digest cron (8 AM + 4 PM MT)</strong> — reviews open PRs,
            age-tiers them, posts Slack digest + Telegram DM to D.
          </Bullet>
        </ul>

        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          PR Quality Gates
        </h3>
        <p className="text-[var(--color-text-muted)]">
          No PR reaches &quot;In Review&quot; (D&apos;s queue) until three gates pass:
          (1) CI fully green on all required checks, (2) all CodeRabbit review threads
          resolved via automated triage, and (3) PR mergeable with no conflicts or stale
          base. The Execute cron drives PRs through these gates across successive runs —
          D clicks Merge on a clean queue.
        </p>
      </Section>

      <Section title="Key Engineering Decisions">
        <ul className="space-y-4">
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Stateless orchestration over shared state
              </strong>
              <p className="mt-1">
                Each cron fire and daemon turn reads two files and writes one event.
                No database, no message broker, no shared memory. Fleet cohesion emerges
                from append-only logs and rolling summaries — the same pattern used in
                distributed tracing.
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Notion as single source of truth
              </strong>
              <p className="mt-1">
                All task tracking lives in Notion (not GitHub Issues, not Slack threads).
                This separates task lifecycle from implementation artifacts (PRs in GitHub)
                and gives D a single dashboard view across 5 repos.
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                GitHub App identity per agent
              </strong>
              <p className="mt-1">
                Each agent has its own GitHub App bot identity (dara-fox[bot],
                clara-nova[bot], etc.). Commits, PRs, and reviews are
                attributed per-agent — full audit trail, no shared credentials.
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                TCC-aware launchd + tmux hybrid
              </strong>
              <p className="mt-1">
                macOS TCC (Transparency, Consent, Control) blocks keychain access for
                launchd-spawned processes. Solution: launchd fires into long-lived tmux
                sessions bootstrapped from Terminal (which has TCC approval). Crons
                enqueue; daemons execute. One-time setup, indefinitely reliable.
              </p>
            </div>
          </Bullet>
        </ul>
      </Section>

      <Section title="Tech Stack">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {[
            "TypeScript / Next.js 15",
            "Anthropic Claude API",
            "Opus 4 / Sonnet 4 / Haiku 4",
            "Notion API",
            "Slack Socket Mode",
            "Telegram Bot API",
            "GitHub Apps (10 identities)",
            "launchd + tmux",
            "Vercel (Next.js hosting)",
            "age encryption (secrets at rest)",
            "flock (dispatch concurrency)",
            "SQLite / LibSQL / Turso",
          ].map((tech) => (
            <div
              key={tech}
              className="flex items-center gap-2 py-1 text-sm text-[var(--color-text-muted)]"
            >
              <span className="text-[var(--color-accent)]">›</span>
              {tech}
            </div>
          ))}
        </div>
      </Section>

      <Section title="What I Learned">
        <ul className="space-y-3">
          <Bullet>
            Coherence across stateless processes is an architecture problem, not a memory
            problem. The activity.jsonl + rolling summary pattern generalizes to any
            distributed system where agents need shared context without shared runtime.
          </Bullet>
          <Bullet>
            Quality gates at the automation boundary matter more than at the human boundary.
            Three-gate PR promotion (CI + CodeRabbit + mergeability) eliminated the
            pattern of D reviewing un-mergeable PRs — trust compounds when the automation
            is never wrong.
          </Bullet>
          <Bullet>
            Out-of-band monitoring is non-negotiable. A watchdog that shares substrate
            with the thing it watches fails with it. Every monitor needs a disjoint
            failure domain — learned from a 7-hour fleet-wide dispatch wedge that the
            in-process watchdog couldn&apos;t detect.
          </Bullet>
          <Bullet>
            Token efficiency and autonomy are orthogonal. Dropping from 37M to 14.5M
            tokens/week required only cadence tuning (hourly Execute → every 3h) —
            no capability regression. Most of the token budget was clock ticks, not work.
          </Bullet>
        </ul>
      </Section>

      {/* Footer links */}
      <div className="flex flex-wrap gap-6 border-t border-[var(--color-border)] pt-8">
        <a
          href="https://github.com/damilola-elegbede-org/bareclaude"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          GitHub →
        </a>
        <Link
          href="/projects/bareclaude/activity"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          Weekly Activity →
        </Link>
        <Link
          href="/#projects"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          ← All Projects
        </Link>
      </div>
    </main>
  );
}
