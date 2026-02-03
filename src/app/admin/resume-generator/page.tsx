'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ResumeGeneratorForm } from '@/components/admin/ResumeGeneratorForm';
import { CompatibilityScoreCard } from '@/components/admin/CompatibilityScoreCard';
import { FloatingScoreIndicator } from '@/components/admin/FloatingScoreIndicator';
import { ChangePreviewPanel } from '@/components/admin/ChangePreviewPanel';
import { trackEvent } from '@/lib/audit-client';
import { generateJobId, extractDatePosted } from '@/lib/job-id';
import type { ResumeAnalysisResult, ReviewedChange, ProposedChange, LoggedChange, ScoreBreakdown } from '@/lib/types/resume-generation';
import type { ResumeData } from '@/lib/resume-pdf';

// Dynamically import PDF generator to avoid SSR issues with @react-pdf/renderer
// See: https://github.com/diegomura/react-pdf/issues/3156
const generateResumePdfDynamic = async (
  data: ResumeData,
  analysis: import('@/lib/types/resume-generation').ResumeAnalysisResult,
  acceptedIndices: Set<number>,
  effectiveChanges: ProposedChange[]
): Promise<Blob> => {
  const { generateResumePdf } = await import('@/lib/resume-pdf');
  return generateResumePdf(data, analysis, acceptedIndices, effectiveChanges);
};

const getResumeFilenameDynamic = (companyName: string, roleTitle: string): string => {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
  return `${sanitize(companyName)}-${sanitize(roleTitle)}.pdf`;
};

// Dynamically import applyChangesToResume for logging
const applyChangesToResumeDynamic = async (
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>,
  skillsReorder?: import('@/lib/types/resume-generation').SkillsReorder
): Promise<ResumeData> => {
  const { applyChangesToResume } = await import('@/lib/resume-pdf');
  return applyChangesToResume(resume, changes, acceptedIndices, skillsReorder);
};

/**
 * Calculate a dynamic breakdown based on accepted changes.
 * Maps change sections to breakdown categories and estimates impact.
 * @param currentBreakdown - The current score breakdown
 * @param proposedChanges - All proposed changes
 * @param acceptedIndices - Set of accepted change indices
 * @param reviewedChanges - Map of reviewed changes with potential edits
 */
function calculateDynamicBreakdown(
  currentBreakdown: ScoreBreakdown,
  proposedChanges: ProposedChange[],
  acceptedIndices: Set<number>,
  reviewedChanges?: Map<number, ReviewedChange>
): ScoreBreakdown {
  // Start with current breakdown
  const result = { ...currentBreakdown };

  // Sum up impact points by category based on section
  for (const [index, change] of proposedChanges.entries()) {
    if (!acceptedIndices.has(index)) continue;

    // Calculate effective impact (accounting for user edits)
    const review = reviewedChanges?.get(index);
    const effectiveImpact = review?.editedText !== undefined
      ? calculateEditedImpact(change, review.editedText)
      : change.impactPoints;

    // Map section to breakdown category and distribute impact
    if (change.section === 'summary') {
      // Summary changes primarily affect keyword relevance
      result.keywordRelevance = Math.min(40, result.keywordRelevance + Math.ceil(effectiveImpact * 0.7));
      result.experienceAlignment = Math.min(20, result.experienceAlignment + Math.floor(effectiveImpact * 0.3));
    } else if (change.section.startsWith('experience.')) {
      // Experience bullets affect keyword relevance and alignment
      result.keywordRelevance = Math.min(40, result.keywordRelevance + Math.ceil(effectiveImpact * 0.6));
      result.experienceAlignment = Math.min(20, result.experienceAlignment + Math.floor(effectiveImpact * 0.4));
    } else if (change.section.startsWith('skills.')) {
      // Skills changes primarily affect skills quality
      result.skillsQuality = Math.min(25, result.skillsQuality + Math.ceil(effectiveImpact * 0.8));
      result.keywordRelevance = Math.min(40, result.keywordRelevance + Math.floor(effectiveImpact * 0.2));
    } else if (change.section.startsWith('education.')) {
      // Education changes affect alignment
      result.experienceAlignment = Math.min(20, result.experienceAlignment + effectiveImpact);
    }
  }

  return result;
}

/**
 * Calculate the adjusted impact when a user edits a proposed change.
 * Uses impactPerKeyword if available, otherwise falls back to proportional calculation.
 * @param change - The original proposed change
 * @param editedText - The user's edited version of the text
 * @returns The adjusted impact points based on retained keywords
 */
function calculateEditedImpact(change: ProposedChange, editedText: string): number {
  if (change.keywordsAdded.length === 0) {
    return change.impactPoints;
  }

  // Count how many keywords are retained in the edited text
  const editedLower = editedText.toLowerCase();
  const retainedKeywords = change.keywordsAdded.filter((keyword) =>
    editedLower.includes(keyword.toLowerCase())
  );

  // Use impactPerKeyword if available, otherwise calculate from impactPoints
  const impactPerKeyword = change.impactPerKeyword
    ?? change.impactPoints / change.keywordsAdded.length;

  return Math.round(retainedKeywords.length * impactPerKeyword);
}

type Phase = 'input' | 'analyzing' | 'preview' | 'generating' | 'complete';

export default function ResumeGeneratorPage() {
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [reviewedChanges, setReviewedChanges] = useState<Map<number, ReviewedChange>>(new Map());
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeDataError, setResumeDataError] = useState<string | null>(null);

  // Fetch resume data on mount
  useEffect(() => {
    fetch('/api/resume-data')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setResumeData(data))
      .catch((err) => {
        console.error('Failed to load resume data:', err);
        setResumeDataError('Failed to load resume data. Please refresh the page.');
      });
  }, []);

  // Derive acceptedIndices from reviewedChanges for backward compatibility
  const acceptedIndices = useMemo(() =>
    new Set(
      [...reviewedChanges.entries()]
        .filter(([, r]) => r.status === 'accepted')
        .map(([i]) => i)
    ),
    [reviewedChanges]
  );

  // Derive rejectedIndices from reviewedChanges for backward compatibility
  const rejectedIndices = useMemo(() =>
    new Set(
      [...reviewedChanges.entries()]
        .filter(([, r]) => r.status === 'rejected')
        .map(([i]) => i)
    ),
    [reviewedChanges]
  );

  // Effective changes with user edits applied (for PDF generation)
  const effectiveChanges = useMemo(() =>
    analysisResult?.proposedChanges.map((change, i) => {
      const review = reviewedChanges.get(i);
      if (review?.editedText !== undefined && review.status === 'accepted') {
        return { ...change, modified: review.editedText };
      }
      return change;
    }) ?? [],
    [analysisResult, reviewedChanges]
  );

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

      // Validation logging (fire-and-forget for monitoring compliance)
      if (result.proposedChanges.length < 8) {
        console.warn(JSON.stringify({
          event: 'resume_generator.insufficient_changes',
          changeCount: result.proposedChanges.length,
          minimum: 8,
          companyName: result.analysis?.companyName,
          roleTitle: result.analysis?.roleTitle,
        }));
      }
      if (result.optimizedScore.total < 90 && !result.scoreCeiling) {
        console.warn(JSON.stringify({
          event: 'resume_generator.missing_score_ceiling',
          optimizedScore: result.optimizedScore.total,
          companyName: result.analysis?.companyName,
          roleTitle: result.analysis?.roleTitle,
        }));
      }

      setAnalysisResult(result);
      // Initialize all changes as pending (not auto-accepted)
      setReviewedChanges(new Map());
      setStreamingText('');
      setPhase('preview');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStreamingText('');
      setPhase('input');
    }
  };

  const handleAcceptChange = useCallback((index: number, editedText?: string) => {
    if (!analysisResult) return;

    setReviewedChanges((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, {
        originalChange: analysisResult.proposedChanges[index],
        status: 'accepted',
        editedText,
        reviewedAt: new Date().toISOString(),
      });
      return newMap;
    });
  }, [analysisResult]);

  const handleRejectChange = useCallback((index: number, feedback?: string) => {
    if (!analysisResult) return;

    setReviewedChanges((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, {
        originalChange: analysisResult.proposedChanges[index],
        status: 'rejected',
        feedback,
        reviewedAt: new Date().toISOString(),
      });
      return newMap;
    });
  }, [analysisResult]);

  const handleRevertChange = useCallback((index: number) => {
    setReviewedChanges((prev) => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });
  }, []);

  const handleModifyChange = useCallback(async (index: number, prompt: string) => {
    if (!analysisResult) return;

    const response = await fetch('/api/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalChange: analysisResult.proposedChanges[index],
        modifyPrompt: prompt,
        jobDescription,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to modify change');
    }

    const { revisedChange } = await response.json();

    // Update the analysis result with revised change
    setAnalysisResult((prev) => {
      if (!prev) return prev;
      const newChanges = [...prev.proposedChanges];
      newChanges[index] = revisedChange;
      return { ...prev, proposedChanges: newChanges };
    });
  }, [analysisResult, jobDescription]);

  const handleGeneratePdf = async () => {
    if (!analysisResult || !resumeData) return;

    setPhase('generating');
    setError(null);

    try {
      // Generate PDF using @react-pdf/renderer (native text-based PDF)
      // Uses dynamic import to avoid SSR issues
      // Pass effective changes (with user edits applied)
      const pdfBlob = await generateResumePdfDynamic(resumeData, analysisResult, acceptedIndices, effectiveChanges);

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

      // Build logged changes with edit and rejection tracking
      const acceptedLoggedChanges: LoggedChange[] = analysisResult.proposedChanges
        .filter((_, i) => acceptedIndices.has(i))
        .map((change) => {
          // Find original index
          const originalIndex = analysisResult.proposedChanges.indexOf(change);
          const review = reviewedChanges.get(originalIndex);
          const wasEdited = review?.editedText !== undefined;

          return {
            ...change,
            modified: wasEdited ? review!.editedText! : change.modified,
            wasEdited,
            originalModified: wasEdited ? change.modified : undefined,
          };
        });

      const rejectedLoggedChanges: LoggedChange[] = analysisResult.proposedChanges
        .filter((_, i) => rejectedIndices.has(i))
        .map((change) => {
          const originalIndex = analysisResult.proposedChanges.indexOf(change);
          const review = reviewedChanges.get(originalIndex);

          return {
            ...change,
            wasEdited: false,
            rejectionFeedback: review?.feedback,
          };
        });

      // Calculate optimized score based on accepted changes
      const acceptedPoints = acceptedLoggedChanges.reduce((sum, c) => sum + c.impactPoints, 0);
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

      // Calculate the actual breakdown based on accepted changes
      const actualBreakdown = calculateDynamicBreakdown(
        analysisResult.currentScore.breakdown,
        analysisResult.proposedChanges,
        acceptedIndices
      );

      // Apply changes to get the optimized resume JSON for logging
      const optimizedResumeJson = await applyChangesToResumeDynamic(
        resumeData,
        effectiveChanges,
        acceptedIndices,
        analysisResult.skillsReorder
      );

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
            breakdown: actualBreakdown,
          },
          changesAccepted: acceptedLoggedChanges,
          changesRejected: rejectedLoggedChanges,
          gapsIdentified: analysisResult.gaps,
          pdfUrl,
          optimizedResumeJson,
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
    setReviewedChanges(new Map());
    setGeneratedPdfUrl(null);
    setStreamingText('');
  };

  // Calculate projected score with edit-aware rescoring
  const projectedScore = useMemo(() => {
    if (!analysisResult) return 0;

    let score = analysisResult.currentScore.total;

    for (const [index, change] of analysisResult.proposedChanges.entries()) {
      if (!acceptedIndices.has(index)) continue;

      const review = reviewedChanges.get(index);
      if (review?.editedText !== undefined) {
        // User edited: recalculate based on retained keywords
        score += calculateEditedImpact(change, review.editedText);
      } else {
        // User accepted as-is: use full impact
        score += change.impactPoints;
      }
    }

    return Math.min(100, score);
  }, [analysisResult, acceptedIndices, reviewedChanges]);

  // Calculate dynamic breakdown based on accepted changes (with edit-aware rescoring)
  const projectedBreakdown = useMemo(() => {
    if (!analysisResult) return null;
    return calculateDynamicBreakdown(
      analysisResult.currentScore.breakdown,
      analysisResult.proposedChanges,
      acceptedIndices,
      reviewedChanges
    );
  }, [analysisResult, acceptedIndices, reviewedChanges]);

  // Maximum score if ALL changes accepted (constant for this analysis)
  const maximumScore = useMemo(() => {
    if (!analysisResult) return 0;
    return Math.min(
      100,
      analysisResult.currentScore.total +
        analysisResult.proposedChanges.reduce((sum, c) => sum + c.impactPoints, 0)
    );
  }, [analysisResult]);

  // Target score that respects ceiling (for display purposes)
  const targetScore = useMemo(() => {
    if (!analysisResult) return 0;
    const ceiling = analysisResult.scoreCeiling?.maximum;
    return ceiling ? Math.min(maximumScore, ceiling) : maximumScore;
  }, [analysisResult, maximumScore]);

  // Ref for the score cards section and scroll detection
  const scoreCardsRef = useRef<HTMLDivElement>(null);
  const [showFloatingScore, setShowFloatingScore] = useState(false);

  // Detect when score cards scroll out of view
  useEffect(() => {
    if (!scoreCardsRef.current || phase !== 'preview') return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingScore(!entry.isIntersecting),
      { threshold: 0 }
    );

    observer.observe(scoreCardsRef.current);
    return () => observer.disconnect();
  }, [phase]);

  const scrollToScoreCards = useCallback(() => {
    scoreCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Reusable action buttons component
  const ActionButtons = () => (
    <div className="flex justify-center gap-4">
      <button
        onClick={handleGeneratePdf}
        disabled={acceptedIndices.size === 0 || !resumeData || !!resumeDataError}
        aria-label={
          resumeDataError
            ? 'Resume data failed to load'
            : !resumeData
              ? 'Loading resume data...'
              : acceptedIndices.size === 0
                ? 'Accept at least one change to generate PDF'
                : `Generate PDF with ${acceptedIndices.size} changes`
        }
        className="rounded-lg bg-[var(--color-accent)] px-8 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resumeDataError ? 'Error' : resumeData ? `Generate PDF (${acceptedIndices.size} changes)` : 'Loading...'}
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
      {(error || resumeDataError) && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error || resumeDataError}
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

          {/* Score Cards - 2 cards showing Initial and Current (with target) */}
          <div ref={scoreCardsRef} className="grid gap-4 md:grid-cols-2">
            <CompatibilityScoreCard
              title="Initial Score"
              score={analysisResult.currentScore.total}
              breakdown={analysisResult.currentScore.breakdown}
              assessment={analysisResult.currentScore.assessment}
            />
            <CompatibilityScoreCard
              title="Current Score"
              score={projectedScore}
              breakdown={projectedBreakdown ?? analysisResult.currentScore.breakdown}
              assessment={acceptedIndices.size > 0 ? `After ${acceptedIndices.size} accepted changes` : 'No changes accepted yet'}
              highlight={true}
              targetScore={targetScore}
            />
          </div>

          {/* Floating Score Indicator (appears when score cards scroll out of view) */}
          <FloatingScoreIndicator
            initialScore={analysisResult.currentScore.total}
            currentScore={projectedScore}
            maximumScore={targetScore}
            isVisible={showFloatingScore}
            onScrollToScores={scrollToScoreCards}
          />

          {/* Top Action Buttons */}
          <ActionButtons />

          {/* Changes Preview */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <ChangePreviewPanel
              changes={analysisResult.proposedChanges}
              gaps={analysisResult.gaps}
              scoreCeiling={analysisResult.scoreCeiling}
              reviewedChanges={reviewedChanges}
              onAcceptChange={handleAcceptChange}
              onRejectChange={handleRejectChange}
              onRevertChange={handleRevertChange}
              onModifyChange={handleModifyChange}
              calculateEditedImpact={calculateEditedImpact}
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
