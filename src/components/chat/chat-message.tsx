'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const DISALLOWED_ELEMENTS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'];

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'mb-4 flex',
        role === 'user' ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          role === 'user'
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-alt)] text-[var(--color-text)]'
        )}
      >
        {role === 'assistant' ? (
          <div className="prose prose-sm max-w-none prose-p:my-3 prose-ul:my-2 prose-li:my-0 prose-headings:mt-4 prose-strong:text-[var(--color-primary)]">
            <ReactMarkdown
              disallowedElements={DISALLOWED_ELEMENTS}
              unwrapDisallowed
              components={{
                h1: ({ children }) => (
                  <p className="mt-3 mb-1 text-sm font-semibold">{children}</p>
                ),
                h2: ({ children }) => (
                  <p className="mt-3 mb-1 text-sm font-semibold">{children}</p>
                ),
                h3: ({ children }) => (
                  <p className="mt-2 mb-1 text-sm font-medium">{children}</p>
                ),
                h4: ({ children }) => (
                  <p className="mt-2 mb-1 text-sm font-medium">{children}</p>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm">{content}</p>
        )}
      </div>
    </div>
  );
}
