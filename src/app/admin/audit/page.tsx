'use client';

import { useEffect, useState, useCallback } from 'react';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { PageNavigation } from '@/components/admin/PageNavigation';

interface AuditEvent {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  timestamp: string; // ISO 8601 UTC timestamp
  size: number;
  url: string;
}

const PAGE_SIZE = 20;

const eventTypes = [
  // User activity (browser)
  'page_view',
  'section_view',
  'chat_opened',
  'chat_message_sent',
  'fit_assessment_started',
  'fit_assessment_completed',
  'fit_assessment_download',
  'external_link_click',
  'resume_generation_started',
  'resume_generation_completed',
  'resume_generation_download',
  // Admin activity
  'admin_login_success',
  'admin_login_failure',
  'admin_logout',
  'admin_chat_viewed',
  'admin_assessment_viewed',
  'admin_audit_accessed',
  'admin_resume_generation_viewed',
  // API key management
  'api_key_created',
  'api_key_disabled',
  'api_key_enabled',
  'api_key_revoked',
  // External API access (via API keys)
  'api_fit_assessment',
  'api_chat',
  'api_chats_list',
  'api_fit_assessments_list',
  'api_resume_generations_list',
  'api_resume_generator_attempted',
  'api_stats_accessed',
  'api_usage_accessed',
  'api_traffic_accessed',
];

const accessTypes = ['browser', 'api'] as const;

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedAccessType, setSelectedAccessType] = useState<string>('');

  const fetchPage = useCallback(async (pageNum: number) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', PAGE_SIZE.toString());
      if (selectedType) params.set('eventType', selectedType);
      if (selectedDate) params.set('date', selectedDate);
      if (selectedAccessType) params.set('accessType', selectedAccessType);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');

      const data = await res.json();
      setEvents(data.events);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedDate, selectedAccessType]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      fetchPage(currentPage + 1);
    }
  }, [currentPage, totalPages, fetchPage]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      fetchPage(currentPage - 1);
    }
  }, [currentPage, fetchPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    fetchPage(1);
  }, [selectedType, selectedDate, selectedAccessType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = () => {
    setCurrentPage(1);
    setEvents([]);
  };

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm text-[var(--color-text-muted)]">Event Type</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              handleFilterChange();
            }}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="">All Types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-muted)]">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              handleFilterChange();
            }}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-muted)]">Access Type</label>
          <select
            value={selectedAccessType}
            onChange={(e) => {
              setSelectedAccessType(e.target.value);
              handleFilterChange();
            }}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="">All</option>
            {accessTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {(selectedType || selectedDate || selectedAccessType) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedType('');
                setSelectedDate('');
                setSelectedAccessType('');
                handleFilterChange();
              }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <AuditLogTable events={events} isLoading={isLoading && events.length === 0} />
      <PageNavigation
        currentPage={currentPage}
        totalPages={totalPages}
        onNext={handleNext}
        onPrev={handlePrev}
        isLoading={isLoading}
      />
    </div>
  );
}
