import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadDenylist,
  resolveSources,
  scanText,
} from "../../scripts/anti-circumvention/check";

const DENYLIST_PATH = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "anti-circumvention",
  "denylist.json",
);
const REPO_ROOT = path.join(__dirname, "..", "..");

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function normalizeLine(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

describe("anti-circumvention-check", () => {
  it("current public source files scan clean against the real denylist", () => {
    const denylist = loadDenylist(DENYLIST_PATH);
    const files = resolveSources(denylist.sources, REPO_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((rel) => {
      const text = readFileSync(path.join(REPO_ROOT, rel), "utf8");
      return scanText(rel, text, denylist);
    });

    expect(violations).toEqual([]);
  });

  it("does not flag legitimate mentions of employer names with no bypass/scrape language nearby", () => {
    // Uses a synthetic denylist (not the real employer hashes) so this test
    // never needs a real company name near circumvention language.
    const denylist = {
      circumventionPatterns: ["bypass(es|ing)?\\s+[\\s\\S]{0,40}?auth[- ]?wall"],
      scrapeVerbPattern: "scrap(e|es|ed|ing)|bypass(es|ed|ing)?|target(s|ed|ing)?",
      employerTokens: {
        proximityWindowTokens: 5,
        hashes: [sha256(normalizeToken("wonderco"))],
      },
      goldenRegression: { hashes: [] },
      allowlist: [],
      sources: [],
    };

    const benign = "I built a consulting case study for Wonderco last year.";
    expect(scanText("synthetic.tsx", benign, denylist as never)).toEqual([]);
  });

  it("flags a company name found within the proximity window of a scrape/bypass verb", () => {
    const denylist = {
      circumventionPatterns: [],
      scrapeVerbPattern: "scrap(e|es|ed|ing)|bypass(es|ed|ing)?|target(s|ed|ing)?",
      employerTokens: {
        proximityWindowTokens: 5,
        hashes: [sha256(normalizeToken("wonderco"))],
      },
      goldenRegression: { hashes: [] },
      allowlist: [],
      sources: [],
    };

    const dangerous = "A scraper that targets Wonderco job postings directly.";
    const violations = scanText("synthetic.tsx", dangerous, denylist as never);
    expect(violations.some((v) => v.kind === "employer-proximity")).toBe(true);
  });

  it("does not flag the HTML target=\"_blank\" attribute as a scrape/target verb, but still flags prose 'targets'", () => {
    const denylist = {
      circumventionPatterns: [],
      scrapeVerbPattern:
        "scrap(e|es|ed|ing)|bypass(es|ed|ing)?|target(s|ed|ing)?(?!=)",
      employerTokens: {
        proximityWindowTokens: 20,
        hashes: [sha256(normalizeToken("wonderco"))],
      },
      goldenRegression: { hashes: [] },
      allowlist: [],
      sources: [],
    };

    const benign =
      '<a href="https://example.com/wonderco" target="_blank" rel="noopener noreferrer">Live Demo</a>';
    expect(scanText("synthetic.tsx", benign, denylist as never)).toEqual([]);

    const dangerous = "A scraper that targets Wonderco job postings directly.";
    const violations = scanText("synthetic.tsx", dangerous, denylist as never);
    expect(violations.some((v) => v.kind === "employer-proximity")).toBe(true);
  });

  it("flags a generic circumvention-language pattern independent of any employer", () => {
    const denylist = {
      circumventionPatterns: ["bypass(es|ing)?\\s+[\\s\\S]{0,40}?auth[- ]?wall"],
      scrapeVerbPattern: "scrap(e|es|ed|ing)|bypass(es|ed|ing)?",
      employerTokens: { proximityWindowTokens: 5, hashes: [] },
      goldenRegression: { hashes: [] },
      allowlist: [],
      sources: [],
    };

    const dangerous = "This tool bypasses the auth wall on most job boards.";
    const violations = scanText("synthetic.tsx", dangerous, denylist as never);
    expect(
      violations.some((v) => v.kind === "circumvention-pattern"),
    ).toBe(true);
  });

  it("golden-regression fires on an exact (normalized) reintroduction and not otherwise", () => {
    const goldenSentence = "a synthetic removed sentence used only for this test";
    const denylist = {
      circumventionPatterns: [],
      scrapeVerbPattern: "no-match-xyz",
      employerTokens: { proximityWindowTokens: 5, hashes: [] },
      goldenRegression: { hashes: [sha256(normalizeLine(goldenSentence))] },
      allowlist: [],
      sources: [],
    };

    const reintroduced = `      "${goldenSentence}",`;
    const clean = "a completely unrelated line of copy";

    expect(
      scanText("synthetic.tsx", reintroduced, denylist as never).some(
        (v) => v.kind === "golden-regression",
      ),
    ).toBe(true);
    expect(scanText("synthetic.tsx", clean, denylist as never)).toEqual([]);
  });

  it("respects an allowlist entry", () => {
    const denylist = {
      circumventionPatterns: ["circumvent(s|ing)?"],
      scrapeVerbPattern: "no-match-xyz",
      employerTokens: { proximityWindowTokens: 5, hashes: [] },
      goldenRegression: { hashes: [] },
      allowlist: [{ pattern: "circumventing legacy CSS specificity" }],
      sources: [],
    };

    const line = "This hook works by circumventing legacy CSS specificity issues.";
    expect(scanText("synthetic.tsx", line, denylist as never)).toEqual([]);
  });

  it("resolveSources resolves an exact file, a recursive filename filter, and a recursive dir", () => {
    const denylist = loadDenylist(DENYLIST_PATH);
    const files = resolveSources(denylist.sources, REPO_ROOT);
    expect(files).toContain("src/lib/projects-data.ts");
    expect(files.some((f) => f.endsWith("page.tsx"))).toBe(true);
  });
});
