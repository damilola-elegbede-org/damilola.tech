/**
 * Types for the ATS Resume Generator feature.
 *
 * Scoring methodology is research-backed:
 * - Keyword Relevance (40%): 99.7% of recruiters use keyword filters (Jobscan)
 * - Skills Quality (25%): 76.4% of recruiters start with skills (Jobscan)
 * - Experience Alignment (20%): Years, scope, title matching
 * - Format Parseability (15%): Single-column 93% parse rate (Enhancv 2026)
 */

// Re-export job ID types for convenience
export type { JobId, JobIdentifier } from '@/lib/job-id';

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

/**
 * Entry in the generation history for a tracked job.
 * Each time a resume is regenerated for the same job, a history entry is added.
 */
export interface GenerationHistoryEntry {
  /** Unique ID of this specific generation */
  generationId: string;
  /** When this generation was created */
  generatedAt: string;
  /** URL of the PDF for this generation */
  pdfUrl: string;
  /** ATS score before optimization */
  scoreBefore: number;
  /** ATS score after optimization */
  scoreAfter: number;
  /** Number of proposed changes that were accepted */
  changesAccepted: number;
  /** Number of proposed changes that were rejected */
  changesRejected: number;
}

/**
 * Filters for querying resume generations.
 */
export interface ResumeGenerationFilters {
  /** Filter by application status */
  applicationStatus?: ApplicationStatus;
  /** Filter by company name (partial match, case-insensitive) */
  companyName?: string;
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Filter by minimum final (after) score */
  minScore?: number;
  /** Filter by maximum final (after) score */
  maxScore?: number;
}

/**
 * V1 resume generation log (original format).
 * Retained for backward compatibility during lazy migration.
 */
export interface ResumeGenerationLogV1 {
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

/**
 * V2 resume generation log with job tracking support.
 * Adds deduplication via jobId and generation history.
 */
export interface ResumeGenerationLogV2 {
  /** Schema version */
  version: 2;
  /** Unique job identifier (hash of URL or title+company) */
  jobId: string;
  /** How the job ID was generated */
  jobIdentifier: import('@/lib/job-id').JobIdentifier;
  /** Environment (production or preview) */
  environment: string;
  /** When this job was first tracked */
  createdAt: string;
  /** When this job record was last updated */
  updatedAt: string;

  // Job Details (latest)
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
  /** Date job was posted (extracted from JD, optional) */
  datePosted?: string;

  // Current/Latest Scoring
  /** Estimated compatibility scores from latest generation */
  estimatedCompatibility: EstimatedCompatibility;

  // Latest Changes Made
  /** Changes that were accepted in latest generation */
  changesAccepted: ProposedChange[];
  /** Changes that were rejected in latest generation */
  changesRejected: ProposedChange[];
  /** Gaps identified in latest generation */
  gapsIdentified: Gap[];

  // Current Output
  /** Most recent generation ID */
  generationId: string;
  /** URL of most recent generated PDF */
  pdfUrl: string;
  /** The optimized resume data from latest generation */
  optimizedResumeJson: Record<string, unknown>;

  // History
  /** All previous generations for this job (newest first) */
  generationHistory: GenerationHistoryEntry[];

  // Tracking
  /** Current application status */
  applicationStatus: ApplicationStatus;
  /** Date when application was submitted */
  appliedDate?: string;
  /** User notes about this application */
  notes?: string;
}

/**
 * Union type for all resume generation log versions.
 * Used for reading - code should handle both versions.
 */
export type ResumeGenerationLog = ResumeGenerationLogV1 | ResumeGenerationLogV2;

/**
 * Type guard to check if a log is V2.
 */
export function isV2Log(log: ResumeGenerationLog): log is ResumeGenerationLogV2 {
  return log.version === 2;
}

/**
 * Type guard to check if a log is V1.
 */
export function isV1Log(log: ResumeGenerationLog): log is ResumeGenerationLogV1 {
  return log.version === 1;
}

export interface ResumeGenerationSummary {
  /** Unique identifier (blob pathname) */
  id: string;
  /** Job ID for deduplication (v2) or computed from v1 data */
  jobId: string;
  /** Generation ID (most recent) */
  generationId: string;
  /** Environment */
  environment: string;
  /** Creation timestamp */
  timestamp: string;
  /** Last updated timestamp (v2 only, same as timestamp for v1) */
  updatedAt: string;
  /** Company name */
  companyName: string;
  /** Role title */
  roleTitle: string;
  /** Score before optimization (most recent) */
  scoreBefore: number;
  /** Score after optimization (most recent) */
  scoreAfter: number;
  /** Application status */
  applicationStatus: ApplicationStatus;
  /** Blob URL */
  url: string;
  /** Size in bytes */
  size: number;
  /** Number of generations for this job (1 for v1, history.length + 1 for v2) */
  generationCount: number;
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
