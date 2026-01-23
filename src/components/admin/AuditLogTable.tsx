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
};

export function AuditLogTable({ events, isLoading }: AuditLogTableProps) {
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
        <thead className="bg-[var(--color-card)]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Event Type
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Date
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)]">
              Timestamp
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {events.map((event) => (
            <tr key={event.id} className="bg-[var(--color-bg)]">
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
                {event.date}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
