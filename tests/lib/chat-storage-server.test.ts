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
    it('saves conversation with correct path structure', async () => {
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut).toHaveBeenCalledWith(
        `damilola.tech/chats/development/${sessionId}.json`,
        expect.any(String),
        expect.objectContaining({
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
      );
    });

    it('saves conversation with correct payload structure', async () => {
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
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
        const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const sessionStartedAt = '2025-01-22T10:30:00.000Z';
        const messages = [{ role: 'user' as const, content: 'Hello' }];

        await saveConversationToBlob(sessionId, sessionStartedAt, messages);

        expect(mockPut).toHaveBeenCalledWith(
          `damilola.tech/chats/production/${sessionId}.json`,
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
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.messageCount).toBe(1);
      expect(savedPayload.messages).toHaveLength(1);
    });

    it('logs errors from blob storage without throwing (fire-and-forget)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      // Should not throw - fire-and-forget pattern
      await expect(
        saveConversationToBlob(sessionId, sessionStartedAt, messages)
      ).resolves.toBeUndefined();

      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('blob.save_failed')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blob storage error')
      );

      consoleSpy.mockRestore();
    });

    it('uses addRandomSuffix false for consistent overwrites', async () => {
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionStartedAt = '2025-01-22T10:30:00.000Z';
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await saveConversationToBlob(sessionId, sessionStartedAt, messages);

      const options = mockPut.mock.calls[0][2];
      expect(options.addRandomSuffix).toBe(false);
    });
  });
});
