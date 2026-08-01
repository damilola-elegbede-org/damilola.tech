import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Metadata } from "next";

// Dark/unlinked per ENG-1417 — no nav entry, no sitemap entry, and explicitly
// de-indexed so a crawler that finds the URL some other way doesn't surface it.
export const metadata: Metadata = {
  title: "The Failure Atlas",
  description:
    "How production agent fleets actually break, and how to stop it. Real failure modes from eight months running an autonomous agent fleet in production.",
  robots: { index: false, follow: false },
};

const CONTENT = `# The Failure Atlas

### How production agent fleets actually break — and how to stop it.

Everyone shows you the demo where the agent works. Nobody shows you the 3 a.m. failure where
the cron silently stopped firing, the handoff returned \`ok: true\` and never arrived, or the
agent quietly started acting as the wrong identity.

We ran a fleet of autonomous agents 24/7 for eight months. This is the field guide we wish
we'd had — every chapter is a real failure mode, its root cause, and the fix, written for the
engineers now putting agents into production.

**[Read the Atlas →](/atlas/chapter-1)**

---

## Who this is for

- **Platform / infra engineers** standing up agent fleets, crons, and A2A messaging.
- **Founders and tech leads** who just shipped their first autonomous agent and want to know
  what's going to bite them in month two.
- **Anyone** who has ever asked "the agent said it worked — why didn't anything happen?"

## Why trust this

Not theory, not a vendor pitch. Every entry comes from a real incident in a fleet that runs
continuously: scheduled agents, cross-agent handoffs, webhooks, credential pipelines, the
whole surface. We generalized each one so it applies to your stack, not ours — no vendor
lock-in, no product required to get the lesson.

## The Atlas (opening chapters)

1. **[The Silent Cron](/atlas/chapter-1)** — your scheduled agent stopped firing and nothing alerted you.
2. **[The Handoff That Never Arrived](/atlas/chapter-2)** — messages that return success but never deliver.
3. **[Who Are You, Really](/atlas/chapter-3)** — agents that quietly act as the wrong identity.

*New chapter every week. The failure modes don't run out.*`;

export default function AtlasLanding() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <nav className="mb-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">
          ← damilola.tech
        </Link>
      </nav>
      <article className="admin-docs-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{CONTENT}</ReactMarkdown>
      </article>
    </main>
  );
}
