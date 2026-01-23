'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AssessmentViewer } from '@/components/admin/AssessmentViewer';

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

export default function AssessmentDetailPage() {
  const params = useParams();
  const [assessment, setAssessment] = useState<FitAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssessment() {
      try {
        const id = params.id as string;
        const res = await fetch(`/api/admin/fit-assessments/${id}`);
        if (!res.ok) throw new Error('Assessment not found');
        const data = await res.json();
        setAssessment(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAssessment();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/fit-assessments"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back to Assessments
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Fit Assessment</h1>
      {assessment && <AssessmentViewer assessment={assessment} />}
    </div>
  );
}
