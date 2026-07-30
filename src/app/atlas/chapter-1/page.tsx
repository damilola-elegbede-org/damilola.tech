import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Metadata } from "next";

// Dark/unlinked per ENG-1417 — no nav entry, no sitemap entry, and explicitly
// de-indexed so a crawler that finds the URL some other way doesn't surface it.
export const metadata: Metadata = {
  title: "Chapter 1 — The Silent Cron | The Failure Atlas",
  description:
    "Your scheduled agent stopped firing three days ago. Nothing alerted you. Why last-completion freshness checks lie, and what to measure instead.",
  robots: { index: false, follow: false },
};

const CONTENT = `# Chapter 1 — The Silent Cron

*Your scheduled agent stopped firing three days ago. Nothing alerted you. You found out when
the downstream report was empty.*

## The symptom

A job that's supposed to run every 30 minutes — a digest, a sync, a health sweep — just...
stops. No error. No crash. No page. The process that should have screamed is the process
that died, so of course it didn't scream. You notice hours or days later, downstream, when
something that depended on its output is stale or missing.

## What's actually happening (three common root causes)

**1. The host went to sleep.** On laptops and dev machines, interval-based schedulers
(launchd \`StartInterval\`, cron on a sleeping box) don't fire while the machine is suspended —
and they don't catch up on wake. An overnight "every 30 min" job can miss its entire night and
report itself perfectly healthy at 8 a.m. because *by then* it's firing again. The gap is
invisible unless you were watching during the gap.

**2. Reload churn resets the clock.** Every time you reload a scheduler definition (deploy,
config change, \`launchctl load\`), interval and calendar timers reset their next-fire. A job
scheduled monthly, on a fleet that redeploys weekly, may **never** reach its fire time — it's
not broken, it's *starved*. \`runs = 0\` looks identical to "misconfigured" and gets debugged for
an hour before someone realizes the schedule never got to run.

**3. \`last_run\` lies.** Most freshness checks compare "now" against the job's last *completion*
timestamp. But in a queue/dispatch model, completion lags the actual fire by one full cadence —
so a healthy job in a slow queue looks stale, and a truly dead job in a fast queue looks fresh.
Freshness measured against the wrong clock pages you at 2 a.m. for nothing and stays silent for
the one that matters.

## The fix

- **Measure freshness against expected next-fire, not last-completion**, and widen the staleness
  cutoff by the job's own cadence for anything dispatched through a queue.
- **Make sleep explicit.** Detect host-suspend windows and suppress "stale" verdicts that fall
  entirely inside them — a job that missed because the laptop was closed is not a dead service,
  and paging on it trains you to ignore the pager (see Chapter 4).
- **For rare jobs, decouple fire from schedule.** Add a run-at-load + a due-guard so a monthly
  job that keeps getting reload-reset still executes when it's actually due, instead of waiting
  for a fire time that reload churn keeps pushing away.

## The takeaway

Every one of these is the same failure at heart: **the thing that was supposed to notice the
problem was the thing that failed.** A scheduler cannot report its own death. You need an
*external* liveness signal — a job that checks in on every fire and pages you when a check-in
is late — because the only reliable observer of a dead process is a *different* process.

> That external check-in is the boring fix that actually works, and it's what we build.
> The chapter's lesson is free either way.`;

export default function AtlasChapter1() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <nav className="mb-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/atlas" className="hover:text-[var(--color-accent)] transition-colors">
          ← The Failure Atlas
        </Link>
      </nav>
      <article className="admin-docs-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{CONTENT}</ReactMarkdown>
      </article>
    </main>
  );
}
