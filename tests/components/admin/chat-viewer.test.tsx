import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatViewer } from '@/components/admin/ChatViewer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts?: { type: string; text: string }[];
  content?: string;
}

interface ChatSession {
  sessionId?: string;
  environment?: string;
  archivedAt?: string;
  sessionStartedAt?: string;
  messageCount?: number;
  messages?: Message[];
}

const mockChatWithMessages: ChatSession = {
  sessionId: 'test-session-123',
  environment: 'production',
  sessionStartedAt: '2024-01-15T10:30:00Z',
  messageCount: 2,
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: 'What is your background in engineering?' }],
    },
    {
      id: 'msg-2',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'I have 10+ years of experience in software engineering.',
        },
      ],
    },
  ],
};

const mockChatEmpty: ChatSession = {
  sessionId: 'empty-session',
  sessionStartedAt: '2024-01-15T10:30:00Z',
  messageCount: 0,
  messages: [],
};

describe('ChatViewer', () => {
  describe('Session Metadata', () => {
    it('renders session ID', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(screen.getByText('Session ID')).toBeInTheDocument();
      expect(screen.getByText('test-session-123')).toBeInTheDocument();
    });

    it('displays dash when session ID is missing', () => {
      const chatWithoutId = { ...mockChatWithMessages, sessionId: undefined };
      render(<ChatViewer chat={chatWithoutId} />);

      expect(screen.getByText('Session ID')).toBeInTheDocument();
      const sessionIdCard = screen.getByText('Session ID').parentElement!;
      expect(sessionIdCard).toHaveTextContent('-');
    });

    it('renders formatted session start timestamp', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(screen.getByText('Started')).toBeInTheDocument();
      // Should contain formatted date (format varies by locale, just check it's not '-')
      const startedSection = screen.getByText('Started').parentElement;
      expect(startedSection?.textContent).not.toBe('Started-');
    });

    it('displays dash for invalid timestamp', () => {
      const chatInvalidDate = {
        ...mockChatWithMessages,
        sessionStartedAt: 'invalid-date',
      };
      render(<ChatViewer chat={chatInvalidDate} />);

      expect(screen.getByText('Started')).toBeInTheDocument();
      const startedSection = screen.getByText('Started').parentElement;
      expect(startedSection).toHaveTextContent('-');
    });

    it('displays dash for missing timestamp', () => {
      const chatNoDate = { ...mockChatWithMessages, sessionStartedAt: undefined };
      render(<ChatViewer chat={chatNoDate} />);

      expect(screen.getByText('Started')).toBeInTheDocument();
      const startedSection = screen.getByText('Started').parentElement;
      expect(startedSection).toHaveTextContent('-');
    });

    it('renders message count from messageCount prop', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('falls back to messages array length when messageCount is missing', () => {
      const chatNoCount = { ...mockChatWithMessages, messageCount: undefined };
      render(<ChatViewer chat={chatNoCount} />);

      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Message List', () => {
    it('renders all messages', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(
        screen.getByText('What is your background in engineering?')
      ).toBeInTheDocument();
      expect(
        screen.getByText('I have 10+ years of experience in software engineering.')
      ).toBeInTheDocument();
    });

    it('renders conversation heading', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(screen.getByText('Conversation')).toBeInTheDocument();
    });

    it('uses semantic log role for conversation', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      const conversationLog = screen.getByRole('log', { name: /chat conversation/i });
      expect(conversationLog).toBeInTheDocument();
    });

    it('renders empty conversation when no messages', () => {
      render(<ChatViewer chat={mockChatEmpty} />);

      const conversationLog = screen.getByRole('log', { name: /chat conversation/i });
      expect(conversationLog).toBeInTheDocument();
      expect(conversationLog.children).toHaveLength(0);
    });

    it('handles missing messages array', () => {
      const chatNoMessages = { ...mockChatWithMessages, messages: undefined };
      render(<ChatViewer chat={chatNoMessages} />);

      const conversationLog = screen.getByRole('log', { name: /chat conversation/i });
      expect(conversationLog.children).toHaveLength(0);
    });
  });

  describe('User vs Assistant Message Styling', () => {
    it('applies user message styles (left-aligned with accent background)', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      const userMessage = screen.getByLabelText('User message');
      expect(userMessage).toHaveClass('ml-8');
      expect(userMessage).toHaveClass('bg-[var(--color-accent)]/10');
    });

    it('applies assistant message styles (right-aligned with default background)', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      const assistantMessage = screen.getByLabelText('Assistant message');
      expect(assistantMessage).toHaveClass('mr-8');
      expect(assistantMessage).toHaveClass('bg-[var(--color-bg)]');
    });

    it('displays role labels for user messages', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      const userMessage = screen.getByLabelText('User message');
      expect(userMessage).toHaveTextContent('User');
    });

    it('displays role labels for assistant messages', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      const assistantMessage = screen.getByLabelText('Assistant message');
      expect(assistantMessage).toHaveTextContent('Assistant');
    });
  });

  describe('Message Content Rendering', () => {
    it('renders text from parts array (current format)', () => {
      render(<ChatViewer chat={mockChatWithMessages} />);

      expect(
        screen.getByText('What is your background in engineering?')
      ).toBeInTheDocument();
    });

    it('renders text from legacy content field', () => {
      const chatLegacyFormat: ChatSession = {
        sessionId: 'legacy-session',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Legacy format message',
          },
        ],
      };

      render(<ChatViewer chat={chatLegacyFormat} />);

      expect(screen.getByText('Legacy format message')).toBeInTheDocument();
    });

    it('handles messages with both parts and content (parts takes precedence)', () => {
      const chatMixedFormat: ChatSession = {
        sessionId: 'mixed-session',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Parts format text' }],
            content: 'Content format text',
          },
        ],
      };

      render(<ChatViewer chat={chatMixedFormat} />);

      expect(screen.getByText('Parts format text')).toBeInTheDocument();
      expect(screen.queryByText('Content format text')).not.toBeInTheDocument();
    });

    it('handles empty parts array gracefully', () => {
      const chatEmptyParts: ChatSession = {
        sessionId: 'empty-parts',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [],
          },
        ],
      };

      render(<ChatViewer chat={chatEmptyParts} />);

      const userMessage = screen.getByLabelText('User message');
      // Should still render the message container with role label
      expect(userMessage).toBeInTheDocument();
      expect(userMessage).toHaveTextContent('User');
    });

    it('handles non-text parts gracefully', () => {
      const chatNonTextParts: ChatSession = {
        sessionId: 'non-text',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'image', text: 'ignored' }],
          },
        ],
      };

      render(<ChatViewer chat={chatNonTextParts} />);

      const userMessage = screen.getByLabelText('User message');
      expect(userMessage).toBeInTheDocument();
    });

    it('preserves whitespace and newlines in message text', () => {
      const chatMultiline: ChatSession = {
        sessionId: 'multiline',
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: 'Line 1\nLine 2\n\nLine 4 with  double  spaces',
              },
            ],
          },
        ],
      };

      render(<ChatViewer chat={chatMultiline} />);

      // Use custom text matcher to preserve exact whitespace
      const messageText = screen.getByText((content, element) => {
        const expectedText = 'Line 1\nLine 2\n\nLine 4 with  double  spaces';
        return element?.textContent === expectedText;
      });
      expect(messageText).toBeInTheDocument();
      expect(messageText).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('Multiple Messages', () => {
    it('renders multiple user and assistant messages in order', () => {
      const chatMultiple: ChatSession = {
        sessionId: 'multi',
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'First user' }] },
          {
            id: '2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'First assistant' }],
          },
          { id: '3', role: 'user', parts: [{ type: 'text', text: 'Second user' }] },
          {
            id: '4',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Second assistant' }],
          },
        ],
      };

      render(<ChatViewer chat={chatMultiple} />);

      const messages = screen.getAllByLabelText(/message/);
      expect(messages).toHaveLength(4);

      // Verify order
      expect(messages[0]).toHaveTextContent('First user');
      expect(messages[1]).toHaveTextContent('First assistant');
      expect(messages[2]).toHaveTextContent('Second user');
      expect(messages[3]).toHaveTextContent('Second assistant');
    });

    it('correctly styles consecutive user messages', () => {
      const chatConsecutiveUser: ChatSession = {
        sessionId: 'consecutive',
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'Message 1' }] },
          { id: '2', role: 'user', parts: [{ type: 'text', text: 'Message 2' }] },
        ],
      };

      render(<ChatViewer chat={chatConsecutiveUser} />);

      const userMessages = screen.getAllByLabelText('User message');
      expect(userMessages).toHaveLength(2);
      userMessages.forEach((msg) => {
        expect(msg).toHaveClass('ml-8');
        expect(msg).toHaveClass('bg-[var(--color-accent)]/10');
      });
    });

    it('correctly styles consecutive assistant messages', () => {
      const chatConsecutiveAssistant: ChatSession = {
        sessionId: 'consecutive',
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Response 1' }],
          },
          {
            id: '2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Response 2' }],
          },
        ],
      };

      render(<ChatViewer chat={chatConsecutiveAssistant} />);

      const assistantMessages = screen.getAllByLabelText('Assistant message');
      expect(assistantMessages).toHaveLength(2);
      assistantMessages.forEach((msg) => {
        expect(msg).toHaveClass('mr-8');
        expect(msg).toHaveClass('bg-[var(--color-bg)]');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles completely empty chat object', () => {
      const emptyChat: ChatSession = {};
      render(<ChatViewer chat={emptyChat} />);

      // Should render structure without errors
      expect(screen.getByText('Session ID')).toBeInTheDocument();
      expect(screen.getByText('Started')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Conversation')).toBeInTheDocument();
    });

    it('handles message with empty string text', () => {
      const chatEmptyText: ChatSession = {
        sessionId: 'empty-text',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: '' }],
          },
        ],
      };

      render(<ChatViewer chat={chatEmptyText} />);

      const userMessage = screen.getByLabelText('User message');
      expect(userMessage).toBeInTheDocument();
      expect(userMessage).toHaveTextContent('User');
    });

    it('handles very long message text', () => {
      const longText = 'A'.repeat(10000);
      const chatLongText: ChatSession = {
        sessionId: 'long',
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            parts: [{ type: 'text', text: longText }],
          },
        ],
      };

      render(<ChatViewer chat={chatLongText} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('handles special characters in message text', () => {
      const specialText = '<script>alert("xss")</script> & "quotes" & \'apostrophes\'';
      const chatSpecial: ChatSession = {
        sessionId: 'special',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: specialText }],
          },
        ],
      };

      render(<ChatViewer chat={chatSpecial} />);

      // React should escape these by default
      expect(screen.getByText(specialText)).toBeInTheDocument();
    });
  });
});
