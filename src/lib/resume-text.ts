/**
 * The résumé as plain text — the exact document ATS is allowed to score, and
 * one of the sources Fit reads.
 *
 * ENG-1996 moved this out of `readiness-scorer.ts` when that module was retired.
 * ENG-1993 widened what reaches it: `experienceTags`, the tiered
 * `skillsAssessment`, `tagline`, and each role's `location` / `startDate` /
 * `endDate` were all present in `resumeData` and silently dropped on the way to
 * the scorer.
 *
 * That drop is easy to reintroduce and hard to see, because it fails as a
 * slightly lower score rather than an error: `buildScorerResumeData()` can pass
 * a field through perfectly and the model still never reads it unless THIS
 * function renders it. Adding a field to the struct is not the same as adding it
 * to the document.
 */

/** The serialisable résumé shape shared by scoring and generation. */
export interface ResumeTextData {
  name?: string;
  title?: string;
  tagline?: string;
  summary?: string;
  yearsExperience?: number;
  teamSize?: string;
  skills?: string[];
  skillsByCategory?: Array<{ category: string; items: string[] }>;
  /** Tiered skills. "Jenkins" and "Executive Stakeholder Management" are not peers. */
  skillsAssessment?: { expert?: string[]; proficient?: string[]; familiar?: string[] };
  experienceTags?: string[];
  experiences?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    highlights?: string[];
  }>;
  education?: Array<{ degree?: string; institution?: string }>;
  openToRoles?: string[];
}

/** Produce the exact plain-text document that ATS is allowed to score. */
export function resumeDataToText(data: ResumeTextData): string {
  const parts: string[] = [];
  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  if (data.tagline) parts.push(data.tagline);
  if (data.summary) parts.push(data.summary);
  if (typeof data.yearsExperience === 'number') {
    parts.push(`Years of experience: ${data.yearsExperience}`);
  }
  if (data.teamSize) parts.push(`Team size: ${data.teamSize}`);
  if (data.experienceTags?.length) {
    parts.push(`Experience: ${data.experienceTags.join(', ')}`);
  }

  // Tiering is the point: a JD asking for executive stakeholder management
  // should be able to match an EXPERT-tier claim, which a flat skills array
  // cannot express.
  for (const tier of ['expert', 'proficient', 'familiar'] as const) {
    const items = data.skillsAssessment?.[tier];
    if (items?.length) parts.push(`${tier[0].toUpperCase()}${tier.slice(1)}: ${items.join(', ')}`);
  }

  if (data.skillsByCategory) {
    for (const category of data.skillsByCategory) {
      parts.push(`${category.category}: ${category.items.join(', ')}`);
    }
  } else if (data.skills) {
    parts.push(`Skills: ${data.skills.join(', ')}`);
  }

  for (const experience of data.experiences ?? []) {
    // One header line per role, so tenure and geography stay attached to the
    // role they belong to rather than floating free in the document.
    const header = [
      experience.title,
      experience.company,
      experience.location,
      experience.startDate && `${experience.startDate} - ${experience.endDate ?? 'Present'}`,
    ]
      .filter(Boolean)
      .join(' · ');
    if (header) parts.push(header);
    if (experience.highlights) parts.push(...experience.highlights);
  }

  for (const education of data.education ?? []) {
    if (education.degree) parts.push(education.degree);
    if (education.institution) parts.push(education.institution);
  }

  if (data.openToRoles?.length) parts.push(`Open to: ${data.openToRoles.join(', ')}`);

  return parts.join('\n');
}

/** The scorer's view of the résumé. Lived in `readiness-scorer.ts` until ENG-1996. */
export type ScorerResumeData = ResumeTextData;
