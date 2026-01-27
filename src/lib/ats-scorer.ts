/**
 * Deterministic ATS Scoring
 *
 * Research-backed scoring algorithm for ATS compatibility.
 * Produces identical scores across multiple runs for the same inputs.
 *
 * Scoring breakdown (0-100 total):
 * - Keyword Relevance: 0-40 points
 * - Skills Quality: 0-25 points
 * - Experience Alignment: 0-20 points
 * - Format Parseability: 0-15 points (constant for our ATS-optimized PDF)
 *
 * Sources: 20+ industry sources including Jobscan, Indeed, LinkedIn Talent Report
 */

import {
  extractKeywords,
  matchKeywords,
  wordCount,
  calculateMatchRate,
  calculateKeywordDensity,
  stemWord,
  type ExtractedKeywords,
  type MatchResult,
} from './ats-keywords';

/**
 * Score breakdown by category.
 */
export interface ScoreBreakdown {
  /** Keyword matching score (0-40) */
  keywordRelevance: number;
  /** Skills section quality (0-25) */
  skillsQuality: number;
  /** Experience alignment (0-20) */
  experienceAlignment: number;
  /** Format parseability (0-15) */
  formatParseability: number;
}

/**
 * Detailed ATS score with breakdown and analysis.
 */
export interface ATSScore {
  /** Total score (0-100) */
  total: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
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
  /** Years of experience (can be extracted from text) */
  yearsExperience?: number;
  /** Skills listed in the resume */
  skills?: string[];
  /** Structured skills by category */
  skillsByCategory?: Array<{ category: string; items: string[] }>;
  /** Team size managed (e.g., "13 engineers") */
  teamSize?: string;
  /** Experience entries */
  experiences?: Array<{
    title?: string;
    company?: string;
    highlights?: string[];
  }>;
}

/**
 * Input for ATS scoring.
 */
export interface ScoringInput {
  /** Job description text */
  jobDescription: string;
  /** Full text of the resume (for keyword matching) */
  resumeText: string;
  /** Structured resume data */
  resumeData: ResumeData;
}

/**
 * Calculate keyword relevance score (0-40 points).
 *
 * Scoring:
 * - Exact match: 2 points each (max 25 points for ~12 matches)
 * - Stem match: 1.5 points each
 * - Synonym match: 1 point each
 * - Max total: 40 points
 * - Penalty: -5 if density > 3% (keyword stuffing)
 */
function calculateKeywordScore(
  matchResult: MatchResult,
  totalKeywords: number,
  resumeWordCount: number
): number {
  let score = 0;

  // Calculate points based on match type
  for (const detail of matchResult.matchDetails) {
    switch (detail.matchType) {
      case 'exact':
        score += 2;
        break;
      case 'stem':
        score += 1.5;
        break;
      case 'synonym':
        score += 1;
        break;
    }
  }

  // Cap at 40 points
  score = Math.min(score, 40);

  // Penalty for keyword stuffing (density > 3%)
  const density = calculateKeywordDensity(matchResult.matched.length, resumeWordCount);
  if (density > 3) {
    score = Math.max(0, score - 5);
  }

  return Math.round(score * 10) / 10; // One decimal place
}

/**
 * Calculate skills quality score (0-25 points).
 *
 * Scoring:
 * - Required skills present: (matched/required) * 15 points
 * - Skills aligned with JD priority: 5 points
 * - Skills section well-organized: 5 points
 */
function calculateSkillsScore(
  extractedKeywords: ExtractedKeywords,
  resumeData: ResumeData,
  _matchResult: MatchResult
): number {
  let score = 0;

  // Get all skills from resume
  const resumeSkills = new Set<string>();
  if (resumeData.skills) {
    for (const skill of resumeData.skills) {
      resumeSkills.add(skill.toLowerCase());
    }
  }
  if (resumeData.skillsByCategory) {
    for (const category of resumeData.skillsByCategory) {
      for (const item of category.items) {
        resumeSkills.add(item.toLowerCase());
      }
    }
  }

  // Count how many JD technologies are in resume skills
  const techKeywords = extractedKeywords.technologies;
  let techMatches = 0;
  for (const tech of techKeywords) {
    if (resumeSkills.has(tech) || [...resumeSkills].some(s => s.includes(tech))) {
      techMatches++;
    }
  }

  // Required skills present (max 15 points)
  if (techKeywords.length > 0) {
    score += Math.min(15, (techMatches / techKeywords.length) * 15);
  } else {
    // No specific tech requirements - give partial credit for having skills
    score += resumeSkills.size > 0 ? 10 : 0;
  }

  // Skills aligned with JD priority (5 points)
  // Check if top JD keywords appear in skills section
  const topJdKeywords = extractedKeywords.all.slice(0, 5);
  let alignedCount = 0;
  for (const keyword of topJdKeywords) {
    if (resumeSkills.has(keyword) ||
        [...resumeSkills].some(s => s.toLowerCase().includes(keyword.toLowerCase()))) {
      alignedCount++;
    }
  }
  score += (alignedCount / Math.max(topJdKeywords.length, 1)) * 5;

  // Skills section organization (5 points)
  // Give full points if skills are categorized
  if (resumeData.skillsByCategory && resumeData.skillsByCategory.length > 0) {
    score += 5;
  } else if (resumeData.skills && resumeData.skills.length > 0) {
    score += 3;
  }

  return Math.round(score * 10) / 10;
}

/**
 * Extract years of experience from JD text.
 */
function extractYearsFromJd(jd: string): number | null {
  // Look for patterns like "8+ years", "5-7 years", "10 years"
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*-\s*\d+\s*(?:years?|yrs?)/i,
    /minimum\s+(?:of\s+)?(\d+)\s*(?:years?|yrs?)/i,
  ];

  for (const pattern of patterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Extract team size from JD text.
 */
function extractTeamSizeFromJd(jd: string): number | null {
  // Look for patterns like "team of 6", "manage 10+ engineers", "6-10 engineers"
  const patterns = [
    /(?:team\s+of|manage|lead)\s+(\d+)/i,
    /(\d+)\+?\s*(?:engineers?|developers?|reports?)/i,
    /(\d+)\s*-\s*(\d+)\s*(?:engineers?|developers?)/i,
  ];

  for (const pattern of patterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Extract team size from resume data.
 */
function extractTeamSizeFromResume(resumeData: ResumeData): number | null {
  // Check explicit team size field
  if (resumeData.teamSize) {
    const match = resumeData.teamSize.match(/(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  // Look in experience highlights
  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.highlights) {
        for (const highlight of exp.highlights) {
          // Look for team size mentions
          const match = highlight.match(/(?:team\s+of|scaling\s+to|led|managed)\s+(\d+)\s*(?:engineers?|people|members|reports)/i);
          if (match?.[1]) {
            return parseInt(match[1], 10);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Calculate experience alignment score (0-20 points).
 *
 * Scoring:
 * - Years match: 8 points
 * - Team size match: 6 points
 * - Title match: 6 points
 */
function calculateExperienceScore(
  jd: string,
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords
): number {
  let score = 0;

  // Years of experience match (8 points)
  const jdYears = extractYearsFromJd(jd);
  const resumeYears = resumeData.yearsExperience;

  if (jdYears !== null && resumeYears !== undefined) {
    if (resumeYears >= jdYears) {
      score += 8; // Meets or exceeds
    } else if (resumeYears >= jdYears - 2) {
      score += 5; // Close (within 2 years)
    } else if (resumeYears >= jdYears - 5) {
      score += 2; // Somewhat close
    }
  } else if (resumeYears !== undefined && resumeYears >= 5) {
    // No explicit requirement, give partial credit for experience
    score += 5;
  }

  // Team size match (6 points)
  const jdTeamSize = extractTeamSizeFromJd(jd);
  const resumeTeamSize = extractTeamSizeFromResume(resumeData);

  if (jdTeamSize !== null && resumeTeamSize !== null) {
    if (resumeTeamSize >= jdTeamSize) {
      score += 6;
    } else if (resumeTeamSize >= jdTeamSize * 0.7) {
      score += 4;
    } else if (resumeTeamSize >= jdTeamSize * 0.5) {
      score += 2;
    }
  } else if (resumeTeamSize !== null && resumeTeamSize > 0) {
    score += 3; // Has team management experience
  }

  // Title match (6 points)
  const resumeTitle = resumeData.title?.toLowerCase() || '';
  const titleKeywords = extractedKeywords.fromTitle.map(k => k.toLowerCase());

  // Check for title keyword matches
  let titleMatches = 0;
  for (const keyword of titleKeywords) {
    if (resumeTitle.includes(keyword) ||
        stemWord(resumeTitle).includes(stemWord(keyword))) {
      titleMatches++;
    }
  }

  if (titleKeywords.length > 0) {
    const titleMatchRate = titleMatches / titleKeywords.length;
    score += titleMatchRate * 6;
  } else {
    // No specific title extracted, check for common role keywords
    const hasRelevantTitle = /\b(manager|director|lead|senior|staff|principal)\b/i.test(resumeTitle);
    if (hasRelevantTitle) {
      score += 3;
    }
  }

  return Math.round(score * 10) / 10;
}

/**
 * Calculate ATS score for a resume against a job description.
 *
 * This function is deterministic - given the same inputs, it will always
 * produce the same outputs.
 *
 * @param input - Scoring input with JD, resume text, and resume data
 * @returns Detailed ATS score with breakdown and analysis
 */
export function calculateATSScore(input: ScoringInput): ATSScore {
  const { jobDescription, resumeText, resumeData } = input;

  // Handle edge cases
  if (!jobDescription || jobDescription.trim().length === 0) {
    return {
      total: 15, // Just format points
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        formatParseability: 15,
      },
      details: {
        matchedKeywords: [],
        missingKeywords: [],
        keywordDensity: 0,
        matchRate: 0,
        extractedKeywords: { all: [], fromTitle: [], fromRequired: [], technologies: [], actionVerbs: [] },
        matchDetails: [],
      },
    };
  }

  if (!resumeText || resumeText.trim().length === 0) {
    const extractedKeywords = extractKeywords(jobDescription, 20);
    return {
      total: 0,
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        formatParseability: 0,
      },
      details: {
        matchedKeywords: [],
        missingKeywords: extractedKeywords.all,
        keywordDensity: 0,
        matchRate: 0,
        extractedKeywords,
        matchDetails: [],
      },
    };
  }

  // 1. Extract keywords from JD
  const extractedKeywords = extractKeywords(jobDescription, 20);

  // 2. Match keywords against resume
  const matchResult = matchKeywords(extractedKeywords.all, resumeText);

  // 3. Calculate word count for density
  const resumeWordCount = wordCount(resumeText);

  // 4. Calculate each score component
  const keywordRelevance = calculateKeywordScore(matchResult, extractedKeywords.all.length, resumeWordCount);
  const skillsQuality = calculateSkillsScore(extractedKeywords, resumeData, matchResult);
  const experienceAlignment = calculateExperienceScore(jobDescription, resumeData, extractedKeywords);

  // Format parseability is constant for our ATS-optimized PDF
  // Our PDF generator produces single-column, standard headers, no tables/graphics
  const formatParseability = 15;

  // 5. Calculate total and create result
  const total = Math.round((keywordRelevance + skillsQuality + experienceAlignment + formatParseability) * 10) / 10;

  return {
    total: Math.min(100, total), // Cap at 100
    breakdown: {
      keywordRelevance,
      skillsQuality,
      experienceAlignment,
      formatParseability,
    },
    details: {
      matchedKeywords: matchResult.matched,
      missingKeywords: matchResult.missing,
      keywordDensity: calculateKeywordDensity(matchResult.matched.length, resumeWordCount),
      matchRate: calculateMatchRate(matchResult.matched.length, extractedKeywords.all.length),
      extractedKeywords,
      matchDetails: matchResult.matchDetails,
    },
  };
}

/**
 * Generate a plain text version of the resume for scoring.
 * Used when only structured data is available.
 */
export function resumeDataToText(data: ResumeData & {
  name?: string;
  summary?: string;
  education?: Array<{ degree?: string; institution?: string }>;
}): string {
  const parts: string[] = [];

  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  if (data.summary) parts.push(data.summary);

  // Skills
  if (data.skillsByCategory) {
    for (const category of data.skillsByCategory) {
      parts.push(category.category + ': ' + category.items.join(', '));
    }
  } else if (data.skills) {
    parts.push('Skills: ' + data.skills.join(', '));
  }

  // Experience
  if (data.experiences) {
    for (const exp of data.experiences) {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      if (exp.highlights) {
        parts.push(...exp.highlights);
      }
    }
  }

  // Education
  if (data.education) {
    for (const edu of data.education) {
      if (edu.degree) parts.push(edu.degree);
      if (edu.institution) parts.push(edu.institution);
    }
  }

  return parts.join('\n');
}

/**
 * Format score for display.
 */
export function formatScoreAssessment(score: number): string {
  if (score >= 85) return 'Excellent match - very likely to pass ATS filters';
  if (score >= 70) return 'Good match - should pass most ATS systems';
  if (score >= 55) return 'Fair match - optimization recommended';
  return 'Weak match - significant gaps identified';
}
