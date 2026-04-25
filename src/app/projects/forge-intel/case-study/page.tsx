import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forge Intel — Case Study | Damilola Elegbede",
  description:
    "How I built a job intelligence system that cuts through ATS auth walls to surface high-signal roles at Anthropic, Netflix, Nvidia, Airbnb, and Vercel — with AI scoring and Telegram alerts.",
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

export default function ForgeIntelCaseStudy() {
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
          Forge Intel
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          A job intelligence pipeline that scrapes, scores, and surfaces high-fit roles at
          5 target companies — bypassing ATS auth walls with headless rendering and AI scoring,
          then delivering instant Telegram alerts when a match exceeds threshold.
        </p>
      </header>

      {/* Impact Metrics */}
      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric value="5" label="Target companies monitored" />
        <Metric value="Weekly" label="Automated scrape cadence" />
        <Metric value="< 60s" label="Alert latency on high scores" />
        <Metric value="3" label="ATS auth bypass strategies" />
      </div>

      <Section title="The Problem">
        <p className="mb-4 text-[var(--color-text-muted)]">
          Staff+ job searches at Anthropic, Netflix, and Nvidia require monitoring dozens of
          postings across Workday, Greenhouse, and Ashby — all platforms designed to wall off
          machine-readable job data. Checking manually wastes hours. Missing a posting means
          applying late or not at all.
        </p>
        <p className="text-[var(--color-text-muted)]">
          The specific constraint: ATS platforms like Workday serve HTML challenge pages to
          automated requests, return empty-body SSR shells, or block headless browsers entirely.
          A scraper that only works on static HTML is dead on arrival against 80% of the target
          job boards.
        </p>
      </Section>

      <Section title="Solution Architecture">
        <p className="mb-6 text-[var(--color-text-muted)]">
          Forge Intel runs as a weekly cron job with a multi-strategy fetching layer, SQLite
          persistence, and an AI scoring pipeline backed by the damilola.tech{" "}
          <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-sm text-[var(--color-accent)]">
            /api/v1/score-job
          </code>{" "}
          endpoint.
        </p>
        <ul className="space-y-3">
          <Bullet>
            <strong className="text-[var(--color-text)]">Multi-strategy fetch:</strong>{" "}
            plain HTTP first, then mixed-SSR heuristic detection (Ashby/Workday empty-shell
            fingerprinting), then Playwright headless fallback for SPA/ATS URLs that require
            full JavaScript execution.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Job content bypass:</strong>{" "}
            when URL-based fetching hits an auth wall, the pipeline falls back to{" "}
            <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-sm text-[var(--color-accent)]">
              job_content
            </code>{" "}
            mode — passing raw JD text directly to the scorer, decoupling scraping from scoring.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">SQLite persistence:</strong>{" "}
            every scraped job gets a hash-keyed row. Re-runs are idempotent — already-scored
            roles are skipped, new postings trigger scoring automatically.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">AI scoring:</strong>{" "}
            damilola.tech{" "}
            <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-sm text-[var(--color-accent)]">
              score_job
            </code>{" "}
            MCP tool evaluates fit against resume, returns 0–100 score with gap analysis and
            a failure_mode taxonomy for diagnosing extraction failures.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Telegram alerts:</strong>{" "}
            any posting scoring above the threshold triggers an immediate DM to D via
            the Telegram Bot API — job title, company, score, and top 3 fit bullets.
          </Bullet>
        </ul>
      </Section>

      <Section title="Quantified Impact">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              metric: "5 companies, 1 pipeline",
              detail:
                "Anthropic, Netflix, Nvidia, Airbnb, and Vercel — all monitored from a single weekly cron run without manual checking.",
            },
            {
              metric: "ATS auth wall coverage",
              detail:
                "3 bypass strategies: plain HTTP, mixed-SSR heuristic, and Playwright headless — covering Workday, Greenhouse, Ashby, and Lever.",
            },
            {
              metric: "< 60s alert latency",
              detail:
                "From cron fire to Telegram DM for any posting that scores above threshold. No polling delay — immediate on each scrape run.",
            },
            {
              metric: "Zero manual review overhead",
              detail:
                "Only high-score matches surface. Low-fit roles are silently stored in SQLite for audit but never interrupt D's focus time.",
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
          {[
            "Node.js",
            "SQLite",
            "Playwright",
            "Claude API",
            "Telegram Bot API",
            "damilola.tech MCP",
            "GitHub Actions",
            "launchd",
          ].map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-sm text-[var(--color-text-muted)]"
            >
              {tech}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Lessons">
        <ul className="space-y-3">
          <Bullet>
            <strong className="text-[var(--color-text)]">Scraping strategy is a decision tree, not a single tool.</strong>{" "}
            The first scraper worked on 2 of 5 targets. Only by layering HTML → SSR heuristic
            → Playwright did coverage reach the full target set. Build the fallback chain before
            claiming coverage.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Decouple scraping from scoring.</strong>{" "}
            The content bypass mode ({" "}
            <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-sm text-[var(--color-accent)]">
              job_content
            </code>{" "}
            ) unlocked the full scoring pipeline for job descriptions that cannot be
            machine-fetched at all. Treating &ldquo;I have the text&rdquo; and &ldquo;I fetched the URL&rdquo; as two
            separate inputs made the system more resilient.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Idempotency compounds value over time.</strong>{" "}
            The SQLite hash-key design means each weekly run builds on the previous one.
            Score history, new-posting detection, and trend analysis are all free consequences
            of getting idempotency right on day one.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--color-text)]">Failure modes need taxonomy, not just handling.</strong>{" "}
            Adding{" "}
            <code className="rounded bg-[var(--color-card)] px-1 py-0.5 text-sm text-[var(--color-accent)]">
              failure_mode
            </code>{" "}
            to error responses (auth_wall, empty_shell, timeout, parse_error) made debugging
            silent failures 10x faster and drove the decision to build each bypass strategy.
          </Bullet>
        </ul>
      </Section>

      {/* Footer nav */}
      <div className="mt-16 border-t border-[var(--color-border)] pt-8">
        <Link
          href="/#projects"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← Back to Projects
        </Link>
      </div>
    </main>
  );
}
