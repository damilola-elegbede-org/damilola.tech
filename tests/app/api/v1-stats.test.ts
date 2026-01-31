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
  isValidChatFilename: vi.fn((filename: string) => {
    // Simple validation for test - matches timestamp format or UUID format
    return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-z0-9]+\.json$/.test(filename) ||
           /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(filename) ||
           /^chat-[0-9a-f-]+\.json$/.test(filename);
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

describe('v1/stats API route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
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

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 with disabled API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key is disabled' } },
          { status: 403 }
        )
      );

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 with revoked API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key has been revoked' } },
          { status: 403 }
        )
      );

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/stats', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns stats with valid API key', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats', {
        headers: { Authorization: 'Bearer dk_live_testkey' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('chats');
      expect(data.data).toHaveProperty('fitAssessments');
      expect(data.data).toHaveProperty('resumeGenerations');
      expect(data.data).toHaveProperty('audit');
      expect(data.data).toHaveProperty('traffic');
    });

    it('includes environment in response', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.environment).toBe('production');
    });

    it('includes chat, fit-assessment, resume counts', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('chats/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
                size: 1234,
                url: 'https://blob.url/chat1',
              },
              {
                pathname: 'damilola.tech/chats/production/2026-01-27T10-30-00Z-def67890.json',
                size: 2345,
                url: 'https://blob.url/chat2',
              },
            ],
            cursor: undefined,
          };
        } else if (prefix.includes('fit-assessments/')) {
          return {
            blobs: [{ pathname: 'assessment1.json', size: 5000, url: 'url1' }],
            cursor: undefined,
          };
        } else if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              { pathname: 'resume1.json', size: 3000, url: 'url1' },
              { pathname: 'resume2.json', size: 3500, url: 'url2' },
            ],
            cursor: undefined,
          };
        } else if (prefix.includes('audit/')) {
          return {
            blobs: [{ pathname: '2026-01-28T10-00-00Z-page_view.json', size: 500, url: 'url1' }],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ applicationStatus: 'draft' }),
      } as Response);

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.chats.total).toBe(2);
      expect(data.data.fitAssessments.total).toBe(1);
      expect(data.data.resumeGenerations.total).toBe(2);
    });

    it('supports env query parameter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats?env=preview');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.environment).toBe('preview');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });

    it('handles pagination when counting blobs', async () => {
      let callCount = 0;
      mockList.mockImplementation(async ({ cursor }) => {
        callCount++;
        if (callCount === 1 && !cursor) {
          return {
            blobs: [{ pathname: 'fit1.json', size: 1000, url: 'url1' }],
            cursor: 'next-page',
          };
        } else if (cursor === 'next-page') {
          return {
            blobs: [{ pathname: 'fit2.json', size: 1000, url: 'url2' }],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      await GET(request);

      // Should have called list multiple times for pagination
      expect(mockList.mock.calls.length).toBeGreaterThan(1);
    });

    it('returns resume generations by status', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              { pathname: 'resume1.json', size: 3000, url: 'https://blob.url/resume1' },
              { pathname: 'resume2.json', size: 3500, url: 'https://blob.url/resume2' },
              { pathname: 'resume3.json', size: 3200, url: 'https://blob.url/resume3' },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('resume1')) {
          return { ok: true, json: async () => ({ applicationStatus: 'submitted' }) } as Response;
        } else if (urlStr.includes('resume2')) {
          return { ok: true, json: async () => ({ applicationStatus: 'draft' }) } as Response;
        } else {
          return { ok: true, json: async () => ({ applicationStatus: 'submitted' }) } as Response;
        }
      });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.resumeGenerations.byStatus).toBeDefined();
      expect(data.data.resumeGenerations.byStatus.submitted).toBe(2);
      expect(data.data.resumeGenerations.byStatus.draft).toBe(1);
    });

    it('returns audit events by type', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('audit/')) {
          return {
            blobs: [
              { pathname: 'audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json', size: 500, url: 'url1' },
              { pathname: 'audit/production/2026-01-28/2026-01-28T10-01-00Z-page_view.json', size: 500, url: 'url2' },
              { pathname: 'audit/production/2026-01-28/2026-01-28T10-02-00Z-chat_opened.json', size: 500, url: 'url3' },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.audit.byType).toBeDefined();
      expect(data.data.audit.byType.page_view).toBe(2);
      expect(data.data.audit.byType.chat_opened).toBe(1);
    });

    it('returns traffic top sources', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('audit/')) {
          return {
            blobs: [
              { pathname: 'audit/prod/2026-01-28/2026-01-28T10-00-00Z-page_view.json', size: 500, url: 'https://blob.url/pv1' },
              { pathname: 'audit/prod/2026-01-28/2026-01-28T10-01-00Z-page_view.json', size: 500, url: 'https://blob.url/pv2' },
              { pathname: 'audit/prod/2026-01-28/2026-01-28T10-02-00Z-page_view.json', size: 500, url: 'https://blob.url/pv3' },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('pv1') || urlStr.includes('pv2')) {
          return {
            ok: true,
            json: async () => ({
              eventType: 'page_view',
              metadata: { trafficSource: { source: 'linkedin', medium: 'social' } },
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            eventType: 'page_view',
            metadata: { trafficSource: { source: 'direct' } },
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.traffic.topSources).toBeDefined();
      expect(data.data.traffic.topSources.length).toBeGreaterThan(0);
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('filters out zero-byte chat files', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('chats/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
                size: 1234,
                url: 'https://blob.url/chat1',
              },
              {
                pathname: 'damilola.tech/chats/production/2026-01-27T10-30-00Z-zerobyte.json',
                size: 0, // Zero-byte file
                url: 'https://blob.url/chat2',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.chats.total).toBe(1); // Only non-zero file counted
    });

    it('logs api_stats_accessed audit event with correct parameters', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/stats/route');
      const request = new Request('http://localhost/api/v1/stats?env=production');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_stats_accessed',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          environment: 'production',
        }),
        '127.0.0.1'
      );
    });
  });
});
