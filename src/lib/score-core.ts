/**
 * Shared scoring utilities used by both score-resume and score-job routes.
 *
 * Extracted from src/app/api/v1/score-resume/route.ts so that both routes
 * share the same scoring logic and any prompt tuning applies to both.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  calculateReadinessScore,
  resumeDataToText,
  type ReadinessScore,
  type ResumeData as ScorerResumeData,
} from '@/lib/readiness-scorer';
import { resumeData } from '@/lib/resume-data';
import { sanitizeBreakdown } from '@/lib/score-utils';

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
 * Formats a ReadinessScore into the payload shape returned in API responses
 * and consumed by buildGapAnalysisPrompt.
 */
export function buildScorePayload(score: ReadinessScore) {
  return {
    total: score.total,
    breakdown: sanitizeBreakdown(score.breakdown),
    matchedKeywords: score.details.matchedKeywords,
    missingKeywords: score.details.missingKeywords,
    matchRate: score.details.matchRate,
    keywordDensity: score.details.keywordDensity,
  };
}

/**
 * Builds the gap-analysis prompt sent to Claude.
 */
export function buildGapAnalysisPrompt(currentScore: ReturnType<typeof buildScorePayload>): string {
  return [
    'Analyze this resume readiness score against the job description and return JSON only.',
    '',
    `Current score: ${currentScore.total}/100`,
    `Breakdown: ${JSON.stringify(currentScore.breakdown)}`,
    `Matched keywords: ${currentScore.matchedKeywords.join(', ') || 'none'}`,
    `Missing keywords: ${currentScore.missingKeywords.join(', ') || 'none'}`,
    `Match rate: ${currentScore.matchRate}%`,
    `Keyword density: ${currentScore.keywordDensity}%`,
    '',
    'Return exactly this JSON schema:',
    '{"gapAnalysis":"2-3 short paragraphs","maxPossibleScore":0-100,"recommendation":"full_generation_recommended|marginal_improvement|strong_fit"}',
    '',
    'Recommendation logic:',
    '- full_generation_recommended when gap > 15 points',
    '- marginal_improvement when gap is 5-15 points',
    '- strong_fit when gap < 5 points',
  ].join('\n');
}

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
 * The canonical resumeData singleton, narrowed to the shape the scorers take.
 *
 * Extracted from buildScoringInput so the Fit Score's experience component
 * (ENG-1995) can read the same resume text the readiness scorer sees, without
 * duplicating the narrowing. ENG-1993 is the ticket that fixes what this
 * narrowing DROPS — experienceTags, tiered skillsAssessment, tagline, and the
 * location/startDate/endDate on each experience — plus the two hardcoded values
 * below, which are Verily-era and cannot follow D.
 */
export function buildScorerResumeData(): ScorerResumeData {
  return {
    title: resumeData.title,
    yearsExperience: 15,
    teamSize: '13 engineers',
    skills: resumeData.skills.flatMap((s) => s.items),
    skillsByCategory: resumeData.skills,
    experiences: resumeData.experiences.map((e) => ({
      title: e.title,
      company: e.company,
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
    ...buildScorerResumeData(),
    name: resumeData.name,
    summary: resumeData.brandingStatement,
  });
}

/**
 * Builds the scorer input (resume text + readiness score) from a job description string.
 * Reads from the canonical resumeData singleton, matching the behaviour of
 * the original score-resume route.
 */
export function buildScoringInput(jobDescription: string) {
  const scorerResumeData = buildScorerResumeData();
  const resumeText = buildResumeText();

  const readinessScore = calculateReadinessScore({
    jobDescription,
    resumeText,
    resumeData: scorerResumeData,
  });

  return { readinessScore };
}
