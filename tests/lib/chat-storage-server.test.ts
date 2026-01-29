import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveConversationToBlob } from '@/lib/chat-storage-server';

// Mock @vercel/blob
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

describe('chat-storage-server', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveConversationToBlob', () => {
    it('saves conversation with unified path format', async () => {
      // Session ID format: chat-{uuid}
      const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      expect(mockPut).toHaveBeenCalledTimes(1);
      // Unified format: chat-{timestamp}-{shortId}.json
      // shortId is first UUID segment after 'chat-': 'a1b2c3d4'
      expect(mockPut).toHaveBeenCalledWith(
        'damilola.tech/chats/development/chat-2025-01-22T10-30-00Z-a1b2c3d4.json',
        expect.any(String),
        expect.objectContaining({
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
      );
    });

    it('saves conversation with correct payload structure', async () => {
      const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload).toMatchObject({
        version: 1,
        sessionId,
        environment: 'development',
        sessionStartedAt,
        messageCount: 2,
        messages,
      });
      expect(savedPayload.updatedAt).toBeDefined();
    });

    it('uses VERCEL_ENV for environment when available', async () => {
      const originalEnv = process.env.VERCEL_ENV;
      process.env.VERCEL_ENV = 'production';

      try {
        const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const sessionStartedAt = '2025-01-22T10:30:00.000Z';
        const messages = [{ role: 'user' as const, content: 'Hello' }];

        await saveConversationToBlob(sessionId, sessionStartedAt, messages);

        expect(mockPut).toHaveBeenCalledWith(
          'damilola.tech/chats/production/chat-2025-01-22T10-30-00Z-a1b2c3d4.json',
          expect.any(String),
          expect.any(Object)
        );

        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.environment).toBe('production');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.VERCEL_ENV;
        } else {
          process.env.VERCEL_ENV = originalEnv;
        }
      }
    });

    it('handles single message conversation', async () => {
      const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.messageCount).toBe(1);
      expect(savedPayload.messages).toHaveLength(1);
    });

    it('propagates errors from blob storage', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await expect(
        saveConversationToBlob(sessionId, sessionStartedAt, messages)
      ).rejects.toThrow('Blob storage error');
    });

    it('uses addRandomSuffix false for consistent overwrites', async () => {
      const sessionId = 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const options = mockPut.mock.calls[0][2];
      expect(options.addRandomSuffix).toBe(false);
    });

    it('extracts shortId correctly from chat-prefixed sessionId', async () => {
      // Different UUID to verify shortId extraction
      const sessionId = 'chat-ff112233-4455-6677-8899-aabbccddeeff';
      const sessionStartedAt = '2025-03-15T14:45:30.000Z';
      const messages = [{ role: 'user' as const, content: 'Test' }];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const path = mockPut.mock.calls[0][0];
      // shortId should be 'ff112233' (first UUID segment after 'chat-')
      expect(path).toContain('-ff112233.json');
    });
  });
});
