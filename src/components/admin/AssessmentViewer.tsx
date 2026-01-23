interface FitAssessment {
  version: number;
  assessmentId: string;
  environment: string;
  createdAt: string;
  inputType: 'text' | 'url';
  inputLength: number;
  extractedUrl?: string;
  jobDescriptionSnippet: string;
  completionLength: number;
  streamDurationMs: number;
  roleTitle?: string;
  downloadedPdf: boolean;
  downloadedMd: boolean;
  userAgent?: string;
}

interface AssessmentViewerProps {
  assessment: FitAssessment;
}

export function AssessmentViewer({ assessment }: AssessmentViewerProps) {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Assessment ID</p>
          <p className="font-mono text-xs text-[var(--color-text)]">{assessment.assessmentId}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Created</p>
          <p className="text-sm text-[var(--color-text)]">
            {new Date(assessment.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Input Type</p>
          <p className="text-sm text-[var(--color-text)]">{assessment.inputType}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Duration</p>
          <p className="text-sm text-[var(--color-text)]">
            {(assessment.streamDurationMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {/* Role Title */}
      {assessment.roleTitle && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h3 className="mb-2 font-semibold text-[var(--color-text)]">Role Title</h3>
          <p className="text-[var(--color-text)]">{assessment.roleTitle}</p>
        </div>
      )}

      {/* Job Description Snippet */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 font-semibold text-[var(--color-text)]">Job Description (First 200 chars)</h3>
        <p className="whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
          {assessment.jobDescriptionSnippet}
        </p>
        {assessment.extractedUrl && (
          <p className="mt-2 text-sm">
            <span className="text-[var(--color-text-muted)]">URL: </span>
            <a
              href={assessment.extractedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              {assessment.extractedUrl}
            </a>
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Input Length</p>
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {assessment.inputLength.toLocaleString()} chars
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Output Length</p>
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {assessment.completionLength.toLocaleString()} chars
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">PDF Downloaded</p>
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {assessment.downloadedPdf ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">MD Downloaded</p>
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {assessment.downloadedMd ? 'Yes' : 'No'}
          </p>
        </div>
      </div>

      {/* User Agent */}
      {assessment.userAgent && (
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">User Agent</p>
          <p className="font-mono text-xs text-[var(--color-text)]">{assessment.userAgent}</p>
        </div>
      )}
    </div>
  );
}
