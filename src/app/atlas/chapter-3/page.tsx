import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Metadata } from "next";

// Dark/unlinked per ENG-1417 — no nav entry, no sitemap entry, and explicitly
// de-indexed so a crawler that finds the URL some other way doesn't surface it.
export const metadata: Metadata = {
  title: "Chapter 3 — Who Are You, Really | The Failure Atlas",
  description:
    "The agent posted a message under your name, not its own. Why agents borrow the nearest identity by default, and how to enforce the boundary.",
  robots: { index: false, follow: false },
};

const CONTENT = `# Chapter 3 — Who Are You, Really

*The agent posted a message. It went out under your name, not the agent's. Nobody authorized
that — the agent just inherited whatever credential was nearest.*

## The symptom

An agent takes an action — sends an email, opens a pull request, posts to a channel, calls an
API — and it executes as the **wrong identity**. Usually the human operator's, because the
human's credentials were the ambient default. The action succeeds, which is what makes it
dangerous: an agent silently acting *as you* is worse than an agent that can't act at all,
because now there's an audit trail with your name on decisions you never made.

## What's actually happening

**1. Ambient credentials win.** When an agent shells out to a CLI (\`git\`, \`gh\`, a cloud tool),
it uses whatever token is already in the environment. If that environment was set up by a human,
the agent is now *that human*. The classic version: a command sets a token in a variable but
doesn't export it, so the sub-process falls back to the ambient human credential and every
action lands under the wrong actor — with a success exit code.

**2. Cloned config carries identity.** Cloning a repo with a human's authenticated CLI bakes
that human's short-lived token straight into the local git config and sets them as the
credential helper. Every subsequent push from that checkout is the human, forever, until
someone scrubs the config. The agent looks correctly configured and is quietly impersonating.

**3. Plugins and connectors authenticate as the installer.** Globally-installed integrations —
a chat connector, a calendar plugin, an MCP server wired to the human's account — authenticate
as the *human who authorized them*, not the agent invoking them. Prose in a config file saying
"the agent should act as itself" does not change this; only the actual credential boundary does.
Policy is not enforcement.

## The fix

- **Give every agent its own identity and its own credentials**, and make actions go through a
  wrapper that asserts the acting identity *before* the call — not the ambient default.
- **Prefer inline, scoped credentials over exported ambient ones.** \`TOKEN=$(...) command\`
  binds the credential to that one call; \`export TOKEN=...\` leaks it to everything downstream.
- **Scrub identity from cloned/inherited config** as a standard step, and verify actor identity
  with a "who am I" call (most APIs have one) at the top of any sensitive action.
- **Enforce the boundary in the permission layer, not in documentation.** If the only thing
  stopping an agent from acting as you is a sentence in a README, it will eventually act as you.

## The takeaway

Agents don't have an identity by default — they *borrow* the nearest one. In a system where
software takes real actions with real consequences, "which identity is this running as?" must be
an explicit, asserted, enforced answer at every trust boundary. Assume ambient authority is the
wrong authority until proven otherwise.

> Identity drift is a *you-find-out-late* failure too — you learn about it from the audit log
> after the fact. The pattern across this whole Atlas: instrument the boundary, and get told the
> moment it's crossed. · [Ask us about a fleet audit →](/consulting)`;

export default function AtlasChapter3() {
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
