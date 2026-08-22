/** The serialisable résumé shape shared by scoring and generation. */
export interface ResumeTextData {
  name?: string;
  title?: string;
  summary?: string;
  skills?: string[];
  skillsByCategory?: Array<{ category: string; items: string[] }>;
  experiences?: Array<{ title?: string; company?: string; highlights?: string[] }>;
  education?: Array<{ degree?: string; institution?: string }>;
}

/** Produce the exact plain-text document that ATS is allowed to score. */
export function resumeDataToText(data: ResumeTextData): string {
  const parts: string[] = [];
  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  if (data.summary) parts.push(data.summary);
  if (data.skillsByCategory) {
    for (const category of data.skillsByCategory) parts.push(`${category.category}: ${category.items.join(', ')}`);
  } else if (data.skills) parts.push(`Skills: ${data.skills.join(', ')}`);
  for (const experience of data.experiences ?? []) {
    if (experience.title) parts.push(experience.title);
    if (experience.company) parts.push(experience.company);
    if (experience.highlights) parts.push(...experience.highlights);
  }
  for (const education of data.education ?? []) {
    if (education.degree) parts.push(education.degree);
    if (education.institution) parts.push(education.institution);
  }
  return parts.join('\n');
}
