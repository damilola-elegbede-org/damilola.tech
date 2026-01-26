import { describe, it, expect, vi } from 'vitest';
import {
  compactConversation,
  buildSummaryPrompt,
  ChatMessage,
} from '@/lib/chat-compaction';

// Mock Anthropic client
function createMockClient(summaryText: string = 'This is a test summary.') {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: summaryText }],
      }),
    },
  };
}

function createMockClientWithError() {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(new Error('API error')),
    },
  };
}

// Helper to generate test messages
function generateMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
  }));
}

describe('chat-compaction', () => {
  describe('compactConversation', () => {
    it('returns original messages unchanged when below threshold', async () => {
      const messages = generateMessages(50);
      const mockClient = createMockClient();

      const result = await compactConversation(messages, mockClient as never, 180);

      expect(result.wasCompacted).toBe(false);
      expect(result.messages).toBe(messages); // Same reference
      expect(result.originalCount).toBe(50);
      expect(mockClient.messages.create).not.toHaveBeenCalled();
    });

    it('returns original messages unchanged at exactly threshold - 1', async () => {
      const messages = generateMessages(179);
      const mockClient = createMockClient();

      const result = await compactConversation(messages, mockClient as never, 180);

      expect(result.wasCompacted).toBe(false);
      expect(result.messages.length).toBe(179);
      expect(mockClient.messages.create).not.toHaveBeenCalled();
    });

    it('compacts messages when at threshold', async () => {
      const messages = generateMessages(180);
      const mockClient = createMockClient('Summary of conversation history.');

      const result = await compactConversation(messages, mockClient as never, 180);

      expect(result.wasCompacted).toBe(true);
      expect(result.originalCount).toBe(180);
      // 1 summary message + 20 recent messages = 21
      expect(result.messages.length).toBe(21);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('compacts messages when above threshold', async () => {
      const messages = generateMessages(200);
      const mockClient = createMockClient('Summary text.');

      const result = await compactConversation(messages, mockClient as never, 180);

      expect(result.wasCompacted).toBe(true);
      expect(result.originalCount).toBe(200);
      expect(result.messages.length).toBe(21);
    });

    it('preserves last 20 messages verbatim', async () => {
      const messages = generateMessages(180);
      const mockClient = createMockClient('Summary.');

      const result = await compactConversation(messages, mockClient as never, 180);

      // Last 20 messages should be preserved exactly
      const expectedRecent = messages.slice(-20);
      const resultRecent = result.messages.slice(1); // Skip summary message

      expect(resultRecent).toEqual(expectedRecent);
    });

    it('formats summary message correctly', async () => {
      const messages = generateMessages(180);
      const summaryText = 'The user discussed their experience with TypeScript.';
      const mockClient = createMockClient(summaryText);

      const result = await compactConversation(messages, mockClient as never, 180);

      const summaryMessage = result.messages[0];
      expect(summaryMessage.role).toBe('assistant');
      expect(summaryMessage.content).toContain('[Previous conversation summary]');
      expect(summaryMessage.content).toContain(summaryText);
      expect(summaryMessage.content).toContain('[End of summary');
    });

    it('calls Haiku with correct model', async () => {
      const messages = generateMessages(180);
      const mockClient = createMockClient();

      await compactConversation(messages, mockClient as never, 180);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1024,
        })
      );
    });

    it('falls back to truncation when Haiku fails', async () => {
      const messages = generateMessages(180);
      const mockClient = createMockClientWithError();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await compactConversation(messages, mockClient as never, 180);

      expect(result.wasCompacted).toBe(true);
      expect(result.messages.length).toBe(100); // Fallback keeps last 100
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('uses default threshold of 180 when not specified', async () => {
      const messages = generateMessages(179);
      const mockClient = createMockClient();

      const result = await compactConversation(messages, mockClient as never);

      expect(result.wasCompacted).toBe(false);

      // At 180, should compact
      const messages180 = generateMessages(180);
      const result180 = await compactConversation(messages180, mockClient as never);

      expect(result180.wasCompacted).toBe(true);
    });
  });

  describe('buildSummaryPrompt', () => {
    it('formats messages into conversation text', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi! How can I help?' },
        { role: 'user', content: 'Tell me about yourself' },
      ];

      const prompt = buildSummaryPrompt(messages);

      expect(prompt).toContain('User: Hello there');
      expect(prompt).toContain('Assistant: Hi! How can I help?');
      expect(prompt).toContain('User: Tell me about yourself');
      expect(prompt).toContain('<conversation>');
      expect(prompt).toContain('</conversation>');
    });

    it('includes summarization instructions', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

      const prompt = buildSummaryPrompt(messages);

      expect(prompt).toContain('Summarize this conversation');
      expect(prompt).toContain('Key topics');
      expect(prompt).toContain('decisions');
    });
  });
});
