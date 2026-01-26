'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ResumeGeneratorForm } from '@/components/admin/ResumeGeneratorForm';
import { CompatibilityScoreCard } from '@/components/admin/CompatibilityScoreCard';
import { ChangePreviewPanel } from '@/components/admin/ChangePreviewPanel';
import { trackEvent } from '@/lib/audit-client';
import { generateJobId, extractDatePosted } from '@/lib/job-id';
import type { ResumeAnalysisResult } from '@/lib/types/resume-generation';
import type { ResumeData } from '@/lib/resume-pdf';

// Dynamically import PDF generator to avoid SSR issues with @react-pdf/renderer
// See: https://github.com/diegomura/react-pdf/issues/3156
const generateResumePdfDynamic = async (
  data: ResumeData,
  analysis: import('@/lib/types/resume-generation').ResumeAnalysisResult,
  acceptedIndices: Set<number>
): Promise<Blob> => {
  const { generateResumePdf } = await import('@/lib/resume-pdf');
  return generateResumePdf(data, analysis, acceptedIndices);
};

const getResumeFilenameDynamic = (companyName: string, roleTitle: string): string => {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
  return `${sanitize(companyName)}-${sanitize(roleTitle)}.pdf`;
};

type Phase = 'input' | 'analyzing' | 'preview' | 'generating' | 'complete';

export default function ResumeGeneratorPage() {
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  // Fetch resume data on mount
  useEffect(() => {
    fetch('/api/resume-data')
      .then((res) => res.json())
      .then((data) => setResumeData(data))
      .catch((err) => console.error('Failed to load resume data:', err));
  }, []);

  const handleAnalyze = async (jd: string) => {
    setJobDescription(jd);
    setError(null);
    setStreamingText('');
    setPhase('analyzing');

    try {
      const response = await fetch('/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });

      if (!response.ok) {
        // For non-streaming error responses, parse JSON
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullText = '';
      let isFirstLine = true;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Extract metadata from first line (metadata contains wasUrl, extractedUrl)
        if (isFirstLine && fullText.includes('\n')) {
          const newlineIndex = fullText.indexOf('\n');
          // Skip the metadata line, we don't need it client-side
          fullText = fullText.substring(newlineIndex + 1);
          isFirstLine = false;
        }

        // Update streaming text for progress display (without metadata)
        if (!isFirstLine) {
          setStreamingText(fullText);
        }
      }

      // Flush any remaining bytes from the decoder
      fullText += decoder.decode();

      // Parse the JSON result
      let jsonText = fullText.trim();
      // Clean potential markdown code blocks
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const result: ResumeAnalysisResult = JSON.parse(jsonText);

      setAnalysisResult(result);
      // Pre-select all changes as accepted by default
      setAcceptedIndices(new Set(result.proposedChanges.map((_: unknown, i: number) => i)));
      setRejectedIndices(new Set());
      setStreamingText('');
      setPhase('preview');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStreamingText('');
      setPhase('input');
    }
  };

  const handleAcceptChange = useCallback((index: number) => {
    setAcceptedIndices((prev) => new Set([...prev, index]));
    setRejectedIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const handleRejectChange = useCallback((index: number) => {
    setRejectedIndices((prev) => new Set([...prev, index]));
    setAcceptedIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const handleGeneratePdf = async () => {
    if (!analysisResult || !resumeData) return;

    setPhase('generating');
    setError(null);

    try {
      // Generate PDF using @react-pdf/renderer (native text-based PDF)
      // Uses dynamic import to avoid SSR issues
      const pdfBlob = await generateResumePdfDynamic(resumeData, analysisResult, acceptedIndices);

      // Upload PDF to blob storage
      const filename = getResumeFilenameDynamic(analysisResult.analysis.companyName, analysisResult.analysis.roleTitle);
      const formData = new FormData();
      formData.append('pdf', pdfBlob, filename);
      formData.append('companyName', analysisResult.analysis.companyName);
      formData.append('roleTitle', analysisResult.analysis.roleTitle);

      const uploadResponse = await fetch('/api/resume-generator/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        throw new Error(uploadData.error || 'Failed to upload PDF');
      }

      const { url: pdfUrl } = await uploadResponse.json();
      setGeneratedPdfUrl(pdfUrl);

      // Log the generation
      const generationId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const acceptedChanges = analysisResult.proposedChanges.filter((_, i) =>
        acceptedIndices.has(i)
      );
      const rejectedChanges = analysisResult.proposedChanges.filter((_, i) =>
        rejectedIndices.has(i)
      );

      // Calculate optimized score based on accepted changes
      const acceptedPoints = acceptedChanges.reduce((sum, c) => sum + c.impactPoints, 0);
      const optimizedScore = Math.min(
        100,
        analysisResult.currentScore.total + acceptedPoints
      );

      // Generate job identifier for deduplication
      const isUrl = jobDescription.trim().startsWith('http');
      const extractedUrl = isUrl ? jobDescription.trim() : undefined;
      const jobIdentifier = generateJobId(
        extractedUrl
          ? { url: extractedUrl }
          : {
              title: analysisResult.analysis.roleTitle,
              company: analysisResult.analysis.companyName,
            }
      );

      // Extract date posted from JD text (optional)
      const datePosted = extractDatePosted(jobDescription);

      // Fire-and-forget logging - don't fail generation if logging fails
      fetch('/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId,
          jobId: jobIdentifier.jobId,
          jobIdentifier,
          companyName: analysisResult.analysis.companyName,
          roleTitle: analysisResult.analysis.roleTitle,
          jobDescriptionFull: jobDescription,
          datePosted,
          inputType: isUrl ? 'url' : 'text',
          extractedUrl,
          estimatedCompatibility: {
            before: analysisResult.currentScore.total,
            after: optimizedScore,
            breakdown: analysisResult.optimizedScore.breakdown,
          },
          changesAccepted: acceptedChanges,
          changesRejected: rejectedChanges,
          gapsIdentified: analysisResult.gaps,
          pdfUrl,
          optimizedResumeJson: {},
        }),
      }).catch((err) => {
        console.error('[resume-generator] Failed to log generation:', err);
      });

      setPhase('complete');
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('preview');
    }
  };

  const handleReset = () => {
    setPhase('input');
    setError(null);
    setAnalysisResult(null);
    setJobDescription('');
    setAcceptedIndices(new Set());
    setRejectedIndices(new Set());
    setGeneratedPdfUrl(null);
    setStreamingText('');
  };

  // Calculate projected score
  const projectedScore = analysisResult
    ? analysisResult.currentScore.total +
      analysisResult.proposedChanges
        .filter((_, i) => acceptedIndices.has(i))
        .reduce((sum, c) => sum + c.impactPoints, 0)
    : 0;

  // Reusable action buttons component
  const ActionButtons = () => (
    <div className="flex justify-center gap-4">
      <button
        onClick={handleGeneratePdf}
        disabled={acceptedIndices.size === 0 || !resumeData}
        className="rounded-lg bg-[var(--color-accent)] px-8 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resumeData ? `Generate PDF (${acceptedIndices.size} changes)` : 'Loading...'}
      </button>
      <button
        onClick={handleReset}
        className="rounded-lg border border-[var(--color-border)] px-8 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
      >
        Start Over
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">ATS Resume Generator</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Optimize your resume for ATS compatibility
          </p>
        </div>
        <Link
          href="/admin/resume-generator/history"
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
        >
          View History
        </Link>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Input Phase */}
      {phase === 'input' && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <ResumeGeneratorForm onSubmit={handleAnalyze} isLoading={false} />
        </div>
      )}

      {/* Analyzing Phase */}
      {phase === 'analyzing' && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="text-[var(--color-text-muted)]">Analyzing job description...</p>
          </div>
          {streamingText ? (
            <div className="mt-4 max-h-64 overflow-auto rounded-lg bg-[var(--color-bg)] p-4">
              <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-muted)] font-mono">
                {streamingText.length > 500 ? '...' + streamingText.slice(-500) : streamingText}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Waiting for AI response...
            </p>
          )}
        </div>
      )}

      {/* Preview Phase */}
      {phase === 'preview' && analysisResult && (
        <div className="space-y-6">
          {/* JD Summary */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Job Analysis</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Company</p>
                <p className="text-lg font-medium text-[var(--color-text)]">
                  {analysisResult.analysis.companyName}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Role</p>
                <p className="text-lg font-medium text-[var(--color-text)]">
                  {analysisResult.analysis.roleTitle}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              {analysisResult.analysis.jdSummary}
            </p>
            <div className="mt-4">
              <p className="text-sm font-medium text-[var(--color-text-muted)]">Top Keywords</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {analysisResult.analysis.topKeywords.slice(0, 10).map((keyword, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs text-[var(--color-accent)]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Top Action Buttons */}
          <ActionButtons />

          {/* Score Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <CompatibilityScoreCard
              title="Current Score"
              score={analysisResult.currentScore.total}
              breakdown={analysisResult.currentScore.breakdown}
              assessment={analysisResult.currentScore.assessment}
            />
            <CompatibilityScoreCard
              title="Projected Score"
              score={Math.min(100, projectedScore)}
              breakdown={analysisResult.optimizedScore.breakdown}
              assessment={`After ${acceptedIndices.size} accepted changes`}
            />
          </div>

          {/* Changes Preview */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <ChangePreviewPanel
              changes={analysisResult.proposedChanges}
              gaps={analysisResult.gaps}
              onAcceptChange={handleAcceptChange}
              onRejectChange={handleRejectChange}
              acceptedIndices={acceptedIndices}
              rejectedIndices={rejectedIndices}
            />
          </div>

          {/* Interview Prep */}
          {analysisResult.interviewPrep.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Interview Preparation</h3>
              <ul className="mt-4 space-y-2">
                {analysisResult.interviewPrep.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-accent)]">&bull;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Action Buttons */}
          <ActionButtons />
        </div>
      )}

      {/* Generating Phase */}
      {phase === 'generating' && (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          <p className="mt-4 text-[var(--color-text-muted)]">Generating optimized resume...</p>
        </div>
      )}

      {/* Complete Phase */}
      {phase === 'complete' && analysisResult && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-[var(--color-text)]">Resume Generated!</h2>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Your ATS-optimized resume for {analysisResult.analysis.companyName} is ready
          </p>
          <div className="mt-6 flex justify-center gap-4">
            {generatedPdfUrl && (
              <a
                href={generatedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('resume_generation_download', {
                    metadata: {
                      companyName: analysisResult?.analysis.companyName,
                      roleTitle: analysisResult?.analysis.roleTitle,
                    },
                  });
                }}
                className="rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
              >
                Download PDF
              </a>
            )}
            <button
              onClick={handleReset}
              className="rounded-lg border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
            >
              Generate Another
            </button>
            <Link
              href="/admin/resume-generator/history"
              className="rounded-lg border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
            >
              View History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

