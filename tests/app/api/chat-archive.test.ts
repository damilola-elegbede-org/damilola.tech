import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('chat archive API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('no-op behavior', () => {
    it('returns success without processing (unified format handles persistence)', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
          messages: [
            { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          ],
        }),
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns success regardless of request body (backward compat no-op)', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      // Call with no request body - should still succeed as a no-op
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
