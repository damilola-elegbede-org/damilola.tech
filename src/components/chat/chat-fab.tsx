'use client';

import { trackEvent } from '@/lib/audit-client';

interface ChatFabProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatFab({ onClick, isOpen }: ChatFabProps) {
  // Hide FAB when chat is open - chat panel has its own close mechanism
  if (isOpen) return null;

  return (
    <button
      onClick={() => {
        trackEvent('chat_opened', {
          section: 'Chat',
          metadata: {},
        });
        onClick();
      }}
      className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-lg transition-all duration-300 hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      aria-label="Open chat"
      aria-expanded={false}
      aria-controls="chat-panel"
    >
      <svg
        className="h-6 w-6 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </button>
  );
}
