'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ChatMessage } from './chat-message';
import { Button } from '@/components/ui';
import { suggestedQuestions } from '@/lib/resume-data';
import { cn } from '@/lib/utils';
import {
  loadSession,
  saveSession,
  clearSession,
  getSessionStartedAt,
  initializeSession,
  type StoredMessage,
} from '@/lib/chat-storage';
import { trackEvent } from '@/lib/audit-client';

const MAX_MESSAGE_LENGTH = 2000;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: { type: 'text'; text: string }[];
}

type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const wasLoadingRef = useRef(false);

  // Load stored messages after hydration (fixes SSR mismatch)
  // Uses queueMicrotask to batch state updates and avoid cascading render warnings
  useEffect(() => {
    const stored = loadSession();
    queueMicrotask(() => {
      if (stored && stored.length > 0) {
        setMessages(stored);
        setHasInteracted(true);
      }
      setIsHydrated(true);
    });
  }, []);

  // Persist messages to localStorage only when not streaming (avoids excessive writes)
  useEffect(() => {
    if (!isHydrated || status === 'streaming') return;
    if (messages.length === 0) return;

    // Convert to StoredMessage format
    const toStore: StoredMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
    }));

    // Only save if content changed (avoid redundant writes)
    const serialized = JSON.stringify(toStore);
    if (serialized !== lastSavedRef.current) {
      saveSession(toStore);
      lastSavedRef.current = serialized;
    }
  }, [messages, status, isHydrated]);

  // Handle clearing the chat
  const handleClearChat = useCallback(() => {
    clearSession();
    setMessages([]);
    setHasInteracted(false);
  }, []);

  const isLoading = status === 'streaming' || status === 'submitted';

  // Send message with streaming fetch
  const sendMessage = useCallback(
    async (userText: string) => {
      // Ensure session exists before sending (generates chat-{uuid} if needed)
      const sessionId = initializeSession();

      // Abort any existing request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: userText }],
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus('submitted');
      setHasInteracted(true);

      trackEvent('chat_message_sent', {
        section: 'Chat',
        metadata: {
          messageLength: userText.length,
        },
      });

      try {
        // Convert messages to API format
        const apiMessages = [...messages, { role: 'user', content: userText }].map(
          (m) => {
            if ('parts' in m && m.parts) {
              return {
                role: m.role,
                content: m.parts.find((p) => p.type === 'text')?.text || '',
              };
            }
            return m;
          }
        );

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            sessionId,
            sessionStartedAt: getSessionStartedAt(),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let assistantText = '';
        const assistantId = crypto.randomUUID();

        // Add empty assistant message
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', parts: [{ type: 'text', text: '' }] },
        ]);

        setStatus('streaming');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          assistantText += decoder.decode(value, { stream: true });

          // Update assistant message with streamed content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, parts: [{ type: 'text', text: assistantText }] }
                : m
            )
          );
        }

        // Flush any remaining buffered bytes
        assistantText += decoder.decode();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, parts: [{ type: 'text', text: assistantText }] }
              : m
          )
        );

        setStatus('idle');
        abortControllerRef.current = null;
      } catch (error) {
        // Don't treat abort as an error
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('[chat] Error:', error);
        setStatus('error');
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && !lastMsg.parts[0]?.text) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  // Cleanup abort controller on unmount or panel close
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Restore focus after loading completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && isOpen) {
      inputRef.current?.focus();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, isOpen]);

  // Click outside to close (desktop only)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest('[aria-controls="chat-panel"]')
      ) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close on open
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key and focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap - cycle focus within panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [onClose]
  );

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    setHasInteracted(true);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (trimmedInput && !isLoading && trimmedInput.length <= MAX_MESSAGE_LENGTH) {
      sendMessage(trimmedInput);
      setInput('');
    }
  };

  const isInputTooLong = input.length > MAX_MESSAGE_LENGTH;

  // Extract text content from message parts
  const getMessageContent = (message: Message): string => {
    if (!message.parts || message.parts.length === 0) return '';
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed bottom-0 right-0 z-50 flex h-[100dvh] w-full flex-col bg-[var(--color-card)] shadow-2xl transition-transform duration-300 md:bottom-24 md:right-6 md:h-[min(700px,calc(100vh-120px))] md:w-[500px] md:rounded-2xl',
          isOpen
            ? 'translate-x-0'
            : 'translate-x-full md:translate-x-[calc(100%+24px)]'
        )}
        id="chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Chat with AI assistant"
        aria-describedby="chat-description"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <div>
            <h3 className="font-semibold text-[var(--color-primary)]">
              Ask About My Experience
            </h3>
            <p id="chat-description" className="text-sm text-[var(--color-text-muted)]">
              AI-powered career assistant
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Clear chat button - only show when there are messages */}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="group relative rounded-full p-2 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]"
                aria-label="Clear chat history"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity delay-150 group-hover:opacity-100">
                  Clear chat
                </span>
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]"
              aria-label="Close chat"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !hasInteracted ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-[var(--color-text-muted)]">
                Ask me about Damilola&apos;s experience, skills, and fit for
                your role.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  Suggested questions:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleSuggestedQuestion(q.question)}
                      className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={getMessageContent(message)}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start" role="status" aria-live="polite">
                  <div className="rounded-2xl bg-[var(--color-bg-alt)] px-4 py-3">
                    <div className="flex space-x-1" aria-hidden="true">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                    <span className="sr-only">Assistant is typing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <form
          onSubmit={onSubmit}
          className="border-t border-[var(--color-border)] p-4"
        >
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                aria-label="Type your message"
                aria-invalid={isInputTooLong}
                aria-describedby={isInputTooLong ? 'input-error' : undefined}
                maxLength={MAX_MESSAGE_LENGTH + 100}
                className={cn(
                  'flex-1 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-1',
                  isInputTooLong
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]'
                )}
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !input.trim() || isInputTooLong}
                className="rounded-full"
                aria-label="Send message"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </Button>
            </div>
            {isInputTooLong && (
              <p id="input-error" role="alert" className="text-xs text-red-500">
                Message exceeds {MAX_MESSAGE_LENGTH} character limit
              </p>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
