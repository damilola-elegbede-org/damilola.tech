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

describe('admin stats API route', () => {
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
    vi.restoreAllMocks();
  });

  describe('GET - authentication', () => {
    it('returns 401 when no auth token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
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

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
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

      // Mock empty blob lists
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(verifyToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('GET - stats aggregation', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('returns aggregated stats with valid data', async () => {
      process.env.VERCEL_ENV = 'production';

      // Mock chat blobs (with valid filenames)
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
                pathname: 'damilola.tech/chats/production/2026-01-27T15-20-00Z-def67890.json',
                size: 2345,
                url: 'https://blob.url/chat2',
              },
              // Zero-byte chat (should be filtered out)
              {
                pathname: 'damilola.tech/chats/production/2026-01-26T08-15-00Z-ghi11111.json',
                size: 0,
                url: 'https://blob.url/chat3',
              },
            ],
            cursor: undefined,
          };
        } else if (prefix.includes('fit-assessments/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/fit-assessments/production/assessment1.json',
                size: 5000,
                url: 'https://blob.url/assessment1',
              },
            ],
            cursor: undefined,
          };
        } else if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/resume-generations/production/resume1.json',
                size: 3000,
                url: 'https://blob.url/resume1',
              },
              {
                pathname: 'damilola.tech/resume-generations/production/resume2.json',
                size: 3500,
                url: 'https://blob.url/resume2',
              },
            ],
            cursor: undefined,
          };
        } else if (prefix.includes('audit/')) {
          return {
            blobs: [
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/audit1',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-05-00Z-chat_opened.json',
                size: 450,
                url: 'https://blob.url/audit2',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-10-00Z-page_view.json',
                size: 520,
                url: 'https://blob.url/audit3',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch for resume status and audit events
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('resume1')) {
          return {
            ok: true,
            json: async () => ({ applicationStatus: 'submitted' }),
          } as Response;
        } else if (urlStr.includes('resume2')) {
          return {
            ok: true,
            json: async () => ({ applicationStatus: 'draft' }),
          } as Response;
        } else if (urlStr.includes('audit1') || urlStr.includes('audit3')) {
          return {
            ok: true,
            json: async () => ({
              eventType: 'page_view',
              metadata: {
                trafficSource: { source: 'linkedin', medium: 'social' },
              },
            }),
          } as Response;
        }
        return { ok: false } as Response;
      });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        chats: { total: 2 }, // Zero-byte chat filtered out
        fitAssessments: { total: 1 },
        resumeGenerations: {
          total: 2,
          byStatus: {
            submitted: 1,
            draft: 1,
          },
        },
        audit: {
          total: 3,
          byType: {
            page_view: 2,
            chat_opened: 1,
          },
        },
        traffic: {
          topSources: expect.arrayContaining([
            expect.objectContaining({
              source: 'linkedin',
              count: expect.any(Number),
              percentage: expect.any(Number),
            }),
          ]),
        },
        environment: 'production',
      });
    });

    it('handles pagination correctly', async () => {
      // Simulate pagination with cursor
      let callCount = 0;  // eslint-disable-line @typescript-eslint/no-unused-vars
      mockList.mockImplementation(async ({ cursor }) => {
        callCount++;
        if (!cursor) {
          // First call
          return {
            blobs: [
              {
                pathname: 'damilola.tech/chats/production/2026-01-28T10-00-00Z-abc12345.json',
                size: 1000,
                url: 'https://blob.url/chat1',
              },
            ],
            cursor: 'next-page-cursor',
          };
        } else {
          // Second call with cursor
          return {
            blobs: [
              {
                pathname: 'damilola.tech/chats/production/2026-01-27T09-00-00Z-def67890.json',
                size: 1100,
                url: 'https://blob.url/chat2',
              },
            ],
            cursor: undefined, // End of pagination
          };
        }
      });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats.total).toBe(2); // Both pages counted
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'next-page-cursor' })
      );
    });

    it('filters out invalid chat filenames', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('chats/')) {
          return {
            blobs: [
              // Valid new format
              {
                pathname: 'damilola.tech/chats/production/2026-01-28T10-30-00Z-abc12345.json',
                size: 1234,
                url: 'https://blob.url/chat1',
              },
              // Valid legacy format
              {
                pathname:
                  'damilola.tech/chats/production/12345678-1234-1234-1234-123456789abc.json',
                size: 2345,
                url: 'https://blob.url/chat2',
              },
              // Invalid filename (should be filtered)
              {
                pathname: 'damilola.tech/chats/production/invalid-filename.json',
                size: 3456,
                url: 'https://blob.url/chat3',
              },
              // Zero-byte (should be filtered)
              {
                pathname: 'damilola.tech/chats/production/2026-01-27T10-00-00Z-zero1234.json',
                size: 0,
                url: 'https://blob.url/chat4',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chats.total).toBe(2); // Only valid formats counted
    });

    it('handles missing resume status gracefully', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/resume-generations/production/resume1.json',
                size: 3000,
                url: 'https://blob.url/resume1',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch to return resume without status
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ companyName: 'Example Corp' }), // No applicationStatus
      } as Response);

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resumeGenerations.byStatus.draft).toBe(1); // Defaults to 'draft'
    });

    it('calculates traffic source percentages correctly', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('audit/')) {
          return {
            blobs: [
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv1',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-01-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv2',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-02-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv3',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-03-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv4',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch: 2 linkedin, 1 twitter, 1 direct
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('pv1') || urlStr.includes('pv2')) {
          return {
            ok: true,
            json: async () => ({
              eventType: 'page_view',
              metadata: {
                trafficSource: { source: 'linkedin', medium: 'social' },
              },
            }),
          } as Response;
        } else if (urlStr.includes('pv3')) {
          return {
            ok: true,
            json: async () => ({
              eventType: 'page_view',
              metadata: {
                trafficSource: { source: 'twitter', medium: 'social' },
              },
            }),
          } as Response;
        } else {
          // pv4 - no traffic source (defaults to 'direct')
          return {
            ok: true,
            json: async () => ({
              eventType: 'page_view',
              metadata: {},
            }),
          } as Response;
        }
      });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.traffic.topSources).toEqual(
        expect.arrayContaining([
          { source: 'linkedin', count: 2, percentage: 50 },
          { source: 'direct', count: 1, percentage: 25 },
          { source: 'twitter', count: 1, percentage: 25 },
        ])
      );
      expect(data.traffic.topSources).toHaveLength(3); // Top 3 sources
    });

    it('limits top sources to 3', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('audit/')) {
          return {
            blobs: [
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv1',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-01-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv2',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-02-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv3',
              },
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-03-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv4',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock 4 different sources
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const sources = ['linkedin', 'twitter', 'github', 'google'];
        const index = urlStr.includes('pv1')
          ? 0
          : urlStr.includes('pv2')
            ? 1
            : urlStr.includes('pv3')
              ? 2
              : 3;
        return {
          ok: true,
          json: async () => ({
            eventType: 'page_view',
            metadata: {
              trafficSource: { source: sources[index], medium: 'social' },
            },
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.traffic.topSources).toHaveLength(3); // Limited to top 3
    });
  });

  describe('GET - query parameters', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });
    });

    it('uses production environment by default', async () => {
      delete process.env.VERCEL_ENV;

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('production');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/production/'),
        })
      );
    });

    it('uses VERCEL_ENV when set', async () => {
      process.env.VERCEL_ENV = 'preview';

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('preview');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });

    it('accepts env query parameter', async () => {
      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats?env=development');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('development');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/development/'),
        })
      );
    });

    it('env query parameter overrides VERCEL_ENV', async () => {
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats?env=preview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('preview');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });
  });

  describe('GET - error handling', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('handles blob list errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob storage error'));

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get stats');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/stats] Error getting stats:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles fetch errors when getting resume status', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/resume-generations/production/resume1.json',
                size: 3000,
                url: 'https://blob.url/resume1',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch to fail
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      // Should still return 200 with partial data (resume byStatus might be empty)
      expect(response.status).toBe(200);
      expect(data.resumeGenerations.total).toBe(1);
    });

    it('handles fetch errors when getting traffic sources', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('audit/')) {
          return {
            blobs: [
              {
                pathname:
                  'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
                size: 500,
                url: 'https://blob.url/pv1',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch to fail
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      // Should still return 200 with empty traffic sources
      expect(response.status).toBe(200);
      expect(data.traffic.topSources).toEqual([]);
    });

    it('handles non-ok fetch responses gracefully', async () => {
      mockList.mockImplementation(async ({ prefix }) => {
        if (prefix.includes('resume-generations/')) {
          return {
            blobs: [
              {
                pathname: 'damilola.tech/resume-generations/production/resume1.json',
                size: 3000,
                url: 'https://blob.url/resume1',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      // Mock fetch to return 404
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const { GET } = await import('@/app/api/admin/stats/route');

      const request = new Request('http://localhost/api/admin/stats');
      const response = await GET(request);
      const data = await response.json();

      // Should still return 200 with partial data
      expect(response.status).toBe(200);
      expect(data.resumeGenerations.total).toBe(1);
    });
  });
});
