'use client';

import { useState, Fragment, useRef, useEffect } from 'react';

interface AuditEvent {
  id: string;
  pathname: string;
  eventType: string;
  environment: string;
  timestamp: string; // ISO 8601 UTC timestamp
  size: number;
  url: string;
}

interface EventDetails {
  eventType: string;
  timestamp: string;
  sessionId?: string;
  path?: string;
  section?: string;
  metadata?: Record<string, unknown>;
}

interface AuditLogTableProps {
  events: AuditEvent[];
  isLoading?: boolean;
}

const eventTypeColors: Record<string, string> = {
  page_view: 'bg-blue-500/10 text-blue-400',
  section_view: 'bg-cyan-500/10 text-cyan-400',
  chat_opened: 'bg-green-500/10 text-green-400',
  chat_message_sent: 'bg-emerald-500/10 text-emerald-400',
  fit_assessment_started: 'bg-purple-500/10 text-purple-400',
  fit_assessment_completed: 'bg-violet-500/10 text-violet-400',
  fit_assessment_download: 'bg-pink-500/10 text-pink-400',
  external_link_click: 'bg-orange-500/10 text-orange-400',
  admin_login_success: 'bg-green-500/10 text-green-400',
  admin_login_failure: 'bg-red-500/10 text-red-400',
  admin_logout: 'bg-yellow-500/10 text-yellow-400',
  admin_chat_viewed: 'bg-indigo-500/10 text-indigo-400',
  admin_assessment_viewed: 'bg-fuchsia-500/10 text-fuchsia-400',
  admin_audit_accessed: 'bg-slate-500/10 text-slate-400',
};

export function AuditLogTable({ events, isLoading }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<EventDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleRowClick = async (event: AuditEvent) => {
    // Cancel any pending request
    abortControllerRef.current?.abort();

    if (expandedId === event.id) {
      // Collapse
      setExpandedId(null);
      setExpandedDetails(null);
      return;
    }

    // Expand and fetch details
    setExpandedId(event.id);
    setExpandedDetails(null);
    setDetailsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(event.url, { signal: controller.signal });
      if (res.ok) {
        const details = await res.json();
        setExpandedDetails(details);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      console.error('Failed to fetch event details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, event: AuditEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(event);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-[var(--color-text-muted)]">
        No events found
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full">
        <thead className="sticky top-0 bg-[var(--color-card)]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Event Type
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Date/Time
            </th>
            <th className="w-8 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {events.map((event) => (
            <Fragment key={event.id}>
              <tr
                onClick={() => handleRowClick(event)}
                onKeyDown={(e) => handleRowKeyDown(e, event)}
                tabIndex={0}
                role="button"
                aria-expanded={expandedId === event.id}
                className="cursor-pointer bg-[var(--color-bg)] transition-colors hover:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                      eventTypeColors[event.eventType] || 'bg-gray-500/10 text-gray-400'
                    }`}
                  >
                    {event.eventType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text)]">
                  {event.timestamp
                    ? new Date(event.timestamp).toLocaleString(undefined, {
                        timeZoneName: 'short',
                      })
                    : '-'}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">
                  <svg
                    className={`h-4 w-4 transition-transform ${expandedId === event.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </td>
              </tr>
              {expandedId === event.id && (
                <tr key={`${event.id}-details`} className="bg-[var(--color-card)]">
                  <td colSpan={3} className="px-4 py-4">
                    {detailsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                        Loading details...
                      </div>
                    ) : expandedDetails ? (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          {expandedDetails.path && (
                            <div>
                              <span className="text-[var(--color-text-muted)]">Path:</span>{' '}
                              <span className="text-[var(--color-text)]">{expandedDetails.path}</span>
                            </div>
                          )}
                          {expandedDetails.section && (
                            <div>
                              <span className="text-[var(--color-text-muted)]">Section:</span>{' '}
                              <span className="text-[var(--color-text)]">{expandedDetails.section}</span>
                            </div>
                          )}
                          {expandedDetails.sessionId && (
                            <div>
                              <span className="text-[var(--color-text-muted)]">Session:</span>{' '}
                              <code className="rounded bg-[var(--color-bg)] px-1 text-xs text-[var(--color-text)]">
                                {expandedDetails.sessionId.substring(0, 8)}...
                              </code>
                            </div>
                          )}
                        </div>
                        {expandedDetails.metadata && Object.keys(expandedDetails.metadata).length > 0 && (
                          <div>
                            <span className="text-[var(--color-text-muted)]">Metadata:</span>
                            <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-bg)] p-2 text-xs text-[var(--color-text)]">
                              {JSON.stringify(expandedDetails.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Failed to load details
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
