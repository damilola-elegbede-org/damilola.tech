/**
 * Generate Resume JSON
 *
 * Syncs career-data/data/resume-full.json from src/lib/resume-data.ts.
 *
 * Mapping rules:
 * - tagline            ← resumeData.tagline
 * - experience[i].responsibilities ← resumeData.experiences[i].highlights
 * - skills "Programming & Data" items ← add JavaScript/TypeScript if missing
 * - skillsAssessment.proficient ← add JavaScript/TypeScript if missing; remove from familiar
 *
 * Fields preserved as-is from resume-full.json (not in resume-data.ts):
 * - phone, website, summary (richer than brandingStatement)
 * - experience[i].description
 * - education year, focus
 * - targetRoles (resume-full.json has a curated short list)
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { resumeData } from '../src/lib/resume-data';

const JSON_PATH = join(process.cwd(), 'career-data/data/resume-full.json');
const existing = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

// ── 1. Sync tagline ────────────────────────────────────────────────────────────
const tagline = resumeData.tagline;

// ── 2. Sync experience responsibilities ────────────────────────────────────────
// Experiences in both arrays are in the same order (chronologically descending).
// If counts differ, fall back to existing for extras.
type ExistingExperience = {
  company: string;
  title: string;
  location: string;
  dates: string;
  description: string;
  responsibilities: string[];
};

const experience: ExistingExperience[] = existing.experience.map(
  (exp: ExistingExperience, idx: number) => {
    const newExp = resumeData.experiences[idx];
    if (!newExp) return exp;
    return {
      ...exp,
      responsibilities: newExp.highlights,
    };
  }
);

// ── 3. Sync skills: add JavaScript/TypeScript to Programming & Data ──────────
type SkillCategory = { category: string; items: string[] };

const skills: SkillCategory[] = existing.skills.map((cat: SkillCategory) => {
  if (cat.category === 'Programming & Data') {
    const items = cat.items.includes('JavaScript/TypeScript')
      ? cat.items
      : [...cat.items, 'JavaScript/TypeScript'];
    return { ...cat, items };
  }
  return cat;
});

// ── 4. Sync skillsAssessment: move JS/TS to proficient ────────────────────────
type SkillsAssessment = {
  expert: string[];
  proficient: string[];
  familiar: string[];
};

const sa: SkillsAssessment = existing.skillsAssessment;
const TARGET_SKILL = 'JavaScript/TypeScript';

const skillsAssessment: SkillsAssessment = {
  expert: sa.expert,
  proficient: sa.proficient.includes(TARGET_SKILL)
    ? sa.proficient
    : [...sa.proficient, TARGET_SKILL],
  familiar: sa.familiar.filter((s: string) => s !== TARGET_SKILL),
};

// ── 5. Assemble ────────────────────────────────────────────────────────────────
const result = {
  ...existing,
  tagline,
  experience,
  skills,
  skillsAssessment,
};

writeFileSync(JSON_PATH, JSON.stringify(result, null, 2) + '\n');
console.log('✅  Generated career-data/data/resume-full.json');
