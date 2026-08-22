/**
 * Resume Readiness Scoring
 *
 * Deterministic scoring algorithm optimized for human reader compliance.
 * Measures how quickly a recruiter will see value in the resume.
 *
 * Scoring rubric (0-100 total):
 * - Role Relevance: 0-30 points (keyword findability, title alignment, skills coverage)
 * - Clarity & Skimmability: 0-30 points (summary quality, structure, bullet conciseness, frontloading)
 * - Business Impact: 0-25 points (quantified achievements, outcomes, metric-rich bullets)
 * - Presentation Quality: 0-15 points (natural keyword integration, title bridging, completeness)
 */

import {
  extractKeywords,
  extractJobTitle,
  matchKeywords,
  calculateMatchRate,
  calculateActualKeywordDensity,
  calculateDynamicKeywordCount,
  stemWord,
  type ExtractedKeywords,
  type MatchResult,
  type KeywordPriority,
} from './jd-keywords';
import { sanitizeScoreValue } from './score-utils';
import type { ScoreBreakdown } from './types/resume-generation';

/**
 * Detailed readiness score with breakdown and analysis.
 */
export interface ReadinessScore {
  /** Total score (0-100) */
  total: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Whether the resume is optimized for human readability */
  isOptimized: boolean;
  /** Detailed matching information */
  details: {
    /** Keywords that matched in the resume */
    matchedKeywords: string[];
    /** Keywords that were not found */
    missingKeywords: string[];
    /** Keyword density percentage */
    keywordDensity: number;
    /** Match rate percentage */
    matchRate: number;
    /** All extracted keywords from JD */
    extractedKeywords: ExtractedKeywords;
    /** Match details for analysis */
    matchDetails: MatchResult['matchDetails'];
  };
}

/**
 * Resume data structure for scoring.
 */
export interface ResumeData {
  /** Candidate's current/target title */
  title?: string;
  /** Positioning line (ENG-1993) */
  tagline?: string;
  /** Years of experience */
  yearsExperience?: number;
  /** Skills listed in the resume */
  skills?: string[];
  /** Structured skills by category */
  skillsByCategory?: Array<{ category: string; items: string[] }>;
  /** Tiered skill claims — expert/proficient/familiar (ENG-1993) */
  skillsAssessment?: { expert: string[]; proficient: string[]; familiar: string[] };
  /** Cross-role positioning tags, e.g. "Engineering Management" (ENG-1993) */
  experienceTags?: string[];
  /** Team size managed */
  teamSize?: string;
  /** Experience entries */
  experiences?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    highlights?: string[];
  }>;
  /** Education entries */
  education?: Array<{
    degree?: string;
    institution?: string;
  }>;
  /** Roles the candidate is open to */
  openToRoles?: string[];
}

/**
 * Input for readiness scoring.
 */
export interface ScoringInput {
  /** Job description text */
  jobDescription: string;
  /** Full text of the resume (for keyword matching) */
  resumeText: string;
  /** Structured resume data */
  resumeData: ResumeData;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function emptyExtractedKeywords(): ExtractedKeywords {
  return {
    all: [],
    fromTitle: [],
    fromRequired: [],
    fromNiceToHave: [],
    technologies: [],
    actionVerbs: [],
    keywordPriorities: {},
    keywordFrequency: {},
  };
}

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsExactTerm(haystackLower: string, term: string): boolean {
  const keyword = term.toLowerCase().trim();
  if (!keyword) return false;
  const hasSpecialChars = /[\/+#.-]/.test(keyword);
  if (hasSpecialChars) {
    // For terms with special chars (C#, C++, CI/CD), use escaped literal match
    return new RegExp(`(?:^|[^a-zA-Z0-9])${escapeRegex(keyword)}(?:$|[^a-zA-Z0-9])`).test(haystackLower)
      || haystackLower.startsWith(keyword)
      || haystackLower.endsWith(keyword);
  }
  // For all other terms, use word boundary matching to prevent Java→JavaScript
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`).test(haystackLower);
}

function uniqueKeywords(values: string[]): string[] {
  return [...new Set(values.map(v => v.toLowerCase().trim()).filter(Boolean))];
}

const TITLE_BRIDGING_STOPWORDS = new Set([
  'and',
  'or',
  'the',
  'for',
  'with',
  'from',
  'into',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  '&',
]);

function getResumeLines(resumeText: string): string[] {
  return resumeText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function getSummarySegments(resumeText: string, resumeData: ResumeData): {
  firstTwoSentences: string;
  remainingSentences: string;
  firstSummaryLine: string;
} {
  const lines = getResumeLines(resumeText);
  if (lines.length === 0) {
    return {
      firstTwoSentences: '',
      remainingSentences: '',
      firstSummaryLine: '',
    };
  }

  const titleLower = resumeData.title?.trim().toLowerCase();
  const contentLines = [...lines];
  if (titleLower) {
    const titleIndex = contentLines.findIndex(
      (line, index) => index < 3 && line.toLowerCase() === titleLower
    );

    if (titleIndex >= 0) {
      // Drop leading header lines (name/title) so summary detection starts at content.
      contentLines.splice(0, titleIndex + 1);
    }
  }

  const summaryLines = contentLines.filter(Boolean).slice(0, 5);
  const summaryText = summaryLines.join('\n');
  const sentences = splitIntoSentences(summaryText);

  return {
    firstTwoSentences: sentences.slice(0, 2).join('. ').toLowerCase(),
    remainingSentences: sentences.slice(2).join('. ').toLowerCase(),
    firstSummaryLine: summaryLines[0]?.toLowerCase() || '',
  };
}

function keywordAppearsInText(keyword: string, text: string): boolean {
  if (!keyword || !text.trim()) {
    return false;
  }

  return matchKeywords([keyword], text, {
    allowStem: true,
    allowSynonyms: true,
  }).matched.length > 0;
}

/**
 * Determine the highest-value position where a keyword appears in the resume.
 */
function getPositionalMultiplier(
  keyword: string,
  resumeText: string,
  resumeData: ResumeData
): number {
  const { firstTwoSentences, remainingSentences } = getSummarySegments(resumeText, resumeData);
  const firstRoleBullets = resumeData.experiences?.[0]?.highlights || [];
  const firstRoleFirstThree = firstRoleBullets.slice(0, 3).join(' ');
  const firstRoleRemaining = firstRoleBullets.slice(3).join(' ');
  const otherRoleBullets = (resumeData.experiences || [])
    .slice(1)
    .flatMap(experience => experience.highlights || [])
    .join(' ');
  const skillsText = [
    ...(resumeData.skills || []),
    ...(resumeData.skillsByCategory || []).flatMap(category => [category.category, ...category.items]),
  ].join(' ');

  if (keywordAppearsInText(keyword, firstTwoSentences)) return 1.5;
  if (keywordAppearsInText(keyword, remainingSentences)) return 1.2;
  if (keywordAppearsInText(keyword, firstRoleFirstThree)) return 1.3;
  if (keywordAppearsInText(keyword, firstRoleRemaining)) return 1.0;
  if (keywordAppearsInText(keyword, otherRoleBullets)) return 1.0;
  if (keywordAppearsInText(keyword, skillsText)) return 0.7;

  return 1.0;
}

function getMeaningfulTitleTerms(title: string): string[] {
  return uniqueKeywords(
    title
      .toLowerCase()
      .split(/[\s,()/&-]+/)
      .filter(term => term.length > 2 && !TITLE_BRIDGING_STOPWORDS.has(term))
  );
}

/**
 * Check whether the resume bridges differentiating title terms from the JD.
 * Returns 0-3 points.
 */
function calculateTitleBridgingScore(
  resumeText: string,
  resumeData: ResumeData,
  jobDescription: string
): number {
  const jdTitle = extractJobTitle(jobDescription);
  if (!jdTitle) return 1.5;

  const resumeTitle = resumeData.title?.trim() || '';
  if (!resumeTitle) return 0;

  const jdTerms = getMeaningfulTitleTerms(jdTitle);
  if (jdTerms.length === 0) return 1.5;

  const resumeTitleTerms = getMeaningfulTitleTerms(resumeTitle);
  const resumeTitleStems = new Set(resumeTitleTerms.map(stemWord));
  const differentiatingTerms = jdTerms.filter(term => (
    !resumeTitleTerms.includes(term) && !resumeTitleStems.has(stemWord(term))
  ));

  if (differentiatingTerms.length === 0) {
    return 3;
  }

  const parentheticalText = (resumeTitle.match(/\(([^)]+)\)/)?.[1] || '').toLowerCase();
  const { firstSummaryLine } = getSummarySegments(resumeText, resumeData);

  let bridgedCount = 0;
  for (const term of differentiatingTerms) {
    if (
      containsExactTerm(parentheticalText, term) ||
      containsExactTerm(firstSummaryLine, term) ||
      containsExactTerm(resumeTitle.toLowerCase(), term)
    ) {
      bridgedCount++;
    }
  }

  return (bridgedCount / differentiatingTerms.length) * 3;
}

/**
 * Check whether the most JD-relevant skill category is listed first.
 * Returns 0-2 points.
 */
function calculateSkillsOrderingScore(
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords
): number {
  const categories = resumeData.skillsByCategory;
  if (!categories || categories.length === 0) {
    return 0;
  }
  if (categories.length === 1) {
    return 1;
  }

  const categoryScores = categories.map(category => {
    const categoryText = [category.category, ...category.items].join(' ');
    let relevance = 0;

    for (const keyword of extractedKeywords.all) {
      if (keywordAppearsInText(keyword, categoryText)) {
        relevance++;
      }
    }

    return relevance;
  });

  const maxRelevance = Math.max(...categoryScores);
  if (maxRelevance === 0) {
    return 1;
  }

  const firstCategoryScore = categoryScores[0];
  if (firstCategoryScore >= maxRelevance) {
    return 2;
  }

  return (firstCategoryScore / maxRelevance) * 2;
}

// ─── Sub-scorers ────────────────────────────────────────────────────────

/**
 * Calculate Role Relevance score (0-30).
 *
 * - Keyword findability (15): JD key terms present in resume
 * - Title alignment (8): Resume title/experience matches JD role
 * - Skills coverage (7): Required JD skills present in skills section
 */
function calculateRoleRelevance(
  matchResult: MatchResult,
  extractedKeywords: ExtractedKeywords,
  resumeData: ResumeData,
  resumeText: string
): number {
  let score = 0;
  const resumeLower = resumeText.toLowerCase();

  // Keyword findability (15 pts)
  const hardSkills = uniqueKeywords(extractedKeywords.technologies);
  const allKeywords = uniqueKeywords(extractedKeywords.all);

  // Position-weighted keyword findability
  if (allKeywords.length > 0) {
    let weightedSum = 0;
    for (const keyword of matchResult.matched) {
      weightedSum += getPositionalMultiplier(keyword, resumeText, resumeData);
    }

    const maxPossible = allKeywords.length * 1.5;
    const positionalRate = weightedSum / maxPossible;
    score += positionalRate * 15;
  }

  // Title alignment (8 pts)
  const titleKeywords = uniqueKeywords(extractedKeywords.fromTitle).slice(0, 5);
  const bestTitleMatch = calculateBestTitleMatchRate(resumeData, titleKeywords);
  if (titleKeywords.length > 0) {
    score += bestTitleMatch * 8;
  } else {
    // No explicit title keywords — give partial credit if resume has a title
    score += resumeData.title ? 3 : 0;
  }

  // Skills coverage (7 pts)
  if (hardSkills.length > 0) {
    const resumeSkills = new Set<string>();
    for (const skill of resumeData.skills || []) {
      resumeSkills.add(normalizeSkill(skill));
    }
    for (const cat of resumeData.skillsByCategory || []) {
      resumeSkills.add(normalizeSkill(cat.category));
      for (const item of cat.items) {
        resumeSkills.add(normalizeSkill(item));
      }
    }

    let hits = 0;
    for (const skill of hardSkills) {
      const normalized = normalizeSkill(skill);
      const matched = [...resumeSkills].some(rs => rs === normalized);
      if (matched || containsExactTerm(resumeLower, skill)) {
        hits++;
      }
    }
    score += (hits / hardSkills.length) * 7;
  } else {
    // No tech keywords — partial credit for having a skills section
    const hasSkills = (resumeData.skills?.length || 0) + (resumeData.skillsByCategory?.length || 0) > 0;
    score += hasSkills ? 3.5 : 0;
  }

  return Math.min(30, Math.round(score * 10) / 10);
}

/**
 * Calculate Clarity & Skimmability score (0-30).
 *
 * - Summary presence & quality (8): Has summary? Under 3 lines? Frontloads relevant title?
 * - Section structure (5): Standard sections present?
 * - Skills ordering (2): Most JD-relevant skill category appears first
 * - Bullet quality (8): Concise, action-verb-led, 3-5 per role?
 * - Frontloading (4): Most recent/relevant experience first? Best achievement in first bullet?
 * - Title bridging (3): Resume title bridges to target role language
 */
function calculateClaritySkimmability(
  resumeText: string,
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords,
  jobDescription: string
): number {
  let score = 0;
  const lines = getResumeLines(resumeText);

  // Summary presence & quality (8 pts)
  const firstLines = lines.slice(0, 5).join(' ').toLowerCase();
  const hasSummary = firstLines.length > 30; // Non-trivial opening content
  if (hasSummary) {
    score += 4;
    // Frontloads relevant title keywords?
    const titleKeywords = extractedKeywords.fromTitle;
    const titleHits = titleKeywords.filter(k =>
      firstLines.includes(k.toLowerCase())
    ).length;
    if (titleKeywords.length > 0) {
      score += Math.min(4, (titleHits / titleKeywords.length) * 4);
    } else {
      score += 2; // Partial credit
    }
  }

  // Section structure (5 pts)
  let sectionPoints = 0;
  if (resumeData.title) sectionPoints += 1;
  const hasSkills = (resumeData.skills?.length || 0) + (resumeData.skillsByCategory?.length || 0) > 0;
  if (hasSkills) sectionPoints += 1.5;
  if (resumeData.experiences && resumeData.experiences.length > 0) sectionPoints += 1.5;
  if (resumeData.education && resumeData.education.length > 0) sectionPoints += 1;
  score += Math.min(5, sectionPoints);

  // Skills ordering (2 pts)
  score += calculateSkillsOrderingScore(resumeData, extractedKeywords);

  // Bullet quality (8 pts)
  if (resumeData.experiences) {
    let totalBullets = 0;
    let actionVerbBullets = 0;
    let conciseBullets = 0;
    const actionVerbPattern = /^(led|managed|directed|built|created|designed|developed|implemented|launched|improved|enhanced|optimized|reduced|increased|achieved|delivered|architected|automated|scaled|migrated|deployed|engineered|spearheaded|orchestrated|established|mentored|coached|collaborated|streamlined|accelerated|transformed|pioneered)\b/i;

    for (const exp of resumeData.experiences) {
      if (!exp.highlights) continue;
      for (const bullet of exp.highlights) {
        totalBullets++;
        if (actionVerbPattern.test(bullet.trim())) actionVerbBullets++;
        if (bullet.length < 200) conciseBullets++;
      }
    }

    if (totalBullets > 0) {
      const actionVerbRatio = actionVerbBullets / totalBullets;
      const conciseRatio = conciseBullets / totalBullets;
      score += actionVerbRatio * 4;
      score += conciseRatio * 4;
    }
  }

  // Frontloading (4 pts)
  if (resumeData.experiences && resumeData.experiences.length > 0) {
    const firstExp = resumeData.experiences[0];
    if (firstExp.highlights && firstExp.highlights.length > 0) {
      score += 2;
      const firstBullet = firstExp.highlights[0];
      if (/\d/.test(firstBullet)) {
        score += 2;
      } else {
        score += 0.5;
      }
    }
  }

  // Title bridging (3 pts)
  score += calculateTitleBridgingScore(resumeText, resumeData, jobDescription);

  return Math.min(30, Math.round(score * 10) / 10);
}

/**
 * Calculate Business Impact score (0-25).
 *
 * - Metrics presence (10): Ratio of bullets with quantified results
 * - Outcome framing (8): "Reduced X by Y%" patterns vs duty-listing
 * - Achievement verb strength (7): Action verb variety and strength
 */
function calculateBusinessImpact(resumeData: ResumeData): number {
  let score = 0;
  const allBullets: string[] = [];

  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.highlights) {
        allBullets.push(...exp.highlights);
      }
    }
  }

  if (allBullets.length === 0) return 0;

  // Metrics presence (10 pts): ratio of bullets with quantified results
  // Strict numeric: numbers with units/suffixes (%, $, k, etc.)
  const strictNumericPattern = /\d+[\s]*[%$kKmMbB]|\$[\s]*\d|\d+[,\d]*\s*(?:percent|hours|days|weeks|months|engineers|teams|users|customers|systems|services|applications)/i;
  // Impact verb + number nearby (verb must co-occur with a number)
  const impactVerbWithNumber = /\b(?:increased|reduced|improved|decreased|saved|grew|cut|accelerated|eliminated|boosted|lowered|expanded)\b.*\d|\d.*\b(?:increased|reduced|improved|decreased|saved|grew|cut|accelerated|eliminated|boosted|lowered|expanded)\b/i;
  // Any bullet containing a number (catches "Led 13 engineers", "30+ systems")
  const hasNumber = /\d+/;
  const bulletsWithMetrics = allBullets.filter(b =>
    strictNumericPattern.test(b) || impactVerbWithNumber.test(b) || hasNumber.test(b)
  ).length;
  const metricsRatio = bulletsWithMetrics / allBullets.length;
  score += metricsRatio * 10;

  // Outcome framing (8 pts): patterns like "Reduced X by Y%", "Increased X from A to B"
  const outcomePattern = /\b(reduced|increased|improved|decreased|saved|grew|cut|accelerated|eliminated|boosted|lowered|raised|expanded|achieved|delivered|generated|drove)\b.*\b(\d+[%$kKmMbB]|\d+\s*(percent|hours|days|weeks|months|engineers|teams|users|customers|systems|services))\b/i;
  const bulletsWithOutcomes = allBullets.filter(b => outcomePattern.test(b)).length;
  const outcomeRatio = bulletsWithOutcomes / allBullets.length;
  score += outcomeRatio * 8;

  // Achievement verb strength (7 pts)
  const strongVerbs = new Set([
    'architected', 'pioneered', 'spearheaded', 'transformed', 'revolutionized',
    'engineered', 'orchestrated', 'championed', 'established', 'launched',
    'scaled', 'built', 'created', 'designed', 'delivered',
  ]);
  const usedStrongVerbs = new Set<string>();
  for (const bullet of allBullets) {
    const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase();
    if (firstWord && strongVerbs.has(firstWord)) {
      usedStrongVerbs.add(firstWord);
    }
  }
  // Variety: more unique strong verbs = better
  const verbVariety = Math.min(1, usedStrongVerbs.size / 5);
  score += verbVariety * 7;

  return Math.min(25, Math.round(score * 10) / 10);
}

/**
 * Calculate Presentation Quality score (0-15).
 *
 * - Natural keyword integration (5): Keywords in achievement context, not stuffed. Penalize density >5%
 * - Title bridging (5): Context when title gap exists
 * - Professional completeness (5): All sections present, reasonable length
 */
function calculatePresentationQuality(
  matchResult: MatchResult,
  resumeText: string,
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords
): number {
  let score = 0;

  // Natural keyword integration (5 pts)
  if (matchResult.matched.length > 0 && resumeText.length > 0) {
    const density = calculateActualKeywordDensity(resumeText, matchResult.matched);
    const d = density.overallDensity;

    if (d >= 1 && d <= 5) {
      score += 5; // Natural range
    } else if (d > 5 && d <= 8) {
      score += 3; // Getting dense
    } else if (d > 8) {
      score += 1; // Stuffing penalty
    } else if (d > 0) {
      score += 2; // Very low
    }
  }

  // Title bridging (5 pts)
  const titleKeywords = uniqueKeywords(extractedKeywords.fromTitle);
  if (titleKeywords.length > 0) {
    const bestMatch = calculateBestTitleMatchRate(resumeData, titleKeywords);
    score += bestMatch * 5;
  } else {
    // No title keywords — partial credit for having a title
    score += resumeData.title ? 2.5 : 0;
  }

  // Professional completeness (5 pts)
  let completeness = 0;
  if (resumeData.title && resumeData.title.length > 0) completeness += 1;
  const hasSkills = (resumeData.skills?.length || 0) + (resumeData.skillsByCategory?.length || 0) > 0;
  if (hasSkills) completeness += 1.25;
  if (resumeData.experiences && resumeData.experiences.length > 0) {
    completeness += 1;
    const hasHighlights = resumeData.experiences.some(e => e.highlights && e.highlights.length > 0);
    if (hasHighlights) completeness += 0.75;
  }
  if (resumeData.education && resumeData.education.length > 0) completeness += 1;
  score += Math.min(5, completeness);

  return Math.min(15, Math.round(score * 10) / 10);
}

// ─── Title matching (reused from old scorer) ────────────────────────────

export function calculateBestTitleMatchRate(resumeData: ResumeData, titleKeywords: string[]): number {
  if (titleKeywords.length === 0) return 0;

  const titleCandidates: string[] = [];
  if (resumeData.title) titleCandidates.push(resumeData.title);
  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.title) titleCandidates.push(exp.title);
    }
  }
  if (resumeData.openToRoles) {
    titleCandidates.push(...resumeData.openToRoles);
  }

  let bestRate = 0;
  for (const candidate of titleCandidates) {
    const candidateLower = candidate.toLowerCase();
    const candidateWords = candidateLower.split(/\s+/);
    const candidateStems = candidateWords.map(stemWord);
    let matchScore = 0;
    for (const keyword of titleKeywords) {
      if (candidateLower.includes(keyword)) {
        matchScore += 1;
      } else {
        const kwWords = keyword.split(/\s+/);
        if (kwWords.length > 1) {
          let wordHits = 0;
          for (const w of kwWords) {
            if (candidateWords.includes(w) || candidateStems.includes(stemWord(w))) {
              wordHits++;
            }
          }
          matchScore += wordHits / kwWords.length;
        } else {
          if (candidateStems.includes(stemWord(keyword))) {
            matchScore += 1;
          }
        }
      }
    }
    bestRate = Math.max(bestRate, matchScore / titleKeywords.length);
  }

  return bestRate;
}

// ─── Main entry point ───────────────────────────────────────────────────

/**
 * Calculate readiness score for a resume against a job description.
 *
 * Deterministic — same inputs always produce same outputs.
 */
export function calculateReadinessScore(input: ScoringInput): ReadinessScore {
  const { jobDescription, resumeText, resumeData } = input;

  if (!jobDescription || jobDescription.trim().length === 0) {
    return {
      total: 0,
      isOptimized: false,
      breakdown: { roleRelevance: 0, claritySkimmability: 0, businessImpact: 0, presentationQuality: 0 },
      details: {
        matchedKeywords: [], missingKeywords: [],
        keywordDensity: 0, matchRate: 0,
        extractedKeywords: emptyExtractedKeywords(),
        matchDetails: [],
      },
    };
  }

  if (!resumeText || resumeText.trim().length === 0) {
    const dynamicCount = calculateDynamicKeywordCount(jobDescription);
    const extractedKeywords = extractKeywords(jobDescription, dynamicCount);
    return {
      total: 0,
      isOptimized: false,
      breakdown: { roleRelevance: 0, claritySkimmability: 0, businessImpact: 0, presentationQuality: 0 },
      details: {
        matchedKeywords: [], missingKeywords: extractedKeywords.all,
        keywordDensity: 0, matchRate: 0,
        extractedKeywords,
        matchDetails: [],
      },
    };
  }

  // 1. Extract keywords from JD
  const dynamicCount = calculateDynamicKeywordCount(jobDescription);
  const extractedKeywords = extractKeywords(jobDescription, dynamicCount);

  // 2. Match keywords against resume
  const matchResult = matchKeywords(extractedKeywords.all, resumeText, {
    allowStem: true,
    allowSynonyms: true,
  });

  const strictMatchResult = matchKeywords(extractedKeywords.all, resumeText, {
    allowStem: false,
    allowSynonyms: false,
  });
  const strictMatchRate = calculateMatchRate(strictMatchResult.matched.length, extractedKeywords.all.length);

  // 3. Calculate each sub-score
  const roleRelevance = calculateRoleRelevance(matchResult, extractedKeywords, resumeData, resumeText);
  const claritySkimmability = calculateClaritySkimmability(
    resumeText,
    resumeData,
    extractedKeywords,
    jobDescription
  );
  const businessImpact = calculateBusinessImpact(resumeData);
  const presentationQualityScore = calculatePresentationQuality(matchResult, resumeText, resumeData, extractedKeywords);

  // 4. Sanitize and sum
  const breakdown: ScoreBreakdown = {
    roleRelevance: sanitizeScoreValue(roleRelevance, 0, 30),
    claritySkimmability: sanitizeScoreValue(claritySkimmability, 0, 30),
    businessImpact: sanitizeScoreValue(businessImpact, 0, 25),
    presentationQuality: sanitizeScoreValue(presentationQualityScore, 0, 15),
  };

  const total = Math.max(0, Math.min(100,
    Math.round((breakdown.roleRelevance + breakdown.claritySkimmability + breakdown.businessImpact + breakdown.presentationQuality) * 10) / 10
  ));

  const actualDensity = calculateActualKeywordDensity(resumeText, matchResult.matched);

  return {
    total,
    isOptimized: total >= 70,
    breakdown,
    details: {
      matchedKeywords: matchResult.matched,
      missingKeywords: matchResult.missing,
      keywordDensity: Math.round(actualDensity.overallDensity * 10) / 10,
      matchRate: strictMatchRate,
      extractedKeywords,
      matchDetails: matchResult.matchDetails,
    },
  };
}

/**
 * Generate a plain text version of the resume for scoring.
 */
export function resumeDataToText(data: ResumeData & {
  name?: string;
  summary?: string;
}): string {
  const parts: string[] = [];

  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  if (data.summary) parts.push(data.summary);

  if (data.skillsByCategory) {
    for (const category of data.skillsByCategory) {
      parts.push(category.category + ': ' + category.items.join(', '));
    }
  } else if (data.skills) {
    parts.push('Skills: ' + data.skills.join(', '));
  }

  if (data.experiences) {
    for (const exp of data.experiences) {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      if (exp.highlights) {
        parts.push(...exp.highlights);
      }
    }
  }

  if (data.education) {
    for (const edu of data.education) {
      if (edu.degree) parts.push(edu.degree);
      if (edu.institution) parts.push(edu.institution);
    }
  }

  return parts.join('\n');
}

/**
 * Format score for display with new readiness framing.
 */
export function formatScoreAssessment(score: number): string {
  if (score >= 85) return 'Interview-ready — recruiter sees value instantly';
  if (score >= 70) return 'Strong presentation with minor refinement opportunities';
  if (score >= 55) return 'Decent foundation — needs clarity and impact improvements';
  return 'Significant gaps in readability and relevance';
}
