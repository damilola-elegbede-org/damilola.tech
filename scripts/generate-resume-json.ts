/**
 * Generate Resume JSON
 *
 * Syncs career-data/data/resume-full.json from src/lib/resume-data.ts.
 *
 * Mapping rules:
 * - tagline            ← resumeData.tagline
 * - experience[i].responsibilities ← resumeData.experiences[i].highlights
 * - skills "Programming" items ← add JavaScript/TypeScript if missing
 * - skillsAssessment.proficient ← add JavaScript/TypeScript if missing; remove from familiar
 *
 * Fields preserved as-is from resume-full.json (not in resume-data.ts):
 * - phone, website, summary (richer than brandingStatement)
 * - experience[i].description
 * - education year, focus
 * - targetRoles (resume-full.json has a curated short list)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";
import { resumeData } from "../src/lib/resume-data";

export const JSON_PATH = join(
  process.cwd(),
  "career-data/data/resume-full.json",
);
export const TARGET_SKILL = "JavaScript/TypeScript";

type ExistingExperience = {
  company: string;
  title: string;
  location: string;
  dates: string;
  description: string;
  responsibilities: string[];
};

type SkillCategory = { category: string; items: string[] };

type SkillsAssessment = {
  expert: string[];
  proficient: string[];
  familiar: string[];
};

type ExistingResumeJson = {
  tagline: string;
  experience: ExistingExperience[];
  skills: SkillCategory[];
  skillsAssessment: SkillsAssessment;
  [key: string]: unknown;
};

export function generateResumeJson(
  existing: ExistingResumeJson,
): ExistingResumeJson {
  // ── 1. Sync tagline ──────────────────────────────────────────────────────────
  const tagline = resumeData.tagline;

  // ── 2. Sync experience responsibilities ──────────────────────────────────────
  // Key-based lookup using company::title composite key to avoid silent
  // misassignment when arrays are reordered.
  const sourceByRole = new Map(
    resumeData.experiences.map(
      (exp) => [`${exp.company}::${exp.title}`, exp.highlights] as const,
    ),
  );

  const experience: ExistingExperience[] = existing.experience.map(
    (exp: ExistingExperience) => {
      const highlights = sourceByRole.get(`${exp.company}::${exp.title}`);
      return highlights ? { ...exp, responsibilities: highlights } : exp;
    },
  );

  // ── 3. Sync skills: add JavaScript/TypeScript to Programming ─────────────────
  const skills: SkillCategory[] = existing.skills.map((cat: SkillCategory) => {
    if (cat.category === "Programming") {
      const items = cat.items.includes(TARGET_SKILL)
        ? cat.items
        : [...cat.items, TARGET_SKILL];
      return { ...cat, items };
    }
    return cat;
  });

  // ── 4. Sync skillsAssessment: move JS/TS to proficient ───────────────────────
  const sa: SkillsAssessment = existing.skillsAssessment;

  const skillsAssessment: SkillsAssessment = {
    expert: sa.expert,
    proficient: sa.proficient.includes(TARGET_SKILL)
      ? sa.proficient
      : [...sa.proficient, TARGET_SKILL],
    familiar: sa.familiar.filter((s: string) => s !== TARGET_SKILL),
  };

  // ── 5. Assemble ───────────────────────────────────────────────────────────────
  return {
    ...existing,
    tagline,
    experience,
    skills,
    skillsAssessment,
  };
}

export function readExistingResumeJson(
  jsonPath: string = JSON_PATH,
): ExistingResumeJson {
  if (!existsSync(jsonPath)) {
    throw new Error(`Local file not found: ${jsonPath}`);
  }
  const content = readFileSync(jsonPath, "utf-8");
  return JSON.parse(content) as ExistingResumeJson;
}

function readExistingResumeJsonOrSkip(
  jsonPath: string = JSON_PATH,
): ExistingResumeJson | null {
  if (existsSync(jsonPath)) {
    return readExistingResumeJson(jsonPath);
  }

  // Submodule not available (CI/Vercel) — skip gracefully
  console.log(
    `⏭ Skipping resume-json generation: ${jsonPath} not found (submodule not available).`,
  );
  console.log(
    `  This is expected on Vercel builds. Run locally with submodule to regenerate.`,
  );
  return null;
}

export function writeResumeJson(
  result: ExistingResumeJson,
  jsonPath: string = JSON_PATH,
): void {
  try {
    writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
    console.log(`✅ Generated ${jsonPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to write ${jsonPath}: ${message}`);
    process.exit(1);
  }
}

export function main(): void {
  const existing = readExistingResumeJsonOrSkip();
  if (!existing) return; // Submodule not available — skip
  const result = generateResumeJson(existing);
  writeResumeJson(result);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
