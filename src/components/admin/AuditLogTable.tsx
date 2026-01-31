'use client';

import { useState, useMemo, Fragment, useRef, useEffect } from 'react';

type SortKey = 'eventType' | 'timestamp';

interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

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

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === null) {
    return (
      <span className="ml-1 text-[var(--color-text-muted)]/30" aria-hidden="true">
        ▲
      </span>
    );
  }
  return (
    <span className="ml-1" aria-hidden="true">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortConfig;
  onSort: (key: SortKey) => void;
}

function SortableHeader({ label, sortKey, currentSort, onSort }: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey;

  return (
    <th
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(sortKey);
        }
      }}
      tabIndex={0}
      role="columnheader"
      aria-sort={isActive ? (currentSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset"
    >
      {label}
      <SortIndicator direction={isActive ? currentSort.direction : null} />
    </th>
  );
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
  resume_generation_started: 'bg-amber-500/10 text-amber-400',
  resume_generation_completed: 'bg-lime-500/10 text-lime-400',
  resume_generation_download: 'bg-teal-500/10 text-teal-400',
  admin_resume_generation_viewed: 'bg-sky-500/10 text-sky-400',
  api_key_created: 'bg-green-500/10 text-green-400',
  api_key_disabled: 'bg-yellow-500/10 text-yellow-400',
  api_key_enabled: 'bg-green-500/10 text-green-400',
  api_key_revoked: 'bg-red-500/10 text-red-400',
};

// Human-readable failure reason messages
const failureReasons: Record<string, string> = {
  invalid_password: 'Incorrect password entered',
  invalid_csrf: 'Invalid security token (stale form or CSRF attack)',
  rate_limited: 'Too many failed attempts - temporarily locked',
  missing_password: 'Password field was empty',
  invalid_json: 'Malformed request (client error)',
  internal_error: 'Server error during authentication',
};

// Format bytes to human-readable size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Extract ID from blob URL (last segment before .json)
function extractIdFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    const filename = segments[segments.length - 1];
    return filename.replace('.json', '').substring(0, 8) + '...';
  } catch {
    return 'unknown';
  }
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface SummaryItem {
  label: string;
  value: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
}

// Format event details into human-readable summary items
function formatEventSummary(eventType: string, details: EventDetails): SummaryItem[] {
  const metadata = details.metadata || {};
  const items: SummaryItem[] = [];

  switch (eventType) {
    // Auth events
    case 'admin_login_failure': {
      const reason = metadata.reason as string | undefined;
      items.push({
        label: 'Reason',
        value: reason ? (failureReasons[reason] || reason) : 'Unknown',
        variant: 'error',
      });
      break;
    }
    case 'admin_login_success':
      items.push({ label: 'Status', value: 'Authentication successful', variant: 'success' });
      break;
    case 'admin_logout':
      items.push({ label: 'Status', value: 'Session ended', variant: 'warning' });
      break;

    // Admin view events
    case 'admin_chat_viewed': {
      const chatUrl = metadata.chatUrl as string | undefined;
      items.push({
        label: 'Chat ID',
        value: chatUrl ? extractIdFromUrl(chatUrl) : 'unknown',
        variant: 'info',
      });
      break;
    }
    case 'admin_assessment_viewed': {
      const assessmentUrl = metadata.assessmentUrl as string | undefined;
      items.push({
        label: 'Assessment ID',
        value: assessmentUrl ? extractIdFromUrl(assessmentUrl) : 'unknown',
        variant: 'info',
      });
      break;
    }
    case 'admin_audit_accessed': {
      const filters: string[] = [];
      if (metadata.environment) filters.push(`env: ${metadata.environment}`);
      if (metadata.date) filters.push(`date: ${metadata.date}`);
      if (metadata.eventType) filters.push(`type: ${metadata.eventType}`);
      if (metadata.page) filters.push(`page: ${metadata.page}`);
      items.push({
        label: 'Filters',
        value: filters.length > 0 ? filters.join(', ') : 'none',
      });
      break;
    }

    // Resume generation events
    case 'resume_generation_started': {
      const inputType = metadata.inputType as string | undefined;
      const length = metadata.jobDescriptionLength as number | undefined;
      items.push({
        label: 'Input',
        value: `${inputType || 'Unknown'}${length ? `, ${length} chars` : ''}`,
      });
      break;
    }
    case 'resume_generation_completed': {
      const company = metadata.companyName as string | undefined;
      const role = metadata.roleTitle as string | undefined;
      const size = metadata.fileSize as number | undefined;
      items.push({
        label: 'Resume',
        value: `${company || 'Unknown'} - ${role || 'Unknown'}${size ? ` (${formatBytes(size)})` : ''}`,
        variant: 'success',
      });
      break;
    }
    case 'resume_generation_download': {
      const company = metadata.companyName as string | undefined;
      const role = metadata.roleTitle as string | undefined;
      items.push({
        label: 'Download',
        value: `${company || 'Unknown'} - ${role || 'Unknown'}`,
      });
      break;
    }
    case 'admin_resume_generation_viewed': {
      const company = metadata.companyName as string | undefined;
      const role = metadata.roleTitle as string | undefined;
      items.push({
        label: 'Viewed',
        value: `${company || 'Unknown'} - ${role || 'Unknown'}`,
        variant: 'info',
      });
      break;
    }

    // User tracking events
    case 'page_view':
      items.push({ label: 'Page', value: details.path || '/' });
      break;
    case 'section_view':
      items.push({ label: 'Section', value: details.section || metadata.section as string || 'unknown' });
      break;
    case 'chat_opened':
      items.push({ label: 'Action', value: 'Chat widget opened' });
      break;
    case 'chat_message_sent': {
      const msgLength = metadata.messageLength as number | undefined;
      items.push({
        label: 'Message',
        value: msgLength ? `${msgLength} characters` : 'sent',
      });
      break;
    }

    // Fit assessment events
    case 'fit_assessment_started': {
      const role = metadata.roleTitle as string | undefined;
      items.push({
        label: 'Assessment',
        value: `Started for ${role || 'unknown role'}`,
      });
      break;
    }
    case 'fit_assessment_completed': {
      const role = metadata.roleTitle as string | undefined;
      const score = metadata.overallScore as number | undefined;
      items.push({
        label: 'Score',
        value: score !== undefined ? `${score}% for ${role || 'unknown role'}` : `Completed for ${role || 'unknown role'}`,
        variant: 'success',
      });
      break;
    }
    case 'fit_assessment_download': {
      const role = metadata.roleTitle as string | undefined;
      const format = metadata.format as string | undefined;
      items.push({
        label: 'Download',
        value: `${format || 'PDF'} for ${role || 'unknown role'}`,
      });
      break;
    }

    // External link tracking
    case 'external_link_click': {
      const text = metadata.text as string | undefined;
      const href = metadata.href as string | undefined;
      items.push({
        label: 'Link',
        value: `${text || 'Link'} → ${href ? extractDomain(href) : 'unknown'}`,
      });
      break;
    }

    default:
      // Fallback: show path if available
      if (details.path) {
        items.push({ label: 'Path', value: details.path });
      }
  }

  return items;
}

// Get CSS classes for variant
function getVariantClasses(variant: SummaryItem['variant']): string {
  switch (variant) {
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    case 'info':
      return 'text-blue-400';
    default:
      return 'text-[var(--color-text)]';
  }
}

function ExpandedEventDetails({ eventType, details }: { eventType: string; details: EventDetails }) {
  const [showRawData, setShowRawData] = useState(false);
  const summaryItems = formatEventSummary(eventType, details);
  const hasMetadata = details.metadata && Object.keys(details.metadata).length > 0;

  return (
    <div className="space-y-3 text-sm">
      {/* Human-readable summary */}
      <div className="flex flex-wrap gap-4">
        {summaryItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">{item.label}:</span>
            <span className={getVariantClasses(item.variant)}>{item.value}</span>
          </div>
        ))}
        {details.sessionId && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Session:</span>
            <code className="rounded bg-[var(--color-bg)] px-1 text-xs text-[var(--color-text)]">
              {details.sessionId.substring(0, 8)}...
            </code>
          </div>
        )}
        {typeof details.metadata?.accessType === 'string' && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Access:</span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
              details.metadata.accessType === 'api'
                ? 'bg-purple-500/10 text-purple-400'
                : 'bg-blue-500/10 text-blue-400'
            }`}>
              {details.metadata.accessType === 'api' ? 'API' : 'Browser'}
            </span>
          </div>
        )}
        {typeof details.metadata?.apiKeyName === 'string' && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">API Key:</span>
            <code className="rounded bg-[var(--color-bg)] px-1 text-xs text-[var(--color-text)]">
              {details.metadata.apiKeyName}
            </code>
          </div>
        )}
      </div>

      {/* Collapsible raw data section */}
      {hasMetadata && (
        <div>
          <button
            type="button"
            onClick={() => setShowRawData(!showRawData)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showRawData ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showRawData ? 'Hide raw data' : 'Show raw data'}
          </button>
          {showRawData && (
            <pre className="mt-2 overflow-x-auto rounded bg-[var(--color-bg)] p-2 text-xs text-[var(--color-text)]">
              {JSON.stringify(details.metadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogTable({ events, isLoading }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<EventDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    direction: 'desc',
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.key) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType);
          break;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [events, sortConfig]);

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
      <div className="flex h-32 items-center justify-center" role="status" aria-live="polite">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Loading audit events...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-[var(--color-text-muted)]" role="status" aria-live="polite">
        No events found
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]" role="region" aria-label="Audit log events" aria-busy={isLoading}>
      <table className="w-full" aria-describedby="audit-table-caption">
        <caption id="audit-table-caption" className="sr-only">Audit log events sorted by {sortConfig.key} in {sortConfig.direction === 'asc' ? 'ascending' : 'descending'} order</caption>
        <thead className="sticky top-0 bg-[var(--color-card)]">
          <tr>
            <SortableHeader label="Event Type" sortKey="eventType" currentSort={sortConfig} onSort={handleSort} />
            <SortableHeader label="Date/Time" sortKey="timestamp" currentSort={sortConfig} onSort={handleSort} />
            <th className="w-8 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {sortedEvents.map((event) => (
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
                      <ExpandedEventDetails eventType={event.eventType} details={expandedDetails} />
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
