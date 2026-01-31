/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock chat-filename
vi.mock('@/lib/chat-filename', () => ({
  parseChatFilename: vi.fn((filename: string, uploadedAt?: string) => {
    // Simple parse for tests
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-z0-9]+)\.json$/);
    if (match) {
      const timestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z');
      return { timestamp, sessionId: match[2] };
    }
    // UUID format
    const uuidMatch = filename.match(/^([0-9a-f-]{36})\.json$/);
    if (uuidMatch) {
      return { timestamp: uploadedAt || '', sessionId: uuidMatch[1] };
    }
    return null;
  }),
}));

// Mock api-audit
const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/chats API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 403 with disabled/revoked key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Key disabled' } },
          { status: 403 }
        )
      );

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/chats', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns chat list with valid key', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 1234,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date('2026-01-28T10:30:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chats).toHaveLength(1);
    });

    it('supports pagination (cursor, limit)', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: 'next-cursor',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats?limit=10&cursor=prev-cursor');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          cursor: 'prev-cursor',
        })
      );
    });

    it('limits max results to 100', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats?limit=500');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('supports environment filter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats?env=preview');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });

    it('returns proper response format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-session123.json',
            size: 1234,
            url: 'https://blob.vercel-storage.com/chat1',
            uploadedAt: new Date('2026-01-28T10:30:00Z'),
          },
        ],
        cursor: 'next-page',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.chats[0]).toHaveProperty('id');
      expect(data.data.chats[0]).toHaveProperty('pathname');
      expect(data.data.chats[0]).toHaveProperty('sessionId');
      expect(data.data.chats[0]).toHaveProperty('environment');
      expect(data.data.chats[0]).toHaveProperty('timestamp');
      expect(data.data.chats[0]).toHaveProperty('size');
      expect(data.data.chats[0]).toHaveProperty('url');
      expect(data.meta.pagination).toHaveProperty('cursor', 'next-page');
      expect(data.meta.pagination).toHaveProperty('hasMore', true);
    });

    it('filters out zero-byte chats', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-valid123.json',
            size: 1234,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date(),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-27T10-30-00Z-zerobyte.json',
            size: 0,
            url: 'https://blob.url/chat2',
            uploadedAt: new Date(),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.chats).toHaveLength(1);
      expect(data.data.chats[0].sessionId).toBe('valid123');
    });

    it('filters out unparseable filenames', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-valid123.json',
            size: 1234,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date(),
          },
          {
            pathname: 'damilola.tech/chats/production/invalid-filename.json',
            size: 1000,
            url: 'https://blob.url/chat2',
            uploadedAt: new Date(),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      // Only valid filename should be returned
      expect(data.data.chats).toHaveLength(1);
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('uses default environment from VERCEL_ENV', async () => {
      process.env.VERCEL_ENV = 'production';
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      const response = await GET(request);
      const data = await response.json();

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'damilola.tech/chats/production/',
        })
      );
      expect(data.meta.environment).toBe('production');
    });

    it('logs api_chats_list audit event with correct parameters', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 1234,
            url: 'https://blob.url/chat1',
            uploadedAt: new Date('2026-01-28T10:30:00Z'),
          },
          {
            pathname: 'damilola.tech/chats/production/2026-01-29T10-30-00Z-def67890.json',
            size: 2345,
            url: 'https://blob.url/chat2',
            uploadedAt: new Date('2026-01-29T10:30:00Z'),
          },
        ],
        cursor: 'next-cursor',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/chats/route');
      const request = new Request('http://localhost/api/v1/chats');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_chats_list',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          environment: 'production',
          resultCount: 2,
          hasMore: true,
        }),
        '127.0.0.1'
      );
    });
  });
});
