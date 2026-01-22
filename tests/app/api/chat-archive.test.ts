import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}));

describe('chat archive API route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const validSessionData = {
    sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    sessionStartedAt: '2025-01-22T10:30:00.000Z',
    messages: [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] },
    ],
  };

  describe('valid requests', () => {
    it('archives session successfully', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/chats/production/2025-01-22T14-30-00Z-a1b2c3d4.json',
        pathname: 'damilola.tech/chats/production/2025-01-22T14-30-00Z-a1b2c3d4.json',
      });

      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPut).toHaveBeenCalledTimes(1);

      // Verify the blob path format
      const [pathname, content, options] = mockPut.mock.calls[0];
      expect(pathname).toMatch(/^damilola\.tech\/chats\/production\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-a1b2c3d4\.json$/);
      expect(options).toEqual({ access: 'public', contentType: 'application/json' });

      // Verify the archived content structure
      const parsedContent = JSON.parse(content);
      expect(parsedContent.version).toBe(1);
      expect(parsedContent.sessionId).toBe(validSessionData.sessionId);
      expect(parsedContent.environment).toBe('production');
      expect(parsedContent.sessionStartedAt).toBe(validSessionData.sessionStartedAt);
      expect(parsedContent.messageCount).toBe(2);
      expect(parsedContent.messages).toEqual(validSessionData.messages);
      expect(parsedContent.archivedAt).toBeDefined();
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/chats/preview/');
    });

    it('uses development environment when VERCEL_ENV is not set', async () => {
      delete process.env.VERCEL_ENV;
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/chats/development/');
    });
  });

  describe('validation errors', () => {
    it('rejects request without sessionId', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
          messages: validSessionData.messages,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('sessionId');
    });

    it('rejects request without sessionStartedAt', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: validSessionData.sessionId,
          messages: validSessionData.messages,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('sessionStartedAt');
    });

    it('rejects request without messages', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: validSessionData.sessionId,
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('messages');
    });

    it('rejects request with empty messages array', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionData,
          messages: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('empty');
    });

    it('rejects request with invalid sessionId format', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionData,
          sessionId: 'invalid-id',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('sessionId');
    });

    it('rejects request with invalid sessionStartedAt format', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionData,
          sessionStartedAt: 'not-a-date',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('sessionStartedAt');
    });

    it('rejects invalid JSON body', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('blob errors', () => {
    it('returns 500 when blob put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const { POST } = await import('@/app/api/chat/archive/route');

      const request = new Request('http://localhost/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionData),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('archive');

      consoleSpy.mockRestore();
    });
  });
});
