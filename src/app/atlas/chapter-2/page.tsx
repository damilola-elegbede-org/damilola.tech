import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Metadata } from "next";

// Dark/unlinked per ENG-1417 — no nav entry, no sitemap entry, and explicitly
// de-indexed so a crawler that finds the URL some other way doesn't surface it.
export const metadata: Metadata = {
  title: "Chapter 2 — The Handoff That Never Arrived | The Failure Atlas",
  description:
    "Agent A handed a task to Agent B. The send returned ok: true. Agent B never did anything. Why a 200 response is not confirmation of receipt.",
  robots: { index: false, follow: false },
};

const CONTENT = `# Chapter 2 — The Handoff That Never Arrived

*Agent A handed a task to Agent B. The send returned \`ok: true\`. Agent B never did anything.
The task just... evaporated. No error anywhere.*

## The symptom

In a multi-agent system, work moves by one agent messaging another — over Slack, a webhook, a
queue. The sender gets a success response. The receiver never acts. Because there's no error
and the sender "succeeded," nobody notices until the dropped task surfaces as a missed
commitment days later. Multi-agent handoffs fail *silently* far more often than they fail
loudly, and silent failure is the expensive kind.

## What's actually happening

**1. Delivery ≠ addressing.** Many chat platforms only route a message to a bot's event queue
if the bot is *mentioned by its stable ID*. Post the same message with a plain \`@name\` and the
API cheerfully returns \`ok: true\` — the message posted fine — but no mention event fires, so
the receiving agent's webhook never gets it. The handoff sits in a channel, visible to humans,
invisible to the machine it was meant for. **\`ok: true\` means "posted," not "delivered to the
agent."** Those are different claims and only one of them matters.

**2. Dedup keys that fan out or collapse.** Event pipelines dedup by a key. Get the key's
granularity wrong and you get one of two failures. Too *coarse* (e.g. keyed only on repo) and
distinct events collapse into one — later handoffs get swallowed as "duplicates." Too *fine*
(e.g. keyed on event + check-name + timestamp) and a single logical event fans out into N jobs
that flood a fixed-slot worker pool until it wedges and stops accepting anything. The dedup key
must match *the distinct actionable unit* — no more, no less.

**3. The self-loop.** Agent B's action emits an event that Agent B is also subscribed to, so it
responds to itself, which emits another event, and the worker pool fills with an agent talking
to itself while real handoffs starve behind them.

## The fix

- **Verify the address token is literally in the payload before you trust the send.** Assert the
  stable mention-ID (not the display name) is present. An unanswered handoff should make you
  suspect a missing/mis-formed address *first*, before you suspect the receiver.
- **Set dedup-key granularity to the actionable unit**, then load-test it: fire the same logical
  event twice (must collapse to one) and two distinct events (must stay two).
- **Add a self-origin guard** scoped narrowly — filter only the specific self-emitted event
  class, so the agent stops answering itself without going deaf to real cross-agent traffic.
- **Track handoffs as commitments with a receipt**, not fire-and-forget. If B doesn't ack within
  a window, the handoff is *failed*, not *done* — and something should say so.

## The takeaway

A success response from the *transport* is not confirmation the *recipient* got the work. In
distributed and multi-agent systems, "the API said 200" is the beginning of verification, not
the end. Treat every handoff as an open loop until the receiver acknowledges — and alert on
loops that don't close.

> Silent drops are, again, a *you-find-out-late* failure. A receipt-and-timeout on every handoff
> is the same shape of fix as a liveness check on every job. `;

export default function AtlasChapter2() {
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
