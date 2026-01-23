export interface FitAssessmentLog {
  version: 1;
  assessmentId: string;           // UUID
  environment: string;            // production, preview, development
  createdAt: string;              // ISO timestamp
  inputType: 'text' | 'url';
  inputLength: number;
  extractedUrl?: string;
  jobDescriptionSnippet: string;  // First 200 chars
  completionLength: number;
  streamDurationMs: number;
  roleTitle?: string;             // Extracted from response
  downloadedPdf: boolean;
  downloadedMd: boolean;
  userAgent?: string;
}
