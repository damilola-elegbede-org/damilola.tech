import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockList = vi.fn();
const mockDel = vi.fn();
vi.mock('@vercel/blob', () => ({
  list: mockList,
  del: mockDel,
}));

describe('cron cleanup-chats API route', () => {
  const originalEnv = process.env;
  const VALID_CRON_SECRET = 'test-cron-secret-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv, CRON_SECRET: VALID_CRON_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(authHeader?: string): Request {
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    return new Request('http://localhost/api/cron/cleanup-chats', {
      method: 'GET',
      headers,
    });
  }

  describe('authentication', () => {
    it('rejects requests without Authorization header', async () => {
      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects requests with invalid Bearer token', async () => {
      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest('Bearer wrong-secret');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects requests with malformed Authorization header', async () => {
      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest('Basic abc123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('accepts requests with valid Bearer token', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: null });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('cleanup logic', () => {
    const now = new Date('2025-04-22T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('deletes blobs older than 90 days', async () => {
      // 91 days ago
      const oldTimestamp = '2025-01-20T14-30-00Z';
      const oldBlob = {
        pathname: `damilola.tech/chats/production/${oldTimestamp}-a1b2c3d4.json`,
        url: `https://blob.vercel-storage.com/chats/production/${oldTimestamp}-a1b2c3d4.json`,
      };

      mockList.mockResolvedValue({ blobs: [oldBlob], cursor: null });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(oldBlob.url);
      expect(data.deleted).toBe(1);
      expect(data.kept).toBe(0);
    });

    it('keeps blobs younger than 90 days', async () => {
      // 30 days ago
      const recentTimestamp = '2025-03-23T14-30-00Z';
      const recentBlob = {
        pathname: `damilola.tech/chats/production/${recentTimestamp}-a1b2c3d4.json`,
        url: `https://blob.vercel-storage.com/chats/production/${recentTimestamp}-a1b2c3d4.json`,
      };

      mockList.mockResolvedValue({ blobs: [recentBlob], cursor: null });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
      expect(data.deleted).toBe(0);
      expect(data.kept).toBe(1);
    });

    it('handles mix of old and recent blobs', async () => {
      const oldBlob = {
        pathname: 'damilola.tech/chats/production/2025-01-01T14-30-00Z-old12345.json',
        url: 'https://blob.vercel-storage.com/old.json',
      };
      const recentBlob = {
        pathname: 'damilola.tech/chats/production/2025-03-23T14-30-00Z-new12345.json',
        url: 'https://blob.vercel-storage.com/new.json',
      };

      mockList.mockResolvedValue({ blobs: [oldBlob, recentBlob], cursor: null });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith(oldBlob.url);
      expect(data.deleted).toBe(1);
      expect(data.kept).toBe(1);
    });

    it('handles blobs exactly at 90-day boundary', async () => {
      // Exactly 90 days ago - should be kept (not older than 90 days)
      const boundaryTimestamp = '2025-01-22T12-00-00Z';
      const boundaryBlob = {
        pathname: `damilola.tech/chats/production/${boundaryTimestamp}-boundary.json`,
        url: 'https://blob.vercel-storage.com/boundary.json',
      };

      mockList.mockResolvedValue({ blobs: [boundaryBlob], cursor: null });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
      expect(data.kept).toBe(1);
    });

    it('handles pagination with cursor', async () => {
      const blob1 = {
        pathname: 'damilola.tech/chats/production/2025-01-01T14-30-00Z-page1.json',
        url: 'https://blob.vercel-storage.com/page1.json',
      };
      const blob2 = {
        pathname: 'damilola.tech/chats/production/2025-01-02T14-30-00Z-page2.json',
        url: 'https://blob.vercel-storage.com/page2.json',
      };

      mockList
        .mockResolvedValueOnce({ blobs: [blob1], cursor: 'next-page-cursor' })
        .mockResolvedValueOnce({ blobs: [blob2], cursor: null });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledTimes(2);
      expect(data.deleted).toBe(2);
    });

    it('skips blobs with unparseable timestamps', async () => {
      const invalidBlob = {
        pathname: 'damilola.tech/chats/production/invalid-timestamp.json',
        url: 'https://blob.vercel-storage.com/invalid.json',
      };

      mockList.mockResolvedValue({ blobs: [invalidBlob], cursor: null });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
      expect(data.skipped).toBe(1);

      consoleSpy.mockRestore();
    });

    it('only processes blobs in chats folder', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: null });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/chats/',
        cursor: undefined,
      });
    });
  });

  describe('error handling', () => {
    it('handles blob list errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob service unavailable'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('cleanup');

      consoleSpy.mockRestore();
    });

    it('continues processing if individual delete fails', async () => {
      const blob1 = {
        pathname: 'damilola.tech/chats/production/2025-01-01T14-30-00Z-fail.json',
        url: 'https://blob.vercel-storage.com/fail.json',
      };
      const blob2 = {
        pathname: 'damilola.tech/chats/production/2025-01-02T14-30-00Z-success.json',
        url: 'https://blob.vercel-storage.com/success.json',
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-22T12:00:00.000Z'));

      mockList.mockResolvedValue({ blobs: [blob1, blob2], cursor: null });
      mockDel
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledTimes(2);
      expect(data.deleted).toBe(1);
      expect(data.errors).toBe(1);

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('summary response', () => {
    it('returns comprehensive summary', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-22T12:00:00.000Z'));

      const oldBlob = {
        pathname: 'damilola.tech/chats/production/2025-01-01T14-30-00Z-old.json',
        url: 'https://blob.vercel-storage.com/old.json',
      };
      const recentBlob = {
        pathname: 'damilola.tech/chats/production/2025-04-01T14-30-00Z-new.json',
        url: 'https://blob.vercel-storage.com/new.json',
      };

      mockList.mockResolvedValue({ blobs: [oldBlob, recentBlob], cursor: null });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        deleted: 1,
        kept: 1,
        skipped: 0,
        errors: 0,
      });

      vi.useRealTimers();
    });
  });
});
