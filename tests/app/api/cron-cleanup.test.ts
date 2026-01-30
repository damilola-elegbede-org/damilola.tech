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
    process.env = { ...originalEnv, CRON_SECRET: VALID_CRON_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(
    authHeader?: string,
    dryRun = false
  ): Request {
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const url = dryRun
      ? 'http://localhost/api/cron/cleanup-chats?dryRun=true'
      : 'http://localhost/api/cron/cleanup-chats';
    return new Request(url, {
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
      vi.resetModules();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('deletes production chats older than 180 days', async () => {
      // ~200 days ago (older than 180 days)
      const oldTimestamp = '2024-10-05T14-30-00Z';
      const oldBlob = {
        pathname: `damilola.tech/chats/production/chat-${oldTimestamp}-a1b2c3d4.json`,
        url: `https://blob.vercel-storage.com/chats/production/chat-${oldTimestamp}-a1b2c3d4.json`,
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [oldBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(oldBlob.url);
      expect(data.chats.production.deleted).toBe(1);
    });

    it('keeps production chats younger than 180 days', async () => {
      // 30 days ago - within 180 day retention
      const recentTimestamp = '2025-03-23T14-30-00Z';
      const recentBlob = {
        pathname: `damilola.tech/chats/production/chat-${recentTimestamp}-a1b2c3d4.json`,
        url: `https://blob.vercel-storage.com/chats/production/chat-${recentTimestamp}-a1b2c3d4.json`,
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [recentBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
      expect(data.chats.production.kept).toBe(1);
    });

    it('deletes preview chats older than 14 days', async () => {
      // 20 days ago - older than 14 day preview retention
      const oldTimestamp = '2025-04-02T14-30-00Z';
      const oldBlob = {
        pathname: `damilola.tech/chats/preview/chat-${oldTimestamp}-a1b2c3d4.json`,
        url: `https://blob.vercel-storage.com/chats/preview/chat-${oldTimestamp}-a1b2c3d4.json`,
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/preview/') {
          return Promise.resolve({ blobs: [oldBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(oldBlob.url);
      expect(data.chats.preview.deleted).toBe(1);
    });

    it('deletes all development artifacts immediately', async () => {
      const devBlobs = [
        {
          pathname: 'damilola.tech/audit/development/2025-04-21.json',
          url: 'https://blob.vercel-storage.com/audit/development/2025-04-21.json',
          size: 512,
        },
        {
          pathname: 'damilola.tech/chats/development/chat-2025-04-21T14-30-00Z-abc123.json',
          url: 'https://blob.vercel-storage.com/chats/development/chat-abc123.json',
          size: 1024,
        },
      ];

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/audit/development/') {
          return Promise.resolve({ blobs: [devBlobs[0]], cursor: null });
        }
        if (prefix === 'damilola.tech/chats/development/') {
          return Promise.resolve({ blobs: [devBlobs[1]], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(devBlobs[0].url);
      expect(mockDel).toHaveBeenCalledWith(devBlobs[1].url);
      expect(data.audit.development.deleted).toBe(2);
    });

    it('never deletes protected paths', async () => {
      const protectedBlob = {
        pathname: 'damilola.tech/content/system-prompt.md',
        url: 'https://blob.vercel-storage.com/content/system-prompt.md',
        size: 5000,
        uploadedAt: new Date('2024-01-01'), // Very old
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/') {
          return Promise.resolve({ blobs: [protectedBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalledWith(protectedBlob.url);
    });

    it('deletes empty placeholder files', async () => {
      const emptyBlob = {
        pathname: 'damilola.tech/',
        url: 'https://blob.vercel-storage.com/damilola.tech/',
        size: 0,
      };
      const normalBlob = {
        pathname: 'damilola.tech/audit/production/2025-04-21.json',
        url: 'https://blob.vercel-storage.com/audit/production/2025-04-21.json',
        size: 512,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/') {
          return Promise.resolve({ blobs: [emptyBlob, normalBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(emptyBlob.url);
      expect(data.artifacts.emptyPlaceholders.deleted).toBe(1);
    });

    it('deletes orphan sessions without valid prefix', async () => {
      const orphanSession = {
        pathname: 'damilola.tech/usage/production/sessions/abc-123-456.json',
        url: 'https://blob.vercel-storage.com/usage/production/sessions/abc-123-456.json',
        size: 256,
      };
      const validSession = {
        pathname: 'damilola.tech/usage/production/sessions/chat-abc-123-456.json',
        url: 'https://blob.vercel-storage.com/usage/production/sessions/chat-abc-123-456.json',
        size: 256,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/usage/production/sessions/') {
          return Promise.resolve({ blobs: [orphanSession, validSession], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(orphanSession.url);
      expect(mockDel).not.toHaveBeenCalledWith(validSession.url);
      expect(data.artifacts.orphanSessions.deleted).toBe(1);
    });

    it('handles pagination with cursor', async () => {
      const blob1 = {
        pathname: 'damilola.tech/chats/production/chat-2024-10-01T14-30-00Z-aa112233.json',
        url: 'https://blob.vercel-storage.com/page1.json',
        size: 1024,
      };
      const blob2 = {
        pathname: 'damilola.tech/chats/production/chat-2024-10-02T14-30-00Z-bb223344.json',
        url: 'https://blob.vercel-storage.com/page2.json',
        size: 1024,
      };

      let chatCallCount = 0;
      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          chatCallCount++;
          if (chatCallCount === 1) {
            return Promise.resolve({ blobs: [blob1], cursor: 'next-page-cursor' });
          }
          return Promise.resolve({ blobs: [blob2], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith(blob1.url);
      expect(mockDel).toHaveBeenCalledWith(blob2.url);
      expect(data.chats.production.deleted).toBe(2);
    });

    it('skips blobs with unparseable timestamps', async () => {
      const invalidBlob = {
        pathname: 'damilola.tech/chats/production/invalid-timestamp.json',
        url: 'https://blob.vercel-storage.com/invalid.json',
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [invalidBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
      expect(data.chats.production.skipped).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe('dry-run mode', () => {
    const now = new Date('2025-04-22T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      vi.resetModules();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reports what would be deleted without actually deleting', async () => {
      const oldBlob = {
        pathname: 'damilola.tech/chats/production/chat-2024-10-01T14-30-00Z-abc12345.json',
        url: 'https://blob.vercel-storage.com/old.json',
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [oldBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`, true);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dryRun).toBe(true);
      expect(data.chats.production.deleted).toBe(1);
      expect(mockDel).not.toHaveBeenCalled();
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
        pathname: 'damilola.tech/chats/production/chat-2024-10-01T14-30-00Z-cc334455.json',
        url: 'https://blob.vercel-storage.com/fail.json',
        size: 1024,
      };
      const blob2 = {
        pathname: 'damilola.tech/chats/production/chat-2024-10-02T14-30-00Z-dd445566.json',
        url: 'https://blob.vercel-storage.com/success.json',
        size: 1024,
      };

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-22T12:00:00.000Z'));

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [blob1, blob2], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
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
      expect(data.chats.production.deleted).toBe(1);
      expect(data.chats.production.errors).toBe(1);

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('summary response', () => {
    it('returns comprehensive summary with new structure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-22T12:00:00.000Z'));

      const oldBlob = {
        pathname: 'damilola.tech/chats/production/chat-2024-10-01T14-30-00Z-ee556677.json',
        url: 'https://blob.vercel-storage.com/old.json',
        size: 1024,
      };
      const recentBlob = {
        pathname: 'damilola.tech/chats/production/chat-2025-04-01T14-30-00Z-ff667788.json',
        url: 'https://blob.vercel-storage.com/new.json',
        size: 1024,
      };

      mockList.mockImplementation(({ prefix }: { prefix: string }) => {
        if (prefix === 'damilola.tech/chats/production/') {
          return Promise.resolve({ blobs: [oldBlob, recentBlob], cursor: null });
        }
        return Promise.resolve({ blobs: [], cursor: null });
      });
      mockDel.mockResolvedValue(undefined);

      const { GET } = await import('@/app/api/cron/cleanup-chats/route');

      const request = createRequest(`Bearer ${VALID_CRON_SECRET}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        dryRun: false,
        chats: {
          production: { deleted: 1, kept: 1, skipped: 0, errors: 0 },
          preview: { deleted: 0, kept: 0, skipped: 0, errors: 0 },
        },
        fitAssessments: { deleted: 0, kept: 0, skipped: 0, errors: 0 },
        resumeGenerations: { deleted: 0, kept: 0, skipped: 0, errors: 0 },
        audit: {
          production: { deleted: 0, kept: 0, skipped: 0, errors: 0 },
          preview: { deleted: 0, kept: 0, skipped: 0, errors: 0 },
          development: { deleted: 0 },
        },
        artifacts: {
          emptyPlaceholders: { deleted: 0 },
          orphanSessions: { deleted: 0 },
        },
        totals: { deleted: 1, kept: 1, skipped: 0, errors: 0 },
      });

      vi.useRealTimers();
    });
  });
});
