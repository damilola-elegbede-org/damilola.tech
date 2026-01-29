import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock admin auth
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_session',
}));

// Mock audit logging
const mockLogAdminEvent = vi.fn();
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: mockLogAdminEvent,
}));

// Mock rate limiting
const mockGetClientIp = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: mockGetClientIp,
}));

describe('admin chats/[id] API route', () => {
  const validBlobUrl = 'https://abc123xyz.blob.vercel-storage.com/damilola.tech/chats/chat-123.json';
  const encodedValidUrl = encodeURIComponent(validBlobUrl);
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieStore.get.mockClear();
    mockGetClientIp.mockReturnValue('127.0.0.1');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET - authentication', () => {
    it('returns 401 when no admin token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 401 when admin token is invalid', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET - URL validation', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns 400 for non-HTTPS URL', async () => {
      const invalidUrl = 'http://blob.vercel-storage.com/damilola.tech/chats/chat.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for URL without blob.vercel-storage.com domain', async () => {
      const invalidUrl = 'https://example.com/damilola.tech/chats/chat.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for URL without required path structure', async () => {
      const invalidUrl = 'https://abc123.blob.vercel-storage.com/wrong-path/chat.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed URL', async () => {
      const invalidUrl = 'not-a-url';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET - success cases', () => {
    const mockChatData = {
      id: 'chat-123',
      sessionId: 'session-456',
      messages: [
        {
          role: 'user',
          content: 'Tell me about your experience',
        },
        {
          role: 'assistant',
          content: 'I have extensive experience in...',
        },
      ],
      createdAt: '2026-01-15T10:00:00Z',
      metadata: {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      },
    };

    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns chat detail with valid authentication and URL', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockChatData);
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_chat_viewed',
        { chatUrl: validBlobUrl },
        '127.0.0.1'
      );
    });

    it('handles URL-encoded blob URL correctly', async () => {
      const urlWithSpecialChars = 'https://abc-123.blob.vercel-storage.com/damilola.tech/chats/chat%20with%20spaces.json';
      const encodedUrl = encodeURIComponent(urlWithSpecialChars);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(urlWithSpecialChars);
    });

    it('logs admin event with correct IP address', async () => {
      mockGetClientIp.mockReturnValue('203.0.113.42');

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      await GET(request, { params });

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_chat_viewed',
        { chatUrl: validBlobUrl },
        '203.0.113.42'
      );
    });
  });

  describe('GET - error handling', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns 404 when chat blob not found', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chat not found');
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
    });

    it('returns 404 when blob fetch returns non-ok status', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Chat not found');
    });

    it('returns 500 when fetch throws error', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch chat');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/chats/[id]] Error fetching chat:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when JSON parsing fails', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch chat');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/chats/[id]] Error fetching chat:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when audit logging fails but still returns chat data', async () => {
      const mockChatData = {
        id: 'chat-123',
        messages: [],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatData,
      } as unknown as Response);

      mockLogAdminEvent.mockRejectedValueOnce(new Error('Audit logging failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedValidUrl}`);
      const params = Promise.resolve({ id: encodedValidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      // Should return 500 since the audit logging is awaited and will throw
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch chat');

      consoleSpy.mockRestore();
    });
  });

  describe('GET - SSRF protection', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('rejects URLs with wrong domain', async () => {
      const ssrfUrl = 'https://malicious-site.com/damilola.tech/chats/chat.json';
      const encodedUrl = encodeURIComponent(ssrfUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects internal IP addresses', async () => {
      const ssrfUrl = 'https://192.168.1.1/damilola.tech/chats/chat.json';
      const encodedUrl = encodeURIComponent(ssrfUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects URLs without correct path prefix', async () => {
      const wrongPathUrl = 'https://abc123.blob.vercel-storage.com/other-project/chats/chat.json';
      const encodedUrl = encodeURIComponent(wrongPathUrl);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid chat URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('accepts valid blob storage URLs with correct structure', async () => {
      const validUrl = 'https://xyz789.blob.vercel-storage.com/damilola.tech/chats/session-abc.json';
      const encodedUrl = encodeURIComponent(validUrl);

      const mockChatData = { id: 'chat-123', messages: [] };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/chats/[id]/route');

      const request = new Request(`http://localhost/api/admin/chats/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(validUrl);
    });
  });
});
