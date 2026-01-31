/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock audit-server
const mockLogAdminEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/chats/[id] API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const createParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const request = new Request('http://localhost/api/v1/chats/test-id');
      const response = await GET(request, createParams('test-id'));

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/chats/[id]', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 404 for non-existent chat', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns chat content with valid key', async () => {
      const chatData = {
        sessionId: 'session-123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => chatData,
      } as Response);

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(chatData);
    });

    it('validates URL is Vercel Blob (SSRF protection)', async () => {
      const { GET } = await import('@/app/api/v1/chats/[id]/route');

      // Try to access a non-Vercel URL
      const maliciousUrl = encodeURIComponent('https://evil.com/sensitive-data');
      const request = new Request(`http://localhost/api/v1/chats/${maliciousUrl}`);
      const response = await GET(request, createParams(maliciousUrl));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('BAD_REQUEST');
      expect(data.error.message).toContain('Invalid');
    });

    it('rejects non-https URLs', async () => {
      const { GET } = await import('@/app/api/v1/chats/[id]/route');

      const httpUrl = encodeURIComponent('http://abc.blob.vercel-storage.com/data');
      const request = new Request(`http://localhost/api/v1/chats/${httpUrl}`);
      const response = await GET(request, createParams(httpUrl));
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('rejects URLs not containing chats path', async () => {
      const { GET } = await import('@/app/api/v1/chats/[id]/route');

      const wrongPathUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/other/path/file.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${wrongPathUrl}`);
      const response = await GET(request, createParams(wrongPathUrl));
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('logs admin_chat_viewed with accessType: api', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [] }),
      } as Response);

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${validBlobUrl}`);
      await GET(request, createParams(validBlobUrl));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_chat_viewed',
        expect.objectContaining({ chatUrl: expect.any(String) }),
        expect.any(String),
        expect.objectContaining({
          accessType: 'api',
          apiKeyId: 'key-1',
          apiKeyName: 'Test Key',
        })
      );
    });

    it('handles fetch errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('decodes URL-encoded IDs', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [] }),
      } as Response);

      const { GET } = await import('@/app/api/v1/chats/[id]/route');
      const encodedUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
      const request = new Request(`http://localhost/api/v1/chats/${encodedUrl}`);
      await GET(request, createParams(encodedUrl));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://abc.blob.vercel-storage.com/damilola.tech/chats/production/chat.json'
      );
    });
  });
});
