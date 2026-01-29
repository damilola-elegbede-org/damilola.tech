import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  list: mockList,
}));

// Mock admin-auth
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: vi.fn(),
  ADMIN_COOKIE_NAME: 'admin_session',
}));

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('admin chats API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('GET - authentication', () => {
    it('returns 401 when no auth token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockList).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      vi.mocked(verifyToken).mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockList).not.toHaveBeenCalled();
    });

    it('proceeds with valid auth token', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(verifyToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('GET - chat list retrieval', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('returns chat list with valid auth', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 1234,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date('2026-01-28T10:30:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-27T15-20-00Z-def67890.json',
            size: 2345,
            url: 'https://blob.url/chat2',
            uploadedAt: new Date('2026-01-27T15:20:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(2);
      expect(data.chats[0]).toEqual({
        id: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
        pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
        sessionId: 'abc12345',
        environment: 'production',
        timestamp: '2026-01-28T10:30:00.000Z',
        size: 1234,
        url: 'https://blob.url/chat1',
      });
      expect(data.chats[1]).toEqual({
        id: 'damilola.tech/chats/production/2026-01-27T15-20-00Z-def67890.json',
        pathname: 'damilola.tech/chats/production/2026-01-27T15-20-00Z-def67890.json',
        sessionId: 'def67890',
        environment: 'production',
        timestamp: '2026-01-27T15:20:00.000Z',
        size: 2345,
        url: 'https://blob.url/chat2',
      });
      expect(data.cursor).toBeUndefined();
      expect(data.hasMore).toBe(false);

      // Verify blob list was called with correct prefix
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('handles legacy UUID format', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/12345678-1234-1234-1234-123456789abc.json',
            size: 3000,
            url: 'https://blob.url/legacy-chat',
            uploadedAt: new Date('2026-01-26T08:15:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(1);
      expect(data.chats[0]).toEqual({
        id: 'damilola.tech/chats/production/12345678-1234-1234-1234-123456789abc.json',
        pathname: 'damilola.tech/chats/production/12345678-1234-1234-1234-123456789abc.json',
        sessionId: '12345678', // First 8 chars of UUID
        environment: 'production',
        timestamp: '2026-01-26T08:15:00.000Z', // From uploadedAt
        size: 3000,
        url: 'https://blob.url/legacy-chat',
      });
    });

    it('handles chat-prefixed format from live saves', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/chat-939d8245-20b8-49b3-9e1b-746232af362e.json',
            size: 4500,
            url: 'https://blob.url/chat-prefixed',
            uploadedAt: new Date('2026-01-28T12:30:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(1);
      expect(data.chats[0]).toEqual({
        id: 'damilola.tech/chats/production/chat-939d8245-20b8-49b3-9e1b-746232af362e.json',
        pathname: 'damilola.tech/chats/production/chat-939d8245-20b8-49b3-9e1b-746232af362e.json',
        sessionId: '939d8245', // Short ID (first 8 chars of UUID) for display consistency
        environment: 'production',
        timestamp: '2026-01-28T12:30:00.000Z', // From uploadedAt
        size: 4500,
        url: 'https://blob.url/chat-prefixed',
      });
    });

    it('filters out zero-byte files', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-abcd1234.json',
            size: 1000,
            url: 'https://blob.url/valid-chat',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T11-00-00Z-empty456.json',
            size: 0, // Zero-byte file
            url: 'https://blob.url/empty-chat',
            uploadedAt: new Date('2026-01-28T11:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T12-00-00Z-efab7890.json',
            size: 2000,
            url: 'https://blob.url/another-valid-chat',
            uploadedAt: new Date('2026-01-28T12:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(2); // Only non-zero-byte files
      expect(data.chats[0].sessionId).toBe('abcd1234');
      expect(data.chats[1].sessionId).toBe('efab7890');
    });

    it('filters out invalid filenames', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-aabbccdd.json',
            size: 1000,
            url: 'https://blob.url/valid1',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/invalid-filename.json',
            size: 1500,
            url: 'https://blob.url/invalid',
            uploadedAt: new Date('2026-01-28T11:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/12345678-1234-1234-1234-123456789abc.json',
            size: 2000,
            url: 'https://blob.url/valid2',
            uploadedAt: new Date('2026-01-28T12:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(2); // Only valid formats
      expect(data.chats[0].sessionId).toBe('aabbccdd');
      expect(data.chats[1].sessionId).toBe('12345678');
    });

    it('handles new format with additional suffix', async () => {
      process.env.VERCEL_ENV = 'production';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname:
              'damilola.tech/chats/production/2026-01-28T10-00-00Z-abc12345-suffix.json',
            size: 1000,
            url: 'https://blob.url/chat-with-suffix',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(1);
      expect(data.chats[0].sessionId).toBe('abc12345');
      expect(data.chats[0].timestamp).toBe('2026-01-28T10:00:00.000Z');
    });
  });

  describe('GET - pagination', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      process.env.VERCEL_ENV = 'production';
    });

    it('returns pagination metadata', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-chat001.json',
            size: 1000,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
        ],
        cursor: 'next-page-cursor',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cursor).toBe('next-page-cursor');
      expect(data.hasMore).toBe(true);
    });

    it('accepts cursor parameter for pagination', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-27T10-00-00Z-chat002.json',
            size: 1100,
            url: 'https://blob.url/chat2',
            uploadedAt: new Date('2026-01-27T10:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats?cursor=page-2-cursor');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: 'page-2-cursor',
        limit: 50,
      });
      expect(data.hasMore).toBe(false);
    });

    it('accepts limit parameter', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats?limit=25');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: undefined,
        limit: 25,
      });
    });

    it('enforces maximum limit of 100', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats?limit=500');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: undefined,
        limit: 100, // Capped at 100
      });
    });

    it('defaults to limit of 50', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: undefined,
        limit: 50,
      });
    });
  });

  describe('GET - environment filtering', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });
    });

    it('uses production environment by default', async () => {
      delete process.env.VERCEL_ENV;

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/production/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('uses VERCEL_ENV when set', async () => {
      process.env.VERCEL_ENV = 'preview';

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/preview/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('accepts env query parameter', async () => {
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats?env=development');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/development/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('env query parameter overrides VERCEL_ENV', async () => {
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats?env=preview');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/preview/',
        cursor: undefined,
        limit: 50,
      });
    });
  });

  describe('GET - empty data handling', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      process.env.VERCEL_ENV = 'production';
    });

    it('handles empty blob list', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toEqual([]);
      expect(data.cursor).toBeUndefined();
      expect(data.hasMore).toBe(false);
    });

    it('handles all files being filtered out', async () => {
      mockList.mockResolvedValue({
        blobs: [
          // All zero-byte files
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-zero001.json',
            size: 0,
            url: 'https://blob.url/zero1',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T11-00-00Z-zero002.json',
            size: 0,
            url: 'https://blob.url/zero2',
            uploadedAt: new Date('2026-01-28T11:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toEqual([]);
      expect(data.cursor).toBeUndefined();
      expect(data.hasMore).toBe(false);
    });

    it('handles mix of valid and invalid files', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-abcdef12.json',
            size: 1000,
            url: 'https://blob.url/valid',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/invalid-name.json',
            size: 1000,
            url: 'https://blob.url/invalid',
            uploadedAt: new Date('2026-01-28T11:00:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T12-00-00Z-aaaa0000.json',
            size: 0,
            url: 'https://blob.url/zero',
            uploadedAt: new Date('2026-01-28T12:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats).toHaveLength(1);
      expect(data.chats[0].sessionId).toBe('abcdef12');
    });
  });

  describe('GET - error handling', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      process.env.VERCEL_ENV = 'production';
    });

    it('returns 500 when blob list fails', async () => {
      mockList.mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list chats');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/chats] Error listing chats:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles blob list network errors', async () => {
      mockList.mockRejectedValue(new Error('Network timeout'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list chats');

      consoleSpy.mockRestore();
    });
  });

  describe('GET - timestamp parsing', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      process.env.VERCEL_ENV = 'production';
    });

    it('correctly parses timestamp from new format filename', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T14-45-30Z-abc12345.json',
            size: 1000,
            url: 'https://blob.url/chat',
            uploadedAt: new Date('2026-01-28T14:45:30Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats[0].timestamp).toBe('2026-01-28T14:45:30.000Z');
    });

    it('uses uploadedAt for legacy format without timestamp in filename', async () => {
      const uploadedDate = new Date('2026-01-25T09:30:15Z');

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/abcdef12-3456-7890-abcd-ef1234567890.json',
            size: 1500,
            url: 'https://blob.url/legacy',
            uploadedAt: uploadedDate,
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats[0].timestamp).toBe(uploadedDate.toISOString());
    });

    it('handles missing uploadedAt in legacy format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/abcdef12-3456-7890-abcd-ef1234567890.json',
            size: 1500,
            url: 'https://blob.url/legacy-no-date',
            uploadedAt: undefined, // Missing uploadedAt
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/admin/chats/route');

      const request = new Request('http://localhost/api/admin/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats[0].timestamp).toBe('');
    });
  });
});
