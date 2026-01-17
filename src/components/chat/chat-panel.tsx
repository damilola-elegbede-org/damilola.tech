'use client';

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatMessage } from './chat-message';
import { Button } from '@/components/ui';
import { suggestedQuestions } from '@/lib/resume-data';
import { cn } from '@/lib/utils';

const MAX_MESSAGE_LENGTH = 2000;

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: () => {
      setHasInteracted(true);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

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
      sendMessage({ role: 'user', parts: [{ type: 'text', text: trimmedInput }] });
      setInput('');
    }
  };

  const isInputTooLong = input.length > MAX_MESSAGE_LENGTH;

  // Extract text content from message parts
  const getMessageContent = (message: (typeof messages)[number]): string => {
    if (!message.parts || message.parts.length === 0) return '';
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text'
      )
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
          'fixed bottom-0 right-0 z-50 flex h-[100dvh] w-full flex-col bg-[var(--color-card)] shadow-2xl transition-transform duration-300 md:bottom-24 md:right-6 md:h-[600px] md:w-[400px] md:rounded-2xl',
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
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-[var(--color-bg-alt)] md:hidden"
            aria-label="Close chat"
          >
            <svg
              className="h-5 w-5 text-[var(--color-text-muted)]"
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
                  role={message.role as 'user' | 'assistant'}
                  content={getMessageContent(message)}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-[var(--color-bg-alt)] px-4 py-3">
                    <div className="flex space-x-1">
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
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              aria-label="Type your message"
              aria-invalid={isInputTooLong}
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
        </form>
      </div>
    </>
  );
}
