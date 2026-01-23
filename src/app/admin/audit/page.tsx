'use client';

import { useEffect, useState } from 'react';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { Pagination } from '@/components/admin/Pagination';

interface AuditEvent {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  date: string;
  timestamp: string;
  size: number;
  url: string;
}

const eventTypes = [
  'page_view',
  'section_view',
  'chat_opened',
  'chat_message_sent',
  'fit_assessment_started',
  'fit_assessment_completed',
  'fit_assessment_download',
  'external_link_click',
];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchEvents = async (append = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (cursor && append) params.set('cursor', cursor);
      if (selectedType) params.set('eventType', selectedType);
      if (selectedDate) params.set('date', selectedDate);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');

      const data = await res.json();
      setEvents(append ? [...events, ...data.events] : data.events);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedType, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = () => {
    setCursor(null);
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
        {(selectedType || selectedDate) && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedType('');
                setSelectedDate('');
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
      <Pagination hasMore={hasMore} onLoadMore={() => fetchEvents(true)} isLoading={isLoading} />
    </div>
  );
}
