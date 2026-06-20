---
title: "BareClaude: A Personal Agentic OS"
subtitle: "Designing and operating a 19-agent autonomous fleet for engineering and life ops"
date: "2026-05-28"
tags: ["AI Systems", "Multi-Agent", "Architecture", "Infrastructure", "Claude API"]
status: "production"
---

# BareClaude: A Personal Agentic OS

## Why Build an Agent OS?

Every major AI tooling vendor — Anthropic, OpenAI, Google, Cursor, Windsurf — is converging on the same capability surface: persistent memory, background scheduling, tool connections, sub-agent delegation. The tools are homogenizing. What differentiates a practitioner isn't which tool they pick; it's the **system they build underneath**.

That system is what I call an Agentic OS: a structured collection of identity files, context libraries, skill definitions, memory tiers, external connections, verification gates, and scheduled automations — almost entirely human-readable text and configuration — that any AI harness can load, run, and extend.

The compounding insight: **the first agent is hard because you're building the OS simultaneously**. The second agent inherits it. By the fifth, a new specialist ships in an afternoon rather than a weekend. I built 19 agents to validate this thesis in production.

BareClaude is that OS. It runs continuously on a Mac Mini, managing my engineering work, life operations, career, travel, finances, and more — under two principal agents (Clara and Dara) who each route work to specialist fleets.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BareClaude Fleet                         │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │  Clara Nova 💫  │         │     Dara Fox 🦊          │   │
│  │  Chief of Staff │         │  Distinguished Engineer  │   │
│  └────────┬────────┘         └──────────┬──────────────┘   │
│           │ Clara's Fleet               │ Dara's Fleet      │
│    ┌──────┼──────┐              ┌───────┼────────┐          │
│  Vesper Cadence Atlas        Nyx  Quinn  Zara  Reid          │
│  Portia  Kai  Echo           Eli  Iris  Finn  Remy Cleo      │
│    Pixel                                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           BareClaude (meta-agent)                    │  │
│  │  Configures fleet · writes CLAUDE.md · no ops scope  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  Mission     │  │    Webhook     │  │   launchd     │  │
│  │  Control     │  │    Receiver    │  │  111+ plists  │  │
│  │  :4000 (SSE) │  │    :4001       │  │               │  │
│  └──────────────┘  └────────────────┘  └───────────────┘  │
│                                                             │
│  Tailscale Funnel ─────────────────────────────────────→  │
│    /hooks/{slack,github,linear}                             │
└─────────────────────────────────────────────────────────────┘
```

**19 agents** across two principal fleets plus an isolated third agent (TARS, serving Ana on a separate principal boundary):

| Fleet | Principal | Specialists |
|---|---|---|
| Life ops | Clara Nova 💫 (Chief of Staff) | Vesper (CFO), Cadence (PM), Portia (Legal), Atlas (Travel), Kai (Career), Echo (Social), Pixel (Design) |
| Engineering | Dara Fox 🦊 (Distinguished Engineer) | Nyx (Security), Quinn (Verification), Zara (Frontend), Reid (Reliability), Eli (Backend), Iris (Data), Finn (Fullstack), Remy (QA), Cleo (Docs) |
| Standalone | TARS 🤖 | — (separate principal: Ana, not D) |

---

## The Seven-Layer Thesis

The OS is organized in seven layers, each answering a distinct question. Building bottom-up matters: each layer depends on the one below.

### Layer 1 · Identity — *Who are you?*

Every agent starts with a `CLAUDE.md` — the first file any AI harness loads before memory or prompts. A well-written identity file captures personality, voice, values, and hard rules. It's the difference between an agent that drifts and one that stays coherent across hundreds of sessions.

In BareClaude, each of the 19 agents has its own `CLAUDE.md`. Clara's establishes her as a strategic Chief of Staff who routes non-engineering work; Dara's establishes her as a Distinguished Engineer who owns PR completeness and code quality gates. Specialists inherit the fleet conventions but have narrow identity focused on their domain.

**Key design choice:** identity files stayed at the level of *behavior and authority*, not task lists or runbooks. Runbooks live in `skills/`; identity defines what the agent *is* and what it will never do.

### Layer 2 · Context — *What do you know?*

Context is the library an agent reaches for on demand — organizational structure, surface-specific quirks, stakeholder profiles, architecture decisions. Without it, agents give generic answers. With it, they answer correctly without being re-briefed.

Each agent maintains `.claude/references/` — 5–10 focused one-page files. Fleet-wide references live in `infra/references/` and are symlinked into each agent. Canonical references that proved load-bearing:

- `d-profile.md` — principal identity, communication style, Standing Authority Tiers
- `severity-rubric.md` — fleet-wide P0/P1/P2/P3 escalation thresholds (shared across all 19 agents)
- `cross-fleet-boundaries.md` — which agent owns which surface; prevents duplication
- `doc-coverage-matrix.md` (Cleo) — per-repo documentation requirements

Context curation became a practice, not a project: every time an agent needed re-briefing, that was a gap in a reference file.

### Layer 3 · Skills — *How do you work?*

Skills are reusable instruction sets. The pattern:

```
When <trigger>, do <process> using <sources> and produce output in <format>.
```

Each agent has `.claude/skills/` with 5–15 workflow definitions. Skills that proved highest-leverage:

- `readme-refresh` (Cleo) — weekly doc-drift detection and authoring fixes
- `release-notes-compose` (Cleo) — CHANGELOG entry from merged PRs between two tags
- `pr-digest` (Dara) — daily summary of open PRs across 21 org repos
- `linear` (all engineering agents) — Linear workspace operations via the bot-actor wrapper
- `dreaming` (all 19) — nightly pattern synthesis across memory tiers

**Architecture note:** the Linear skill is a real directory under Dara and Clara; all 16 specialists get a symlink to their fleet leader's copy. This keeps skill definitions in one place while making them available to every agent that needs them.

### Layer 4 · Memory — *What persists between sessions?*

Memory is where most agent systems underinvest. BareClaude runs a **four-tier model** across all 19 agents:

| Tier | Path | Purpose |
|---|---|---|
| 1 · Telemetry | `<slug>/.state/` | Machine events — JSONL streams, per-fire run logs, audit trails |
| 2 · Daily reflection | `<slug>/memory/YYYY-MM-DD.md` | Agent-voiced narrative observations from notable sessions |
| 3 · Distilled patterns | `<slug>/memory/dreams/YYYY-MM-DD.md` | Cross-day synthesis written by the nightly dreaming cron |
| 4a · Knowledge graph | `Obsidian/<Agent>/` | Decisions, domain knowledge, vault-synced session archives |
| 4b · Self-model | `~/.claude/projects/.../memory/` | Auto-memory loaded by Claude Code harness on relevance |

**The dreaming cron** is the key integration point: every night between 02:00 and 02:57 MT (staggered 3 minutes per agent in registry order), each agent reads all four tiers for the last 24 hours, distills patterns, and writes a "dream" to tier 3 and tier 4a. This keeps the long-lived knowledge graph current without manual intervention.

Tier separation is enforced by convention: telemetry never narrates, reflection never enumerates, dreams compress rather than restate.

### Layer 5 · Connections — *What can you reach?*

Early in the project I registered MCP servers for Slack, GitHub, Linear, Gmail, and Calendar. By 2026-05-06 I had decommissioned all of them: **zero invocations against thousands of shell-CLI calls**. The MCPs added connection overhead and authentication complexity without adding capability.

The surviving connections model:

```
Slack     → slack-post.sh      (per-agent bot token, age-encrypted)
GitHub    → git-agent.sh       (per-agent GitHub App, per-invocation token mint)
           gh-app-token.sh
Linear    → linear-as-<agent>  (per-agent bot UUID, delegateId for assignments)
Gmail     → /opt/homebrew/bin/gog gmail
Calendar  → /opt/homebrew/bin/gog calendar
Notion    → notion-as-<agent>  (only for agents that use it)
Telegram  → telegram-send.sh   (clara + dara + tars only)
```

All tokens are age-encrypted at rest under `<agent>/.credentials/` and `infra/credentials/`, decrypted per-invocation. GitHub App tokens are minted fresh on every git or `gh` call — no long-lived token ever touches memory or logs.

**Least-privilege from day one:** each agent's GitHub App is installed only on repos relevant to its scope. Read-only scopes until behavior was proven.

### Layer 6 · Verification — *How do you know it's right?*

Each skill carries 3–5 exit checks. The pattern: verification is built into the skill, not bolted on after.

For the documentation surface (Cleo), the verification gate before handing a PR back is:
1. All code examples compile or run if applicable
2. Internal links resolve
3. Formatting renders correctly in Markdown preview
4. PR diff touches only documentation files (no application code)

Fleet-level verification runs via `infra/scripts/fleet-watchdog.sh` every 5 minutes:

```bash
GET 127.0.0.1:4000/api/health       # Mission Control alive?
launchctl print bareclaude.*         # Any plists with non-zero last exit?
<agent>/.state/queue/worker.heartbeat  # Queue workers current?
<agent>/.state/slack-listener.heartbeat  # Listeners alive?
```

**The watchdog caught a real production incident:** Clara's Slack WebSocket was silently evicted by Slack — process alive, TCP socket `ESTABLISHED`, but no events delivered for 27 minutes. The original watchdog probed the daemon (fire queue) but not the listener. We instrumented heartbeat threads into every listener process, extended the watchdog to check freshness, and wired auto-restart. Silent failures became detectable failures, then self-healing ones.

### Layer 7 · Automations — *What runs when you're not watching?*

Each agent has a `launchd/` directory with plists carrying the `bareclaude.<agent>.<job>` label scheme. The Mac Mini runs these unattended; `~/Library/LaunchAgents` symlinks to each agent's source of truth.

**Why launchd and not Kubernetes or Docker?**

The fleet lives on a single Mac Mini that's already the principal workstation. The marginal cost of a launchd plist is near zero; the overhead of a container runtime for 111 scheduled jobs would be substantial for no resilience gain. launchd gives `KeepAlive`, retry-on-failure, start intervals, and integration with TCC keychain permissions — which was non-negotiable because agents need macOS keychain access for certain credential operations.

**Agent lifecycle:** agents don't run as long-lived processes. They run as tmux daemon sessions that the launchd crons dispatch into via `tmux send-keys`. This means:
1. Each cron fire is isolated — a crashed session doesn't affect other running agents
2. Terminal-rooted shells inherit TCC keychain permissions (launchd sessions do not)
3. `~/.zprofile` auto-starts all agent daemon sessions on Terminal launch, so reboots self-heal

---

## Key Architectural Decisions

### Decision 1: BareClaude as a Non-Operator Meta-Agent

**The problem:** A single "manager agent" with operational scope is a blast-radius liability. If BareClaude (the configuration layer) had Slack write access and Linear write access, a reasoning error in configuration work could produce unintended posts or issues.

**The decision:** BareClaude has *zero* operational scope. No Slack, no GitHub operator actions, no Linear, no Telegram, no Notion writes. She configures the fleet and delegates via a canonical script:

```bash
./infra/scripts/delegate-to-clara.sh "<prompt for Clara>" "<reason>"
```

Every delegation is auditable: it lands in `infra/.state/delegation.log` (gitignored) and in Clara's queue history. The separation means a bug in configuration reasoning can't accidentally post to #general or file an issue.

**The tradeoff:** delegation adds latency. A BareClaude decision that needs a Slack announcement goes BareClaude → delegation script → Clara queue → Clara session → Slack. For most configuration work this is fine. For urgent escalations it's a friction point worth accepting.

### Decision 2: Identity Isolation via Per-Agent GitHub Apps

**The problem:** Early in the project, 25 agent-signed code comments and 7 pull requests were created under D's personal GitHub identity. Root cause: `GH_TOKEN=$(...) && gh ...` is shell-local assignment; without `export`, `gh` falls back to the macOS keychain and posts as D.

**The decision:** Each agent gets its own GitHub App installation with its own bot identity. `git-agent.sh <agent>` sets `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` and exports `GH_TOKEN` — all in a single invocation. No bare `git commit` or `git push` anywhere in the fleet.

The result: every git operation is unambiguously agent-authored. `dara-fox[bot]` opened this PR. Audit trails are clean. Bot identity doesn't bleed into D's personal activity feed.

**The lesson:** identity hygiene is a hard requirement, not a nice-to-have. Even one unintended post under D's name in a technical review context undermines trust.

### Decision 3: Webhook Cutover — Hard Cut, Not Dual-Write

**The problem:** 18 agents were listening for Slack events via Socket Mode — a persistent WebSocket connection per agent. This meant 18 long-running Python processes, 18 xapp tokens, and silent failure when Slack evicted connections without notification.

**The decision (2026-05-02):** Hard cut to the Events API webhook model. A single webhook receiver at `bareclaude.webhook-receiver` on `:4001` accepts all Slack events for all agents, demuxes by `api_app_id` (from `infra/agents/registry.json`), and dispatches to the appropriate agent queue. Socket Mode processes killed, xapp tokens deprecated.

**Why hard cut over dual-write?** Dual-write would have required maintaining 18 socket listeners *and* the webhook receiver simultaneously — double the failure surface during the transition window. The risk of the hard cut (a brief gap) was lower than the operational complexity of running both. We scheduled the cut for a low-traffic window, verified all agent `api_app_id` mappings before executing, and had a rollback plan ready. The cut completed without incident.

**The architectural benefit:** the webhook receiver became the single place to add dedup logic, self-loop guards, semantic event keys, and routing rules. Adding a new agent is a registry entry, not a new Python process.

### Decision 4: MCPs Decommissioned for Shell Wrappers

**The decision:** After measuring invocation rates, we decommissioned all MCP servers (Slack, GitHub, Linear, Gmail, Calendar). Every surface is accessed via shell wrappers instead.

**Why shell wrappers win in this context:**

- **Token hygiene:** shell wrappers mint tokens per-invocation from age-encrypted vault; MCPs required persistent token configuration
- **Invocation clarity:** `slack-post.sh post #engineering "msg" dara` is unambiguous; MCP tool calls required inspecting schema to understand routing
- **No runtime dependency:** MCPs require a running server process; shell wrappers are stateless
- **Easier auditing:** every shell wrapper call appears in bash history and `.state/activity.jsonl`; MCP calls were harder to trace

The only surviving MCPs are Clara's `damilola-tech` career-signal server and Vesper's `monarch-money` finance server — both custom-built, no generic alternatives exist.

### Decision 5: Four-Tier Memory Over a Single Store

**The problem:** Agents that use a single memory store conflate ephemeral telemetry with long-lived decisions. The result: important decisions get buried in noise, and nightly indexing jobs have to infer meaning from undifferentiated logs.

**The decision:** explicit tier separation with strict non-overlap invariants. Tier 1 (telemetry) is machine-written JSONL — never narrates. Tier 2 (daily reflection) is agent-voiced prose — never enumerates states or lists. Tier 3 (distilled patterns) compresses across multiple days — never restates tier 2. Tier 4 is the long-lived layer.

**Why this matters for the dreaming cron:** nightly dreaming reads all four tiers and writes to tier 3 and tier 4a. If tier 1 contained narrative and tier 2 contained enumerated states, the dreaming cron would have to disambiguate format-by-inference rather than format-by-contract. Strict separation means the cron reads structured telemetry (time-indexed events) for the "what happened" dimension and agent prose (reflection) for the "what mattered" dimension — two inputs that are genuinely complementary.

### Decision 6: Model Topology by Role

**The architecture:** two axes for model assignment — CLI sessions and cron queue sessions.

| Axis | Clara / Dara | Specialists | Haiku gate |
|---|---|---|---|
| CLI (`settings.json`) | Opus | Sonnet | — |
| Cron queue | Sonnet + advisor | Sonnet | Mechanical-only jobs |

Principals (Clara, Dara) use Opus for CLI sessions because they make architectural decisions, route work across the fleet, and operate on irreversible surfaces (Slack, Linear, GitHub). Specialists use Sonnet — narrower scope, more constrained authority.

The Haiku gate handles pure mechanical work: queue-depth checks, heartbeat writes, log rotation. Running Opus or Sonnet for "is there anything in the queue?" is wasteful. Shell-gate pattern: before firing any LLM session, check a condition that can be evaluated in bash. If the gate fails, exit without invoking Claude at all.

**The constraint that forced this:** Sonnet weekly cap hit 96% in May 2026. Structural cuts reduced scheduled fires from 361 to 124 per 48-hour window (66% reduction) — not by removing capability, but by routing mechanical work to the correct tier.

---

## Infrastructure Deep Dive

### Runtime Model

```
Mac Mini (always-on, Boulder CO)
├── launchd (111 active plists, bareclaude.* namespace)
│   ├── bareclaude.clara.heartbeat        — every 30 min
│   ├── bareclaude.dara.pr-digest         — 8× daily
│   ├── bareclaude.cleo.dreaming          — 02:12 MT nightly
│   ├── bareclaude.reid.fleet-watchdog    — every 5 min
│   ├── bareclaude.webhook-receiver       — KeepAlive daemon
│   └── bareclaude.dashboard              — KeepAlive daemon
│
├── tmux sessions (Terminal-rooted, TCC-inherited)
│   ├── clara-daemon     — drains .state/queue/, runs claude -p
│   ├── clara-telegram   — claude --channels (Telegram DMs)
│   ├── dara-daemon      — drains .state/queue/, runs claude -p
│   └── ... (one daemon per agent)
│
├── Mission Control (Next.js 15, :4000)
│   ├── /api/health         — watchdog probe target
│   ├── /api/sse            — SSE stream: fleet state, sessions, cron fires
│   ├── SQLite (better-sqlite3) — derived from agent .state/ directories
│   └── Tailscale serve → /bareclaude on tailnet
│
└── Webhook Receiver (Node.js, :4001)
    ├── /api/webhooks/slack   — Slack Events API, demux by api_app_id
    ├── /api/webhooks/github  — GitHub org webhooks, issue+PR routing
    └── /api/webhooks/linear  — Linear Issue+Comment, self-loop guard
        Tailscale Funnel → public HTTPS (:8443)
```

### Mission Control SSE Architecture

The dashboard is built on Server-Sent Events rather than WebSockets. Rationale: fleet state updates are server-push only (no client-to-server data needed), SSE reconnects automatically on network interruption, and the `hello` event with `{ts, startedAt}` lets the client detect server restart and trigger a full reload without a polling loop.

The `startedAt` field on every `hello` message is load-bearing: if the client sees a different `startedAt` than it stored on connection, it knows the server restarted and re-fetches the full state snapshot. Drop `startedAt` and the client silently misses server restarts.

### Tailscale Topology

All internal services are Tailscale-only. The webhook receiver punches a Funnel hole for the three public webhook paths (`/hooks/slack`, `/hooks/github`, `/hooks/linear`). Everything else — dashboard, agent APIs, SSH — is tailnet-only. No open ports, no exposed services.

`infra/tailscale/serve.sh up|down|verify|repair|status` is a declarative converger driven by `infra/tailscale/routes.json`. The `verify` verb exits 0/1 and is the watchdog probe for Tailscale drift. The `repair` verb cycles `tailscale down/up` and re-applies routes — used after the 2026-05-04 incident where Tailscale serve state became stale without notifying the daemon.

**Footgun discovered in production:** `tailscale serve --https 443 off` removes *all* HTTPS serving on port 443, not just the path specified. The correct pattern is `--set-path /specific-path off`. This took the dashboard offline during a cleanup operation. The `serve.sh` wrapper enforces the per-path pattern.

---

## Concrete Outcomes

### Scale

| Metric | Value |
|---|---|
| Agents in fleet | 19 |
| Active launchd plists | 111 |
| Scheduled fires / 48h | ~124 (optimized from 361) |
| Org repos with bot identity | 21 |
| GitHub issues migrated to Linear | 53 (single operation) |
| Memory tiers per agent | 4 |
| Nightly dreaming window | 02:00–02:57 MT (19 agents, 3-min stagger) |
| Webhook events demuxed / day | All fleet Slack + GitHub + Linear events |

### Operational Incidents Caught and Resolved

1. **Silent WebSocket eviction** — Clara's Slack listener alive (process + TCP socket ESTABLISHED) but delivering zero events for 27 minutes. Fixed by instrumenting heartbeat threads into all listener processes and extending the watchdog to probe freshness rather than just process existence.

2. **GitHub identity leak** — 25 agent-signed code comments and 7 PRs created under D's personal identity due to non-exported `GH_TOKEN`. Fixed by the `git-agent.sh` wrapper that atomically sets commit identity and exports the token in a single invocation.

3. **Tailscale serve port nuke** — `tailscale serve --https 443 off` took the dashboard offline. Fixed by `serve.sh` declarative converger that enforces per-path `--set-path` semantics.

4. **Queue worker lock leak** — `set -e` caused subshell exit mid-`mv`, skipping the `release_key_lock` trap, leaving per-key locks leaked. Symptom: queue showing pending jobs that never drain. Fixed by moving the lock release into an `EXIT` trap that fires regardless of subshell exit mode.

5. **Dreaming cron missing from 3 agents** — Pixel, Portia, and Zara had zero provisioned plists after the Phase 1 bring-up (MC showed `jobsConfigured: 0`). Root cause: the install script hadn't been run after `launchctl unload/load` cycle. Fixed by adding `launchctl bootstrap gui/$UID` to the installer and re-running.

### Engineering Leverage

The case for the OS model is compounding leverage:

- **Agent 1 (Clara):** ~40 hours to build identity, context, skills, memory, connections, verification, and automation scaffold
- **Agent 2 (Dara):** ~16 hours — inherited OS conventions, only needed engineering-specific identity and context
- **Agents 3–10 (Clara's fleet):** ~4–8 hours each — identity + 2–3 context files + 3–5 skills; OS scaffold is copy-paste
- **Agents 11–19 (Dara's fleet):** ~2–4 hours each — same pattern, even narrower scope

The last specialist brought up (Cleo) took an afternoon from blank identity to PR-opening CI-green agent. The OS paid for itself by the third agent.

---

## What This Demonstrates

**System design at fleet scale.** Designing 19 agents to share infrastructure without coupling their operational concerns — identity isolation, per-agent authority, shared memory model, common scheduling primitives — is the same problem as designing a microservices platform. The constraints are different (low latency isn't the problem; session isolation and token hygiene are), but the architectural muscles are identical.

**Incident discipline.** Every production failure in the fleet produced a written post-mortem, a root-cause analysis traceable to a file and line, and a code fix. The watchdog architecture grew from five real incidents, not speculative requirements.

**Tradeoff reasoning.** Hard-cut over dual-write for the webhook migration. Shell wrappers over MCPs after measuring actual invocation rates. launchd over Docker for a single-machine, TCC-dependent workload. Model tier selection by role rather than capability ceiling. These decisions have explicit rationale that could be revisited if the constraints change.

**Portability thesis.** The entire OS is human-readable text and shell scripts. No proprietary runtime. No vendor lock-in. If Anthropic shipped a new harness tomorrow that reads `CLAUDE.md` and `.claude/`, the fleet would run on it unchanged. If a better scheduling primitive replaced launchd, the identity, context, skills, and memory layers survive the migration.

---

*BareClaude is a private repository. Architecture questions, decision records, and the Mission Control dashboard are available to discuss in an interview context.*
