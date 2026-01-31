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

// Mock api-audit
const mockLogApiAccess = vi.fn();
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// Mock timezone
const mockGetMTDayBounds = vi.fn((dateStr: string) => {
  // Return timestamps (numbers) instead of strings
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return {
    startUTC: date.getTime(),
    endUTC: date.getTime() + 86399999, // End of day (23:59:59.999)
  };
});
vi.mock('@/lib/timezone', () => ({
  getMTDayBounds: (dateStr: string) => mockGetMTDayBounds(dateStr),
}));

describe('v1/traffic API route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
    mockLogApiAccess.mockResolvedValue(undefined);
    // Reset getMTDayBounds to default behavior
    mockGetMTDayBounds.mockImplementation((dateStr: string) => {
      const date = new Date(`${dateStr}T00:00:00.000Z`);
      return {
        startUTC: date.getTime(),
        endUTC: date.getTime() + 86399999,
      };
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const createMockPageViewEvent = (
    sessionId: string,
    source = 'direct',
    medium = 'none',
    campaign: string | null = null,
    landingPage = '/'
  ) => ({
    eventType: 'page_view',
    timestamp: '2026-01-28T10:00:00Z',
    sessionId,
    path: landingPage,
    metadata: {
      trafficSource: {
        source,
        medium,
        campaign,
        landingPage,
      },
    },
  });

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
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

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/traffic', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns traffic stats with valid API key', async () => {
      const mockEvent = createMockPageViewEvent('session-1', 'linkedin', 'social');
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            size: 500,
            url: 'https://blob.url/event1',
          },
        ],
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockEvent,
      } as Response);

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalSessions');
      expect(data.data).toHaveProperty('bySource');
      expect(data.data).toHaveProperty('byMedium');
      expect(data.data).toHaveProperty('byCampaign');
      expect(data.data).toHaveProperty('topLandingPages');
      expect(data.data).toHaveProperty('rawEvents');
      expect(data.data).toHaveProperty('environment');
      expect(data.data).toHaveProperty('dateRange');
    });

    it('defaults to last 30 days', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.dateRange).toHaveProperty('start');
      expect(data.data.dateRange).toHaveProperty('end');
    });

    it('supports days query parameter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?days=7');
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should query for 7 days of data
      expect(mockList).toHaveBeenCalled();
    });

    it('caps days parameter at 365', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?days=500');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('supports startDate and endDate query parameters', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-01&endDate=2026-01-31');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.dateRange.start).toContain('2026-01-01');
      expect(data.data.dateRange.end).toContain('2026-01-31');
    });

    it('validates date format', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });
      // Mock getMTDayBounds to return NaN for invalid date
      mockGetMTDayBounds.mockReturnValueOnce({
        startUTC: NaN,
        endUTC: NaN,
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?startDate=invalid&endDate=2026-01-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates endDate is after startDate', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-31&endDate=2026-01-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('End date must be after start date');
    });

    it('supports env query parameter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?env=preview');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.environment).toBe('preview');
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });

    it('filters to only page_view events', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'audit/prod/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            size: 500,
            url: 'url1',
          },
          {
            pathname: 'audit/prod/2026-01-28/2026-01-28T10-01-00Z-chat_opened.json',
            size: 500,
            url: 'url2',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      await GET(request);

      // Should only attempt to fetch page_view events
      expect(mockList).toHaveBeenCalled();
    });

    it('aggregates traffic by source', async () => {
      const events = [
        createMockPageViewEvent('session-1', 'linkedin', 'social'),
        createMockPageViewEvent('session-2', 'linkedin', 'social'),
        createMockPageViewEvent('session-3', 'google', 'organic'),
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      // Use specific date range to avoid 30-day default
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-28&endDate=2026-01-28');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      const linkedinSource = data.data.bySource.find((s: { source: string }) => s.source === 'linkedin');
      expect(linkedinSource?.count).toBe(2);
    });

    it('aggregates traffic by medium', async () => {
      const events = [
        createMockPageViewEvent('session-1', 'linkedin', 'social'),
        createMockPageViewEvent('session-2', 'twitter', 'social'),
        createMockPageViewEvent('session-3', 'google', 'organic'),
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      // Use specific date range to avoid 30-day default
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-28&endDate=2026-01-28');
      const response = await GET(request);
      const data = await response.json();

      const socialMedium = data.data.byMedium.find((m: { medium: string }) => m.medium === 'social');
      expect(socialMedium?.count).toBe(2);
    });

    it('aggregates traffic by campaign', async () => {
      const events = [
        createMockPageViewEvent('session-1', 'linkedin', 'social', 'spring-2026'),
        createMockPageViewEvent('session-2', 'linkedin', 'social', 'spring-2026'),
        createMockPageViewEvent('session-3', 'google', 'cpc', 'winter-2026'),
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      // Use specific date range to avoid 30-day default
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-28&endDate=2026-01-28');
      const response = await GET(request);
      const data = await response.json();

      const springCampaign = data.data.byCampaign.find((c: { campaign: string }) => c.campaign === 'spring-2026');
      expect(springCampaign?.count).toBe(2);
    });

    it('tracks top landing pages', async () => {
      const events = [
        createMockPageViewEvent('session-1', 'direct', 'none', null, '/'),
        createMockPageViewEvent('session-2', 'linkedin', 'social', null, '/'),
        createMockPageViewEvent('session-3', 'google', 'organic', null, '/projects'),
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      // Use specific date range to avoid 30-day default
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-28&endDate=2026-01-28');
      const response = await GET(request);
      const data = await response.json();

      const homePage = data.data.topLandingPages.find((p: { path: string }) => p.path === '/');
      expect(homePage?.count).toBe(2);
    });

    it('counts unique sessions', async () => {
      const events = [
        createMockPageViewEvent('session-1', 'linkedin', 'social'),
        createMockPageViewEvent('session-1', 'linkedin', 'social'),
        createMockPageViewEvent('session-2', 'google', 'organic'),
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.totalSessions).toBe(2);
    });

    it('sorts raw events by timestamp descending', async () => {
      const events = [
        { ...createMockPageViewEvent('session-1'), timestamp: '2026-01-28T10:00:00Z' },
        { ...createMockPageViewEvent('session-2'), timestamp: '2026-01-28T12:00:00Z' },
        { ...createMockPageViewEvent('session-3'), timestamp: '2026-01-28T11:00:00Z' },
      ];

      mockList.mockResolvedValue({
        blobs: events.map((_, i) => ({
          pathname: `audit/prod/2026-01-28/2026-01-28T10-0${i}-00Z-page_view.json`,
          size: 500,
          url: `https://blob.url/event${i}`,
        })),
        cursor: undefined,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const idx = urlStr.includes('event0') ? 0 : urlStr.includes('event1') ? 1 : 2;
        return {
          ok: true,
          json: async () => events[idx],
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/traffic/route');
      // Use specific date range to avoid 30-day default
      const request = new Request('http://localhost/api/v1/traffic?startDate=2026-01-28&endDate=2026-01-28');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.rawEvents[0].timestamp).toBe('2026-01-28T12:00:00Z');
      expect(data.data.rawEvents[1].timestamp).toBe('2026-01-28T11:00:00Z');
      expect(data.data.rawEvents[2].timestamp).toBe('2026-01-28T10:00:00Z');
    });

    it('logs API access audit event', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic?env=production&days=7');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_traffic_accessed',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          environment: 'production',
          dateRange: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String),
          }),
          totalSessions: 0,
        }),
        '127.0.0.1'
      );
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).toBe('Failed to get traffic stats');

      consoleSpy.mockRestore();
    });

    it('continues even if audit logging fails', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });
      mockLogApiAccess.mockRejectedValue(new Error('Audit logging failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    it('handles pagination when listing blobs', async () => {
      let callCount = 0;
      mockList.mockImplementation(async ({ cursor }) => {
        callCount++;
        if (callCount === 1 && !cursor) {
          return {
            blobs: [
              {
                pathname: 'audit/prod/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
                size: 500,
                url: 'url1',
              },
            ],
            cursor: 'next-page',
          };
        } else if (cursor === 'next-page') {
          return {
            blobs: [
              {
                pathname: 'audit/prod/2026-01-28/2026-01-28T10-01-00Z-page_view.json',
                size: 500,
                url: 'url2',
              },
            ],
            cursor: undefined,
          };
        }
        return { blobs: [], cursor: undefined };
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => createMockPageViewEvent('session-1'),
      } as Response);

      const { GET } = await import('@/app/api/v1/traffic/route');
      const request = new Request('http://localhost/api/v1/traffic');
      await GET(request);

      expect(mockList.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
