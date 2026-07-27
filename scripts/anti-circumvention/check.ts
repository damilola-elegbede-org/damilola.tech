#!/usr/bin/env tsx
// ENG-1603 — CI gate blocking circumvention/target-employer copy on the public site.
//
// Deliberately dumb and deterministic: a denylist regex + hash sweep over
// public-facing source files, not an LLM judge. See denylist.json for the
// rule set and why employer names / the exact removed PR#215 sentences live
// there as one-way SHA-256 hashes rather than plaintext (this is itself a
// public repo — a plaintext denylist would re-publish the exact association
// the RED-ALERT fix (PR#215) was opened to remove).
//
// Usage: tsx scripts/anti-circumvention/check.ts [--json]
// Exit 0 = clean. Exit 1 = one or more violations found.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

interface Denylist {
  circumventionPatterns: string[];
  scrapeVerbPattern: string;
  employerTokens: {
    proximityWindowTokens: number;
    hashes: string[];
  };
  goldenRegression: {
    hashes: string[];
  };
  allowlist: Array<{ pattern: string; justification: string }>;
  sources: string[];
}

export interface Violation {
  file: string;
  kind: "golden-regression" | "circumvention-pattern" | "employer-proximity";
  detail: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function normalizeLine(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isAllowlisted(line: string, allowlist: Denylist["allowlist"]): boolean {
  return allowlist.some(({ pattern }) => {
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      return new RegExp(pattern.slice(1, -1), "i").test(line);
    }
    return line.toLowerCase().includes(pattern.toLowerCase());
  });
}

export function scanText(
  filePath: string,
  text: string,
  denylist: Denylist,
): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split("\n");
  const goldenSet = new Set(denylist.goldenRegression.hashes);
  const employerSet = new Set(denylist.employerTokens.hashes);
  const scrapeVerbRe = new RegExp(denylist.scrapeVerbPattern, "i");
  const circumventionRes = denylist.circumventionPatterns.map(
    (p) => new RegExp(p, "i"),
  );

  // Whole-text token stream for the employer + scrape-verb proximity rule.
  const tokens = text.split(/\s+/).filter(Boolean);

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    if (isAllowlisted(rawLine, denylist.allowlist)) continue;

    // 1. Golden regression — exact (normalized) reintroduction of removed copy.
    // Check both the whole trimmed line AND any quoted string-literal content
    // within it (code embeds copy inside "..."/'...'/`...`, so the raw line
    // includes quotes/trailing commas the original removed sentence didn't).
    const candidates = [normalizeLine(rawLine)];
    for (const m of rawLine.matchAll(/["'`]([^"'`]{20,})["'`]/g)) {
      candidates.push(normalizeLine(m[1]));
    }
    if (candidates.some((c) => goldenSet.has(sha256(c)))) {
      violations.push({
        file: filePath,
        kind: "golden-regression",
        detail: "line hash matches an exact string removed by PR#215",
      });
      continue;
    }

    // 2. Generic circumvention-language patterns (safe to keep as plaintext
    //    regex — these don't name an employer, just security-bypass jargon).
    for (const re of circumventionRes) {
      if (re.test(rawLine)) {
        violations.push({
          file: filePath,
          kind: "circumvention-pattern",
          detail: `matched pattern: ${re.source}`,
        });
        break;
      }
    }
  }

  // 3. Structural employer-as-scrape-target check: a token whose hash is in
  //    the employer set, within N tokens of a scrape/bypass/circumvent/target
  //    verb, anywhere in the file (not line-scoped — sentences wrap).
  const window = denylist.employerTokens.proximityWindowTokens;
  for (let i = 0; i < tokens.length; i++) {
    const tokenHash = sha256(normalizeToken(tokens[i]));
    if (!employerSet.has(tokenHash)) continue;
    const lo = Math.max(0, i - window);
    const hi = Math.min(tokens.length, i + window + 1);
    const nearby = tokens.slice(lo, hi).join(" ");
    if (isAllowlisted(nearby, denylist.allowlist)) continue;
    if (scrapeVerbRe.test(nearby)) {
      violations.push({
        file: filePath,
        kind: "employer-proximity",
        detail: `a scrape/bypass/target verb appears within ${window} tokens of a flagged employer name`,
      });
    }
  }

  return violations;
}

export function loadDenylist(denylistPath: string): Denylist {
  return JSON.parse(readFileSync(denylistPath, "utf8"));
}

function walk(dir: string, root: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(abs, root));
    } else {
      out.push(path.relative(root, abs));
    }
  }
  return out;
}

// Resolves the small set of glob-like shapes used in denylist.json's
// "sources" list — deliberately not a general glob library dependency:
//   "some/exact/file.ts"        -> that file, if it exists
//   "some/dir/**/name.tsx"      -> every file named `name.tsx` under dir
//   "some/dir/**"               -> every file under dir
export function resolveSources(patterns: string[], root: string): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    if (!pattern.includes("**")) {
      if (existsSync(path.join(root, pattern))) files.add(pattern);
      continue;
    }
    const [dirPart, rest] = pattern.split("**");
    const dir = path.join(root, dirPart.replace(/\/$/, ""));
    const filenameFilter = rest.replace(/^\//, "");
    for (const rel of walk(dir, root)) {
      if (!filenameFilter || rel.endsWith(filenameFilter)) files.add(rel);
    }
  }
  return [...files];
}

async function main() {
  const denylistPath = path.join(__dirname, "denylist.json");
  const denylist = loadDenylist(denylistPath);
  const jsonOutput = process.argv.includes("--json");

  const files = resolveSources(denylist.sources, REPO_ROOT);

  const allViolations: Violation[] = [];
  for (const rel of files) {
    const abs = path.join(REPO_ROOT, rel);
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    allViolations.push(...scanText(rel, text, denylist));
  }

  if (jsonOutput) {
    console.log(JSON.stringify(allViolations, null, 2));
  } else if (allViolations.length > 0) {
    console.error(
      `anti-circumvention-check: ${allViolations.length} violation(s) found\n`,
    );
    for (const v of allViolations) {
      console.error(`  [${v.kind}] ${v.file} — ${v.detail}`);
    }
    console.error(
      "\nPublic-facing copy must not advertise bypassing employer ATS/auth systems, " +
        "or name a specific company as a scrape/bypass target. If this is a false " +
        "positive, add an allowlist entry with justification in " +
        "scripts/anti-circumvention/denylist.json.",
    );
  } else {
    console.log("anti-circumvention-check: clean — 0 violations.");
  }

  process.exit(allViolations.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
