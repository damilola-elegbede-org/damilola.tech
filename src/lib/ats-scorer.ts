/**
 * Deterministic ATS Scoring
 *
 * Research-backed scoring algorithm for ATS compatibility.
 * Produces identical scores across multiple runs for the same inputs.
 *
 * Scoring breakdown (0-100 total):
 * - Keyword Relevance: 0-45 points (weighted by JD section priority + placement + frequency)
 * - Skills Quality: 0-25 points (required coverage, JD alignment, breadth)
 * - Experience Alignment: 0-20 points (smooth year curve, team/depth, title, education)
 * - Match Quality: 0-10 points (exact ratio, density compliance, section completeness)
 *
 * Sources: 20+ industry sources including Jobscan, Indeed, LinkedIn Talent Report
 */

import {
  extractKeywords,
  matchKeywords,
  wordCount,
  calculateMatchRate,
  calculateKeywordDensity,
  calculateActualKeywordDensity,
  calculateDynamicKeywordCount,
  stemWord,
  type ExtractedKeywords,
  type MatchResult,
  type KeywordPriority,
} from './ats-keywords';

/**
 * Score breakdown by category.
 */
export interface ScoreBreakdown {
  /** Keyword matching score (0-45) */
  keywordRelevance: number;
  /** Skills section quality (0-25) */
  skillsQuality: number;
  /** Experience alignment (0-20) */
  experienceAlignment: number;
  /** Match quality score (0-10) — measures exact match ratio, density, section completeness */
  contentQuality: number;
}

/**
 * Detailed ATS score with breakdown and analysis.
 */
export interface ATSScore {
  /** Total score (0-100) */
  total: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Whether the generated PDF is ATS-optimized */
  isATSOptimized: boolean;
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
  /** Education entries */
  education?: Array<{
    degree?: string;
    institution?: string;
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
 * Calculate keyword relevance score (0-45 points).
 *
 * Point values per keyword (by priority and match type):
 * - Title:           exact=3.5, stem=2,   synonym=1.5
 * - Required:        exact=3,   stem=2,   synonym=1
 * - Responsibilities:exact=2,   stem=1.5, synonym=0.75
 * - Nice-to-have:    exact=2,   stem=1,   synonym=0.5
 * - General:         exact=1.5, stem=0.5, synonym=0.5
 *
 * Frequency multiplier: 1 + min(0.5, (freq-1) * 0.1)
 * Placement bonus: +1.5 (title), +1.0 (summary), +0.5 (first bullet)
 * Penalty: -5 if actual keyword density > 3% or any keyword stuffed
 */
function calculateKeywordScore(
  matchResult: MatchResult,
  extractedKeywords: ExtractedKeywords,
  resumeText: string,
  resumeWordCount: number,
  resumeData: ResumeData
): number {
  let score = 0;
  const priorities = extractedKeywords.keywordPriorities;
  const frequencies = extractedKeywords.keywordFrequency || {};

  // Build resume zones for placement bonus
  const resumeTitle = (resumeData.title || '').toLowerCase();
  const resumeLines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const summaryText = resumeLines.slice(0, 3).join(' ').toLowerCase();
  const firstBullets = new Set<string>();
  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.highlights && exp.highlights.length > 0) {
        firstBullets.add(exp.highlights[0].toLowerCase());
      }
    }
  }
  const firstBulletsText = [...firstBullets].join(' ');

  // Calculate points based on match type, priority, and frequency
  for (const detail of matchResult.matchDetails) {
    const priority: KeywordPriority = priorities[detail.keyword] || 'general';
    let points = 0;

    switch (priority) {
      case 'title':
        switch (detail.matchType) {
          case 'exact': points = 3.5; break;
          case 'stem': points = 2; break;
          case 'synonym': points = 1.5; break;
        }
        break;
      case 'required':
        switch (detail.matchType) {
          case 'exact': points = 3; break;
          case 'stem': points = 2; break;
          case 'synonym': points = 1; break;
        }
        break;
      case 'responsibilities':
        switch (detail.matchType) {
          case 'exact': points = 2; break;
          case 'stem': points = 1.5; break;
          case 'synonym': points = 0.75; break;
        }
        break;
      case 'niceToHave':
        switch (detail.matchType) {
          case 'exact': points = 2; break;
          case 'stem': points = 1; break;
          case 'synonym': points = 0.5; break;
        }
        break;
      default: // 'general'
        switch (detail.matchType) {
          case 'exact': points = 1.5; break;
          case 'stem': points = 0.5; break;
          case 'synonym': points = 0.5; break;
        }
        break;
    }

    // Apply frequency multiplier: 1 + min(0.5, (freq-1) * 0.1)
    const freq = frequencies[detail.keyword] || 1;
    const multiplier = 1 + Math.min(0.5, (freq - 1) * 0.1);
    points *= multiplier;

    // Placement bonus: check if keyword appears in resume title/summary/first bullet
    // Use word-boundary regex for short keywords to avoid substring false-positives
    const kwLower = detail.keyword.toLowerCase();
    const isShortKw = kwLower.length <= 3 && !kwLower.includes(' ');
    const kwMatch = (text: string) => {
      if (isShortKw) {
        const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`).test(text);
      }
      return text.includes(kwLower);
    };
    if (kwMatch(resumeTitle)) {
      points += 1.5;
    } else if (kwMatch(summaryText)) {
      points += 1.0;
    } else if (kwMatch(firstBulletsText)) {
      points += 0.5;
    }

    score += points;
  }

  // Cap at 45 points
  score = Math.min(score, 45);

  // Penalty for extreme keyword stuffing only (density compliance handled by Match Quality)
  const actualDensity = calculateActualKeywordDensity(resumeText, matchResult.matched);
  if (actualDensity.stuffedKeywords.length >= 3) {
    score = Math.max(0, score - 5);
  }

  return Math.round(score * 10) / 10; // One decimal place
}

/**
 * Calculate skills quality score (0-25 points).
 *
 * Sub-scores (pure ATS signals, no organization bonus):
 * - Required skills coverage (12pts): JD technologies present in skills section
 * - Skills-JD alignment (8pts): Top JD keywords appearing in skills section
 * - Skills breadth (5pts): Having relevant adjacent skills beyond strict JD requirements
 *
 * Skills already credited in keyword score get 30% credit (de-overlap).
 */
function calculateSkillsScore(
  extractedKeywords: ExtractedKeywords,
  resumeData: ResumeData,
  matchedKeywordsInText: Set<string>
): number {
  let score = 0;

  // Get all skills from resume (normalized)
  const resumeSkills = new Set<string>();
  const addSkill = (s: string) => {
    const lower = s.toLowerCase();
    resumeSkills.add(lower);
    // Also add normalized version (ci/cd → cicd, etc.)
    const normalized = lower.replace(/ci\/cd/g, 'cicd').replace(/\./g, '').replace(/\+\+/g, 'pp');
    if (normalized !== lower) resumeSkills.add(normalized);
  };
  if (resumeData.skills) {
    for (const skill of resumeData.skills) {
      addSkill(skill);
    }
  }
  if (resumeData.skillsByCategory) {
    for (const category of resumeData.skillsByCategory) {
      addSkill(category.category); // Include category names
      for (const item of category.items) {
        addSkill(item);
      }
    }
  }

  // Required skills coverage (12pts): JD technologies in skills section
  const techKeywords = extractedKeywords.technologies;
  let techMatches = 0;
  for (const tech of techKeywords) {
    const isInSkills = resumeSkills.has(tech) || [...resumeSkills].some(s => s.includes(tech));
    if (isInSkills) {
      // De-overlap: if already matched in keyword score, give 80% credit
      const alreadyMatched = matchedKeywordsInText.has(tech);
      techMatches += alreadyMatched ? 0.8 : 1;
    }
  }

  if (techKeywords.length > 0) {
    score += Math.min(12, (techMatches / techKeywords.length) * 12);
  } else {
    score += resumeSkills.size > 0 ? 6 : 0;
  }

  // Skills-JD alignment (8pts): Top JD keywords in skills section, weighted by priority
  const topJdKeywords = extractedKeywords.all.slice(0, 8);
  let alignedScore = 0;
  for (const keyword of topJdKeywords) {
    const isInSkills = resumeSkills.has(keyword) ||
      [...resumeSkills].some(s => s.toLowerCase().includes(keyword.toLowerCase()));
    if (isInSkills) {
      const priority = extractedKeywords.keywordPriorities[keyword] || 'general';
      const weight = priority === 'title' ? 2 : priority === 'required' ? 1.5 : 1;
      // De-overlap
      const alreadyMatched = matchedKeywordsInText.has(keyword);
      alignedScore += (alreadyMatched ? 0.8 : 1) * weight;
    }
  }
  score += Math.min(8, (alignedScore / Math.max(topJdKeywords.length, 1)) * 8);

  // Skills breadth (5pts): relevant adjacent skills beyond strict JD match
  const techKeywordsSet = new Set(techKeywords);
  const extraSkills = [...resumeSkills].filter(s =>
    !matchedKeywordsInText.has(s) &&
    !techKeywordsSet.has(s) &&
    s.length > 2
  );
  const breadthScore = Math.min(5, extraSkills.length * 0.5);
  score += breadthScore;

  return Math.min(25, Math.round(score * 10) / 10);
}

/**
 * Extract years of experience from JD text.
 */
function extractYearsFromJd(jd: string): number | null {
  const patterns = [
    // "10+ years of experience", "10+ years software engineering experience"
    /(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){0,4}(?:experience|exp)\b/i,
    // Simple "10+ years" standalone
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
  if (resumeData.teamSize) {
    const match = resumeData.teamSize.match(/(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.highlights) {
        for (const highlight of exp.highlights) {
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
 * Detect whether a JD is for an IC (individual contributor) or management role.
 */
function detectRoleType(jd: string): 'ic' | 'management' {
  const lower = jd.toLowerCase();
  const mgmtSignals = ['manage', 'direct reports', 'team of', 'people management',
    'managing', 'supervise', 'leadership of', 'lead a team', 'build a team',
    'engineering manager', 'director of', 'head of'];
  const icSignals = ['individual contributor', 'hands-on', 'write code',
    'coding', 'implement', 'no direct reports', 'ic role'];

  let mgmtScore = 0;
  let icScore = 0;

  for (const signal of mgmtSignals) {
    if (lower.includes(signal)) mgmtScore++;
  }
  for (const signal of icSignals) {
    if (lower.includes(signal)) icScore++;
  }

  if (mgmtScore > icScore && mgmtScore >= 2) return 'management';
  // Default to IC when no clear management signals — most engineering JDs are IC
  return 'ic';
}

/**
 * Education level enumeration for matching.
 */
type EducationLevel = 'bachelor' | 'master' | 'phd' | 'associate' | null;

/**
 * Extract education requirement from JD.
 */
function extractEducationFromJd(jd: string): { level: EducationLevel; field: string | null } {
  const lower = jd.toLowerCase();

  let level: EducationLevel = null;
  let field: string | null = null;

  if (/\b(ph\.?d|doctorate|doctoral)\b/.test(lower)) {
    level = 'phd';
  } else if (/\b(master'?s?|m\.?s\.?|m\.?a\.?|mba)\b/.test(lower)) {
    level = 'master';
  } else if (/\b(bachelor'?s?|b\.?s\.?|b\.?a\.?|undergraduate|college degree)\b/.test(lower)) {
    level = 'bachelor';
  } else if (/\b(associate'?s?|a\.?s\.?)\b/.test(lower)) {
    level = 'associate';
  }

  if (/\b(computer science|cs|software engineering|information technology)\b/.test(lower) || /\bI\.?T\.?\b/.test(jd)) {
    field = 'cs';
  } else if (/\b(engineering|technical)\b/.test(lower) && level) {
    field = 'engineering';
  }

  return { level, field };
}

/**
 * Match education level from resume data.
 */
function matchEducation(
  resumeData: ResumeData,
  jdRequirement: { level: EducationLevel; field: string | null }
): number {
  if (!jdRequirement.level || !resumeData.education || resumeData.education.length === 0) {
    return 0;
  }

  const educationLevels: Record<string, number> = {
    'associate': 1, 'bachelor': 2, 'master': 3, 'phd': 4,
  };

  const requiredLevel = educationLevels[jdRequirement.level] || 0;
  let bestLevel = 0;
  let fieldMatch = false;

  for (const edu of resumeData.education) {
    const degreeLower = (edu.degree || '').toLowerCase();

    if (/\b(ph\.?d|doctorate)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 4);
    else if (/\b(master|m\.?s\.?|m\.?a\.?|mba)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 3);
    else if (/\b(bachelor|b\.?s\.?|b\.?a\.?)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 2);
    else if (/\b(associate|a\.?s\.?)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 1);

    if (jdRequirement.field === 'cs' &&
        /\b(computer|software|information|computing|cs)\b/.test(degreeLower)) {
      fieldMatch = true;
    } else if (jdRequirement.field === 'engineering' &&
               /\b(engineer|technical|computer|science)\b/.test(degreeLower)) {
      fieldMatch = true;
    }
  }

  let points = 0;
  if (bestLevel >= requiredLevel) {
    points = 2;
  } else if (bestLevel >= requiredLevel - 1) {
    points = 1;
  }

  if (fieldMatch && points > 0) {
    points = Math.min(3, points + 1);
  }

  return points;
}

/**
 * Check domain relevance between resume title and JD title keywords.
 * Returns discount factor (0.6 for no overlap, 1.0 for overlap).
 */
function calculateDomainRelevance(
  resumeTitle: string,
  jdTitleKeywords: string[]
): number {
  if (jdTitleKeywords.length === 0) return 1.0;

  const titleLower = resumeTitle.toLowerCase();
  const titleWords = titleLower.split(/\s+/);
  const titleStems = titleWords.map(stemWord);

  let overlap = 0;
  for (const jdKw of jdTitleKeywords) {
    const jdLower = jdKw.toLowerCase();
    const jdStem = stemWord(jdLower);
    if (titleLower.includes(jdLower) || titleStems.includes(jdStem)) {
      overlap++;
    }
  }

  return overlap > 0 ? 1.0 : 0.6; // 40% discount for zero overlap
}

/**
 * Calculate experience alignment score (0-20 points).
 *
 * Uses smooth exponential decay for year deficits instead of cliff function.
 * Applies mild overqualification penalty when resume years > JD years * 1.8.
 * Applies domain-relevance gate: 40% discount if resume title has zero
 * overlap with JD title keywords.
 */
function calculateExperienceScore(
  jd: string,
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords
): number {
  let score = 0;
  const roleType = detectRoleType(jd);
  const isIC = roleType === 'ic';

  // Domain relevance gate
  const domainFactor = calculateDomainRelevance(
    resumeData.title || '',
    extractedKeywords.fromTitle
  );

  // Years of experience match (6 pts management, 9 pts IC) — smooth curve
  const yearsMax = isIC ? 9 : 6;
  const jdYears = extractYearsFromJd(jd);
  const resumeYears = resumeData.yearsExperience;

  if (jdYears !== null && resumeYears !== undefined) {
    if (resumeYears >= jdYears) {
      let yearScore = yearsMax;
      // Mild overqualification penalty when resumeYears > jdYears * 1.8
      if (jdYears > 0 && resumeYears > jdYears * 1.8) {
        const overRatio = resumeYears / jdYears;
        const penalty = Math.min(0.15, (overRatio - 1.8) * 0.1);
        yearScore *= (1 - penalty);
      }
      score += yearScore;
    } else {
      // Smooth exponential decay: exp(-deficit / (jdYears * 0.3))
      const deficit = jdYears - resumeYears;
      const denominator = Math.max(jdYears * 0.3, 0.5);
      const decay = Math.exp(-deficit / denominator);
      score += yearsMax * decay;
    }
  } else if (resumeYears !== undefined && resumeYears >= 5) {
    score += Math.round(yearsMax * 0.625 * 10) / 10;
  }

  // Team size / technical depth
  if (isIC) {
    const hasMultipleExperiences = (resumeData.experiences?.length || 0) >= 2;
    const hasSkills = (resumeData.skills?.length || 0) + (resumeData.skillsByCategory?.length || 0) > 0;
    if (hasMultipleExperiences && hasSkills) {
      score += 3;
    } else if (hasMultipleExperiences || hasSkills) {
      score += 1.5;
    }
  } else {
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
      score += 3;
    }
  }

  // Title match (5 points)
  const resumeTitle = resumeData.title?.toLowerCase() || '';
  const titleKeywords = extractedKeywords.fromTitle.map(k => k.toLowerCase());

  let titleMatches = 0;
  for (const keyword of titleKeywords) {
    if (resumeTitle.includes(keyword) ||
        stemWord(resumeTitle).includes(stemWord(keyword))) {
      titleMatches++;
    }
  }

  if (titleKeywords.length > 0) {
    const titleMatchRate = titleMatches / titleKeywords.length;
    score += titleMatchRate * 5;
  } else {
    const hasRelevantTitle = /\b(manager|director|lead|senior|staff|principal)\b/i.test(resumeTitle);
    if (hasRelevantTitle) {
      score += 2.5;
    }
  }

  // Education match (3 points)
  const educationReq = extractEducationFromJd(jd);
  if (educationReq.level) {
    score += matchEducation(resumeData, educationReq);
  } else if (resumeData.education && resumeData.education.length > 0) {
    score += 1;
  }

  // Apply domain relevance factor
  score *= domainFactor;

  return Math.min(20, Math.round(score * 10) / 10);
}

/**
 * Calculate match quality score (0-10 points).
 *
 * Replaces old Content Quality (which measured writing advice, not ATS signals).
 * Sub-scores:
 * - Exact match ratio (4pts): % of keyword matches that are exact vs stem/synonym
 * - Keyword density compliance (3pts): Is density in optimal 2-3% range
 * - Section completeness (3pts): Resume data has all ATS-expected fields populated
 */
function calculateMatchQuality(
  matchResult: MatchResult,
  resumeText: string,
  resumeData: ResumeData
): number {
  let score = 0;

  // Exact match ratio (4pts)
  if (matchResult.matchDetails.length > 0) {
    const exactMatches = matchResult.matchDetails.filter(d => d.matchType === 'exact').length;
    const exactRatio = exactMatches / matchResult.matchDetails.length;
    score += exactRatio * 4;
  }

  // Keyword density compliance (3pts)
  if (matchResult.matched.length > 0 && resumeText.length > 0) {
    const density = calculateActualKeywordDensity(resumeText, matchResult.matched);
    const d = density.overallDensity;
    if (d >= 2 && d <= 3) {
      score += 3; // Optimal range
    } else if (d >= 1 && d < 2) {
      score += 2; // Slightly low
    } else if (d > 3 && d <= 4) {
      score += 2; // Slightly high
    } else if (d >= 0.5 && d < 1) {
      score += 1; // Too low
    } else if (d > 4) {
      score += 0.5; // Too high
    }
    // d < 0.5: 0 points
  }

  // Section completeness (3pts): resume data has all ATS-expected fields
  let completeness = 0;
  if (resumeData.title && resumeData.title.length > 0) completeness += 0.5;
  if ((resumeData.skills && resumeData.skills.length > 0) ||
      (resumeData.skillsByCategory && resumeData.skillsByCategory.length > 0)) completeness += 0.75;
  if (resumeData.experiences && resumeData.experiences.length > 0) {
    completeness += 0.5;
    // Bonus for experiences with highlights
    const hasHighlights = resumeData.experiences.some(e => e.highlights && e.highlights.length > 0);
    if (hasHighlights) completeness += 0.5;
  }
  if (resumeData.education && resumeData.education.length > 0) completeness += 0.75;
  score += Math.min(3, completeness);

  return Math.round(score * 10) / 10;
}

/**
 * Create empty ExtractedKeywords with all fields.
 */
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
      total: 0,
      isATSOptimized: true,
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        contentQuality: 0,
      },
      details: {
        matchedKeywords: [],
        missingKeywords: [],
        keywordDensity: 0,
        matchRate: 0,
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
      isATSOptimized: true,
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        contentQuality: 0,
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

  // 1. Extract keywords from JD (dynamic count based on JD complexity)
  const dynamicCount = calculateDynamicKeywordCount(jobDescription);
  const extractedKeywords = extractKeywords(jobDescription, dynamicCount);

  // 2. Match keywords against resume
  const matchResult = matchKeywords(extractedKeywords.all, resumeText);

  // 3. Calculate word count for density
  const resumeWordCount = wordCount(resumeText);

  // 4. Build set of matched keywords for de-overlap in skills scoring
  const matchedKeywordsInText = new Set(matchResult.matched.map(k => k.toLowerCase()));

  // 5. Calculate each score component
  const keywordRelevance = calculateKeywordScore(matchResult, extractedKeywords, resumeText, resumeWordCount, resumeData);
  const skillsQuality = calculateSkillsScore(extractedKeywords, resumeData, matchedKeywordsInText);
  const experienceAlignment = calculateExperienceScore(jobDescription, resumeData, extractedKeywords);
  const contentQuality = calculateMatchQuality(matchResult, resumeText, resumeData);

  // 6. Calculate total and create result
  const total = Math.round((keywordRelevance + skillsQuality + experienceAlignment + contentQuality) * 10) / 10;

  return {
    total: Math.min(100, total),
    isATSOptimized: true,
    breakdown: {
      keywordRelevance,
      skillsQuality,
      experienceAlignment,
      contentQuality,
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
 * Format score for display.
 */
export function formatScoreAssessment(score: number): string {
  if (score >= 85) return 'Excellent match - highly likely to pass ATS filters';
  if (score >= 70) return 'Good match - should pass most ATS systems';
  if (score >= 55) return 'Fair match - optimization recommended';
  return 'Weak match - significant gaps identified';
}
