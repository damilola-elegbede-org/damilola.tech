/**
 * Types for the ATS Resume Generator feature.
 *
 * Scoring methodology is research-backed:
 * - Keyword Relevance (40%): 99.7% of recruiters use keyword filters (Jobscan)
 * - Skills Quality (25%): 76.4% of recruiters start with skills (Jobscan)
 * - Experience Alignment (20%): Years, scope, title matching
 * - Format Parseability (15%): Single-column 93% parse rate (Enhancv 2026)
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

export interface EstimatedCompatibility {
  /** Total score before optimization (0-100) */
  before: number;
  /** Total score after optimization (0-100) */
  after: number;
  /** Detailed breakdown of score components */
  breakdown: ScoreBreakdown;
}

export interface ProposedChange {
  /** Section being modified (e.g., "summary", "experience.verily.bullet1") */
  section: string;
  /** Original content */
  original: string;
  /** Proposed modified content */
  modified: string;
  /** Explanation of why this change improves ATS compatibility */
  reason: string;
  /** Keywords from JD that were incorporated */
  keywordsAdded: string[];
  /** Estimated points gained from this change */
  impactPoints: number;
}

export interface Gap {
  /** The JD requirement that's not met */
  requirement: string;
  /** How serious is this gap */
  severity: 'critical' | 'moderate' | 'minor';
  /** Is this skill/experience in the resume */
  inResume: boolean;
  /** Suggested way to address in interview or cover letter */
  mitigation: string;
}

export interface JDAnalysis {
  /** Brief summary of the role and key requirements */
  jdSummary: string;
  /** Company name extracted from JD */
  companyName: string;
  /** Role title extracted from JD */
  roleTitle: string;
  /** Department or team if mentioned */
  department?: string;
  /** Top keywords from JD (titles, skills, technologies, action verbs) */
  topKeywords: string[];
  /** Required skills identified */
  requiredSkills: string[];
  /** Nice-to-have skills identified */
  niceToHaveSkills: string[];
  /** Years of experience required */
  yearsRequired: string;
  /** Team size or scope mentioned */
  teamSize?: string;
  /** Expected scope of responsibility */
  scopeExpected?: string;
  /** Industry-specific requirements or context */
  industryContext?: string;
}

export interface SkillsReorder {
  /** Original order of skills */
  before: string[];
  /** Proposed new order based on JD relevance */
  after: string[];
  /** Explanation of reordering rationale */
  reason: string;
}

export interface ResumeAnalysisResult {
  /** Analysis of the job description */
  analysis: JDAnalysis;
  /** Current resume score before optimization */
  currentScore: {
    /** Total score (0-100) */
    total: number;
    /** Score breakdown by component */
    breakdown: ScoreBreakdown;
    /** Assessment summary */
    assessment: string;
  };
  /** Proposed changes to optimize the resume */
  proposedChanges: ProposedChange[];
  /** Projected score after accepting all changes */
  optimizedScore: {
    /** Total score (0-100) */
    total: number;
    /** Score breakdown by component */
    breakdown: ScoreBreakdown;
    /** Assessment summary */
    assessment: string;
  };
  /** Gaps identified between resume and JD */
  gaps: Gap[];
  /** Proposed skills section reordering */
  skillsReorder: SkillsReorder;
  /** Interview preparation tips based on gaps */
  interviewPrep: string[];
}

export type ApplicationStatus = 'draft' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface ResumeGenerationLog {
  /** Schema version for future migrations */
  version: 1;
  /** Unique identifier for this generation */
  generationId: string;
  /** Environment (production or preview) */
  environment: string;
  /** Timestamp of generation */
  createdAt: string;

  // Job Details
  /** Whether input was pasted text or URL */
  inputType: 'text' | 'url';
  /** Original URL if URL was provided */
  extractedUrl?: string;
  /** Company name extracted from JD */
  companyName: string;
  /** Role title extracted from JD */
  roleTitle: string;
  /** Full JD text for reference */
  jobDescriptionFull: string;

  // Scoring
  /** Estimated compatibility scores (research-backed naming) */
  estimatedCompatibility: EstimatedCompatibility;

  // Changes Made
  /** Changes that were accepted */
  changesAccepted: ProposedChange[];
  /** Changes that were rejected */
  changesRejected: ProposedChange[];
  /** Gaps identified */
  gapsIdentified: Gap[];

  // Output
  /** URL of generated PDF in blob storage */
  pdfUrl: string;
  /** The optimized resume data */
  optimizedResumeJson: Record<string, unknown>;

  // Tracking
  /** Current application status */
  applicationStatus: ApplicationStatus;
  /** Date when application was submitted */
  appliedDate?: string;
  /** User notes about this application */
  notes?: string;
}

export interface ResumeGenerationSummary {
  /** Unique identifier */
  id: string;
  /** Generation ID */
  generationId: string;
  /** Environment */
  environment: string;
  /** Creation timestamp */
  timestamp: string;
  /** Company name */
  companyName: string;
  /** Role title */
  roleTitle: string;
  /** Score before optimization */
  scoreBefore: number;
  /** Score after optimization */
  scoreAfter: number;
  /** Application status */
  applicationStatus: ApplicationStatus;
  /** Blob URL */
  url: string;
  /** Size in bytes */
  size: number;
}

export interface ResumeGeneratorRequest {
  /** Job description (text or URL) */
  jobDescription: string;
}

export interface ResumeGeneratorAnalyzeResponse {
  /** Analysis results */
  result: ResumeAnalysisResult;
  /** Whether input was detected as URL */
  wasUrl: boolean;
  /** Extracted URL if applicable */
  extractedUrl?: string;
}

export interface ResumeGeneratorGenerateRequest {
  /** Original JD text */
  jobDescription: string;
  /** Analysis result from analyze step */
  analysisResult: ResumeAnalysisResult;
  /** Indices of accepted changes */
  acceptedChangeIndices: number[];
}

export interface ResumeGeneratorGenerateResponse {
  /** URL of generated PDF */
  pdfUrl: string;
  /** Generation log ID for future reference */
  generationId: string;
}
