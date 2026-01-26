'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ResumeGeneratorForm } from '@/components/admin/ResumeGeneratorForm';
import { CompatibilityScoreCard } from '@/components/admin/CompatibilityScoreCard';
import { ChangePreviewPanel } from '@/components/admin/ChangePreviewPanel';
import type { ResumeAnalysisResult } from '@/lib/types/resume-generation';
import { buildResumeHtml } from '@/lib/resume-template';

type Phase = 'input' | 'analyzing' | 'preview' | 'generating' | 'complete';

export default function ResumeGeneratorPage() {
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);

  const handleAnalyze = async (jd: string) => {
    setJobDescription(jd);
    setError(null);
    setPhase('analyzing');

    try {
      const response = await fetch('/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysisResult(data.result);
      // Pre-select all changes as accepted by default
      setAcceptedIndices(new Set(data.result.proposedChanges.map((_: unknown, i: number) => i)));
      setRejectedIndices(new Set());
      setPhase('preview');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
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
    if (!analysisResult) return;

    setPhase('generating');
    setError(null);

    try {
      // Import html2pdf dynamically (client-side only)
      const html2pdf = (await import('html2pdf.js')).default;

      // Build the optimized resume HTML
      const resumeHtml = buildResumeHtml(analysisResult, acceptedIndices);

      // Generate PDF
      const pdfBlob = await html2pdf()
        .set({
          margin: [0.5, 0.5, 0.5, 0.5],
          filename: `${analysisResult.analysis.companyName}-${analysisResult.analysis.roleTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(resumeHtml)
        .outputPdf('blob');

      // Upload PDF to blob storage
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'resume.pdf');
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
      const generationId = crypto.randomUUID();
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

      await fetch('/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId,
          companyName: analysisResult.analysis.companyName,
          roleTitle: analysisResult.analysis.roleTitle,
          jobDescriptionFull: jobDescription,
          inputType: jobDescription.startsWith('http') ? 'url' : 'text',
          extractedUrl: jobDescription.startsWith('http') ? jobDescription : undefined,
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
  };

  // Calculate projected score
  const projectedScore = analysisResult
    ? analysisResult.currentScore.total +
      analysisResult.proposedChanges
        .filter((_, i) => acceptedIndices.has(i))
        .reduce((sum, c) => sum + c.impactPoints, 0)
    : 0;

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
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          <p className="mt-4 text-[var(--color-text-muted)]">Analyzing job description...</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            This may take a few seconds
          </p>
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

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleGeneratePdf}
              disabled={acceptedIndices.size === 0}
              className="flex-1 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate PDF ({acceptedIndices.size} changes)
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card)]"
            >
              Start Over
            </button>
          </div>
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

