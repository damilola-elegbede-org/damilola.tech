'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/admin/Pagination';

interface AssessmentSummary {
  id: string;
  assessmentId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export default function FitAssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchAssessments = async (append = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (cursor && append) params.set('cursor', cursor);

      const res = await fetch(`/api/admin/fit-assessments?${params}`);
      if (!res.ok) throw new Error('Failed to fetch assessments');

      const data = await res.json();
      setAssessments(append ? [...assessments, ...data.assessments] : data.assessments);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'assessmentId', header: 'Assessment ID', render: (a: AssessmentSummary) => (
      <span className="font-mono text-xs">{a.assessmentId}</span>
    )},
    { key: 'timestamp', header: 'Date', render: (a: AssessmentSummary) => (
      a.timestamp ? new Date(a.timestamp).toLocaleString() : '-'
    )},
    { key: 'size', header: 'Size', render: (a: AssessmentSummary) => (
      `${(a.size / 1024).toFixed(1)} KB`
    )},
  ];

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Fit Assessments</h1>
      <DataTable
        data={assessments}
        columns={columns}
        onRowClick={(a) => router.push(`/admin/fit-assessments/${encodeURIComponent(a.url)}`)}
        isLoading={isLoading && assessments.length === 0}
      />
      <Pagination hasMore={hasMore} onLoadMore={() => fetchAssessments(true)} isLoading={isLoading} />
    </div>
  );
}
