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
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleJDs | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [examplesError, setExamplesError] = useState(false);
  const { ref, isVisible } = useScrollReveal();
  const resultRef = useRef<HTMLDivElement>(null);

  // Extract role title from the assessment (looks for "Fit Assessment: [Title]" pattern)
  const extractRoleTitle = (text: string): string => {
    // Look for "Fit Assessment: Role Title" in the markdown h1
    const titleMatch = text.match(/^#\s*Fit Assessment:\s*(.+?)(?:\n|$)/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
        .slice(0, 50);                  // Limit length
    }
    return 'fit-assessment';
  };

  const handleDownloadMD = useCallback(() => {
    if (!completion) return;
    const roleTitle = extractRoleTitle(completion);
    const blob = new Blob([completion], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roleTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [completion]);

  const handleDownloadPDF = useCallback(async () => {
    if (!resultRef.current || !completion) return;
    const html2pdf = (await import('html2pdf.js')).default;

    // Clone the element and apply print-friendly styles
    const clone = resultRef.current.cloneNode(true) as HTMLElement;

    // Apply print-friendly styles to clone (NOT to DOM)
    // Don't use position: fixed or opacity: 0 - these cause blank PDFs
    clone.style.cssText = `
      background: white !important;
      color: #1a1a1a !important;
      padding: 20px !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
      width: 8.5in !important;
    `;

    // Apply dark text to all child elements
    clone.querySelectorAll('*').forEach((el) => {
      const element = el as HTMLElement;
      element.style.color = '#1a1a1a';
      element.style.borderColor = '#e5e5e5';
    });
    // Style headings with appropriate document sizes
    clone.querySelectorAll('h1').forEach((el) => {
      const element = el as HTMLElement;
      element.style.color = '#0a2540';
      element.style.fontSize = '20px';
      element.style.marginTop = '16px';
      element.style.marginBottom = '8px';
    });
    clone.querySelectorAll('h2').forEach((el) => {
      const element = el as HTMLElement;
      element.style.color = '#0a2540';
      element.style.fontSize = '16px';
      element.style.marginTop = '14px';
      element.style.marginBottom = '6px';
    });
    clone.querySelectorAll('h3').forEach((el) => {
      const element = el as HTMLElement;
      element.style.color = '#0a2540';
      element.style.fontSize = '14px';
      element.style.marginTop = '12px';
      element.style.marginBottom = '4px';
    });
    clone.querySelectorAll('h4').forEach((el) => {
      const element = el as HTMLElement;
      element.style.color = '#0a2540';
      element.style.fontSize = '13px';
      element.style.marginTop = '10px';
      element.style.marginBottom = '4px';
    });
    // Style table headers
    clone.querySelectorAll('th').forEach((el) => {
      const element = el as HTMLElement;
      element.style.backgroundColor = '#f5f5f5';
      element.style.color = '#1a1a1a';
      element.style.fontSize = '11px';
    });
    // Style table cells
    clone.querySelectorAll('td').forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = '11px';
    });
    // Style paragraphs
    clone.querySelectorAll('p').forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = '12px';
      element.style.marginBottom = '8px';
    });
    // Style list items
    clone.querySelectorAll('li').forEach((el) => {
      const element = el as HTMLElement;
      element.style.fontSize = '12px';
    });

    const roleTitle = extractRoleTitle(completion);

    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename: `${roleTitle}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
      },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
    };

    // Pass clone directly to html2pdf - NO DOM insertion
    try {
      await html2pdf().set(opt).from(clone).save();
      setDownloadError(null);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setDownloadError('Failed to generate PDF. Please try the Markdown download instead.');
    }
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

  const handleAnalyze = useCallback(async (signal?: AbortSignal) => {
    if (!jobDescription.trim()) return;

    setIsLoading(true);
    setError(null);
    setCompletion('');

    try {
      const res = await fetch('/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: jobDescription }),
        signal,
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

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setCompletion(text);
        }
        // Flush any remaining buffered bytes
        text += decoder.decode();
        setCompletion(text);
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silently handle abort
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription]);

  // Cleanup stream on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAnalyzeClick = useCallback(() => {
    // Abort any existing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    handleAnalyze(abortControllerRef.current.signal);
  }, [handleAnalyze]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
          Paste a job description or link to one. Get an honest assessment of whether I&apos;m the
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
        {examplesError && (
          <p className="mb-4 text-sm text-red-400">
            Couldn&apos;t load examples. Paste your own job description instead.
          </p>
        )}

        {/* Textarea */}
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description or URL here..."
          className="mb-4 h-[30rem] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Job description"
        />

        {/* Submit Button */}
        <Button
          onClick={handleAnalyzeClick}
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
            className="fit-assessment-result rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Download Buttons - only show when result is complete */}
            {completion && !isLoading && (
              <>
                <div className="mb-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadMD}
                    aria-label="Download fit assessment as Markdown file"
                  >
                    Download MD
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadPDF}
                    aria-label="Download fit assessment as PDF file"
                  >
                    Download PDF
                  </Button>
                </div>
                {downloadError && (
                  <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-400 text-sm">
                    {downloadError}
                  </div>
                )}
              </>
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
