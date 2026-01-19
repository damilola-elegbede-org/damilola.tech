'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

interface ExampleJDs {
  strong: string;
  weak: string;
}

export function FitAssessment() {
  const [jobDescription, setJobDescription] = useState('');
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleJDs | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [examplesError, setExamplesError] = useState(false);
  const { ref, isVisible } = useScrollReveal();
  const resultRef = useRef<HTMLDivElement>(null);

  const handleDownloadMD = useCallback(() => {
    if (!completion) return;
    const blob = new Blob([completion], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fit-assessment.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [completion]);

  const handleDownloadPDF = useCallback(async () => {
    if (!resultRef.current || !completion) return;
    const html2pdf = (await import('html2pdf.js')).default;
    const element = resultRef.current;
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename: 'fit-assessment.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
    };
    html2pdf().set(opt).from(element).save();
  }, [completion]);

  // Fetch example JDs on mount
  useEffect(() => {
    async function loadExamples() {
      try {
        const res = await fetch('/api/fit-examples');
        if (res.ok) {
          const data = await res.json();
          setExamples(data);
        } else {
          setExamplesError(true);
        }
      } catch (err) {
        console.error('Failed to load example JDs:', err);
        setExamplesError(true);
      } finally {
        setExamplesLoading(false);
      }
    }
    loadExamples();
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!jobDescription.trim()) return;

    setIsLoading(true);
    setError(null);
    setCompletion('');

    try {
      const res = await fetch('/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: jobDescription }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze fit');
      }

      // Stream the response for progressive display
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setCompletion(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription]);

  return (
    <section id="fit-assessment" className="bg-[var(--color-bg-alt)] px-6 py-20">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={cn(
          'mx-auto max-w-5xl transition-all duration-700 ease-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}
      >
        <h2 className="mb-4 text-3xl text-[var(--color-text)] md:text-4xl">
          Fit Assessment
        </h2>
        <p className="mb-8 text-lg text-[var(--color-text-muted)]">
          Paste a job description. Get an honest assessment of whether I&apos;m the
          right person—including when I&apos;m not.
        </p>

        {/* Example Buttons */}
        <div className="mb-4 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => examples && setJobDescription(examples.strong)}
            disabled={examplesLoading || !examples}
          >
            Strong Fit Example
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => examples && setJobDescription(examples.weak)}
            disabled={examplesLoading || !examples}
          >
            Weak Fit Example
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setJobDescription('');
              setCompletion('');
              setError(null);
            }}
            disabled={!jobDescription && !completion}
          >
            Clear
          </Button>
        </div>

        {/* Textarea */}
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description here..."
          className="mb-4 h-[30rem] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Job description"
        />

        {/* Submit Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || !jobDescription.trim()}
          className="mb-8"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Fit'}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            <p className="font-medium">Unable to analyze fit</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Assessment Result */}
        {(completion || isLoading) && (
          <div
            className="fit-assessment-result rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Download Buttons - only show when result is complete */}
            {completion && !isLoading && (
              <div className="mb-4 flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleDownloadMD}>
                  Download MD
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownloadPDF}>
                  Download PDF
                </Button>
              </div>
            )}
            <div ref={resultRef} className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {completion || 'Analyzing job fit...'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
