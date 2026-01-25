interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: { type: string; text: string }[];
}

interface ChatSession {
  sessionId?: string;
  environment?: string;
  archivedAt?: string;
  sessionStartedAt?: string;
  messageCount?: number;
  messages?: Message[];
}

interface ChatViewerProps {
  chat: ChatSession;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString(undefined, { timeZoneName: 'short' });
  } catch {
    return '-';
  }
}

export function ChatViewer({ chat }: ChatViewerProps) {
  const messages = chat.messages || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Session ID</p>
          <p className="font-mono text-sm text-[var(--color-text)]">{chat.sessionId || '-'}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Started</p>
          <p className="text-sm text-[var(--color-text)]">
            {formatDate(chat.sessionStartedAt)}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-card)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Messages</p>
          <p className="text-sm text-[var(--color-text)]">{chat.messageCount ?? messages.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-4 font-semibold text-[var(--color-text)]">Conversation</h3>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'ml-8 bg-[var(--color-accent)]/10'
                  : 'mr-8 bg-[var(--color-bg)]'
              }`}
            >
              <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                {msg.role === 'user' ? 'User' : 'Assistant'}
              </p>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">
                {msg.parts.find((p) => p.type === 'text')?.text || ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
