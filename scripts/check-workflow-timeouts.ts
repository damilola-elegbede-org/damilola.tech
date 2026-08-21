#!/usr/bin/env tsx
// ENG-1952 — every job in .github/workflows/*.yml must carry an explicit
// timeout-minutes. GitHub's default is 360 minutes: a single hung step (a
// real incident on 2026-08-19, PR#226 — `playwright install` hung for 26
// minutes with no progress) can otherwise hold a runner for up to six hours,
// and a wedged workflow makes a green PR look unfinished (the checks list
// just omits the job rather than reporting it pending).
//
// Deliberately dumb and deterministic: a line-based scan of each job block
// for a `timeout-minutes:` key at the job's own indentation, not a full YAML
// parse — the same "no LLM judge" posture as scripts/anti-circumvention/check.ts.
// A reusable workflow invoked with `uses:` (no `runs-on:` of its own) is not a
// job that can carry timeout-minutes locally and is skipped.
//
// Usage: tsx scripts/check-workflow-timeouts.ts [--json]
// Exit 0 = every job has timeout-minutes. Exit 1 = one or more are missing.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const WORKFLOWS_DIR = path.join(REPO_ROOT, ".github", "workflows");

export interface Violation {
  file: string;
  job: string;
  line: number;
}

// A job line looks like "  job-id:" (2-space indent) directly under "jobs:".
// Its own keys (runs-on, timeout-minutes, uses, steps, ...) sit one level
// deeper — 4 spaces in every workflow in this repo. We track the deeper
// indent as "job body" and end the job when a line returns to <=2-space
// indent (the next job, or the file/section ending).
export function checkWorkflowSource(file: string, source: string): Violation[] {
  const lines = source.split("\n");
  const violations: Violation[] = [];

  let inJobs = false;
  let currentJob: { name: string; line: number; hasTimeout: boolean; hasRunsOn: boolean } | null = null;

  const closeJob = () => {
    if (currentJob && currentJob.hasRunsOn && !currentJob.hasTimeout) {
      violations.push({ file, job: currentJob.name, line: currentJob.line });
    }
    currentJob = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, "");
    if (!inJobs) {
      if (/^jobs:\s*$/.test(line)) inJobs = true;
      continue;
    }
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const jobHeaderMatch = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(line);

    if (indent <= 0 && !line.startsWith(" ")) {
      // Back to column 0 (a new top-level key, e.g. `permissions:` after
      // `jobs:`, or EOF approaching) — jobs section is over.
      closeJob();
      inJobs = false;
      continue;
    }
    if (indent === 2 && jobHeaderMatch) {
      closeJob();
      currentJob = { name: jobHeaderMatch[1], line: i + 1, hasTimeout: false, hasRunsOn: false };
      continue;
    }
    if (currentJob && indent >= 4) {
      if (/^\s{4}timeout-minutes:/.test(line)) currentJob.hasTimeout = true;
      if (/^\s{4}runs-on:/.test(line)) currentJob.hasRunsOn = true;
    }
  }
  closeJob();

  return violations;
}

export function checkAllWorkflows(dir: string = WORKFLOWS_DIR): Violation[] {
  const violations: Violation[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const filePath = path.join(dir, name);
    const source = readFileSync(filePath, "utf8");
    violations.push(...checkWorkflowSource(name, source));
  }
  return violations;
}

function main() {
  const violations = checkAllWorkflows();
  const asJson = process.argv.includes("--json");

  if (violations.length === 0) {
    if (asJson) console.log(JSON.stringify({ ok: true, violations: [] }));
    else console.log("OK: every workflow job carries timeout-minutes.");
    process.exit(0);
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: false, violations }));
  } else {
    console.error(`FAIL: ${violations.length} job(s) missing timeout-minutes:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} — job "${v.job}"`);
    }
  }
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
