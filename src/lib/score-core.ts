/**
 * Shared scoring utilities used by both score-resume and score-job routes.
 *
 * Extracted from src/app/api/v1/score-resume/route.ts so that both routes
 * share the same scoring logic and any prompt tuning applies to both.
 */

import Anthropic from '@anthropic-ai/sdk';
import { resumeData } from '@/lib/resume-data';
import { resumeDataToText } from '@/lib/resume-text';
import {
  RUBRIC_DIMENSIONS, assembleRubric, buildDimensionCall, scoreDimension,
  type DimensionResult, type RawDimensionReply,
} from '@/lib/resume-rubric';
import { anchor } from '@/lib/resume-anchoring';
import { attributeCitation, loadCareerCorpus, type CareerCorpus } from '@/lib/career-corpus';

/**
 * Shared Anthropic client configured with the extended cache TTL beta header.
 * Both scoring routes use this same client instance.
 */
export const scoringClient = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

/**
 * Shared ATS scoring primitives returned by the score and generator APIs.
 */

/**
 * Extracts and concatenates all text blocks from an Anthropic message content array.
 * Anthropic responses may contain multiple text blocks (e.g., cited responses);
 * returning only the first block can silently truncate JSON responses.
 */
export function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

/**
 * Parses a JSON response that may be wrapped in a markdown code fence or
 * surrounded by prose. Throws if no valid JSON object can be extracted.
 */
export function parseJsonResponse(text: string): Record<string, unknown> {
  const parseObject = (value: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid JSON response');
    }
    return parsed as Record<string, unknown>;
  };

  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return parseObject(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return parseObject(withoutFence.slice(start, end + 1));
    }
    throw new Error('Invalid JSON response');
  }
}

/**
 * Derives total years of experience from the earliest experience startDate to
 * the latest endDate ("Present" counts as now). Returns undefined — never a
 * stale guess — when a date can't be parsed, per ENG-1993 acceptance #3.
 */
export function deriveYearsExperience(
  experiences: Array<{ startDate?: string; endDate?: string }>,
  now: Date = new Date()
): number | undefined {
  const toDate = (value: string | undefined): Date | undefined => {
    if (!value) return undefined;
    if (value.trim().toLowerCase() === 'present') return now;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const starts = experiences.map((e) => toDate(e.startDate)).filter((d): d is Date => d !== undefined);
  const ends = experiences.map((e) => toDate(e.endDate)).filter((d): d is Date => d !== undefined);
  if (starts.length === 0 || ends.length !== experiences.length || starts.length !== experiences.length) {
    return undefined;
  }

  const earliestStart = new Date(Math.min(...starts.map((d) => d.getTime())));
  const latestEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const years = (latestEnd.getTime() - earliestStart.getTime()) / msPerYear;
  return years > 0 ? Math.round(years) : undefined;
}

/**
 * The canonical resumeData singleton, narrowed to the shape the scorers take.
 *
 * Extracted from buildScoringInput so the Fit Score's experience component
 * (ENG-1995) can read the same resume text the readiness scorer sees, without
 * duplicating the narrowing.
 *
 * ENG-1993: experienceTags, tiered skillsAssessment, tagline, and each
 * experience's location/startDate/endDate now pass through instead of being
 * silently dropped. yearsExperience is derived from the date span (see
 * deriveYearsExperience) instead of the hardcoded 15. teamSize has no
 * structured source in resumeData today — asserting the old Verily-era
 * '13 engineers' string would be a stale claim that can never follow D to
 * Visa, so it is left undefined rather than guessed; deriving it needs a real
 * data source, which is unaddressed scope (see the PR/issue comment).
 */
export function buildScorerResumeData(): ScorerResumeData {
  return {
    title: resumeData.title,
    tagline: resumeData.tagline,
    yearsExperience: deriveYearsExperience(resumeData.experiences),
    teamSize: undefined,
    skills: resumeData.skills.flatMap((s) => s.items),
    skillsByCategory: resumeData.skills,
    skillsAssessment: resumeData.skillsAssessment,
    experienceTags: resumeData.experienceTags,
    experiences: resumeData.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      highlights: e.highlights,
    })),
    education: resumeData.education?.map((e) => ({
      degree: e.degree,
      institution: e.institution,
    })) ?? [],
    openToRoles: resumeData.openToRoles,
  };
}

/** The plain-text resume both scoring paths grade against. */
export function buildResumeText(): string {
  return resumeDataToText({
    name: resumeData.name,
    summary: resumeData.brandingStatement,
    title: resumeData.title,
    skillsByCategory: resumeData.skills,
    experiences: resumeData.experiences,
    education: resumeData.education,
  });
}

/**
 * Builds the scorer input (resume text + readiness score) from a job description string.
 * Reads from the canonical resumeData singleton, matching the behaviour of
 * the original score-resume route.
 */
async function callDimension(call: ReturnType<typeof buildDimensionCall>, source: string, jobDescription: string) {
  const message = await scoringClient.messages.create({
    model: 'claude-opus-4-6', max_tokens: 300, temperature: 0,
    messages: [{ role: 'user', content: call.prompt }],
  });
  return scoreDimension(call, parseJsonResponse(extractTextContent(message.content as Array<{ type: string; text?: string }>)) as RawDimensionReply, source, jobDescription);
}

export interface AtsScore {
  current: { total: number; breakdown: DimensionResult[] };
  max: { total: number; breakdown: DimensionResult[]; reachesTarget90: boolean };
  gap: number;
  gapLine: string;
}

/** Scores exactly the five locked dimensions; current reads only the submitted resume. */
export async function scoreAts(jobDescription: string, corpus?: CareerCorpus): Promise<AtsScore> {
  const resumeText = buildResumeText();
  const careerCorpus = corpus ?? await loadCareerCorpus(resumeText);
  const seed = `${jobDescription.length}:${resumeText.length}`;
  const calls = RUBRIC_DIMENSIONS.map((d) => buildDimensionCall(d, resumeText, jobDescription, seed));
  const dimensions = await Promise.all(calls.map((call) => callDimension(call, resumeText, jobDescription)));
  const addressable = RUBRIC_DIMENSIONS.filter((d) => d.ceiling === 'addressable');
  const corpusScores = await Promise.all(addressable.map(async (dimension) => {
    const call = buildDimensionCall(dimension, careerCorpus.document, jobDescription, `${seed}:corpus`);
    const scored = await callDimension(call, careerCorpus.document, jobDescription);
    return [dimension.key, attributeCitation(scored.resumeQuote, careerCorpus.sources) ? scored.score : 0] as const;
  }));
  const support = new Map(corpusScores);
  const bounded = dimensions.map((d) => ({ ...d, ceilingScore: support.get(d.dimension) ?? d.score }));
  const rubric = assembleRubric(bounded);
  // Keep the anchoring module in the real scoring path. It intentionally emits no fourth score.
  anchor(rubric, []);
  const current = rubric.total * 5;
  const maximum = rubric.ceiling * 5;
  const gap = maximum - current;
  return {
    current: { total: current, breakdown: bounded },
    max: { total: maximum, breakdown: bounded, reachesTarget90: maximum >= 90 },
    gap,
    gapLine: gap === 0 ? 'Already maximal: the résumé states all truthfully supportable evidence.' : maximum >= 90 ? 'Tailoring pays: true career evidence can reach the ATS (Max) target of 90.' : 'Structural mismatch: true career evidence cannot reach the ATS (Max) target of 90.',
  };
}
