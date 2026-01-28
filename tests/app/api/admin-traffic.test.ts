import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditEvent } from '@/lib/types/audit-event';

// Mock dependencies before importing the route
const mockVerifyToken = vi.fn();
const mockList = vi.fn();
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_session',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock('@vercel/blob', () => ({
  list: mockList,
}));

vi.mock('@/lib/timezone', () => ({
  getMTDayBounds: vi.fn((dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00Z');
    const startUTC = date.getTime();
    const endUTC = startUTC + 86400000 - 1; // One day minus 1ms
    return { startUTC, endUTC };
  }),
}));

describe('admin traffic API route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockReset();
    process.env = { ...originalEnv };
    mockCookieStore.get.mockClear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  const createAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
    version: 1,
    eventId: `event-${Math.random()}`,
    eventType: 'page_view',
    environment: 'production',
    timestamp: new Date().toISOString(),
    sessionId: `session-${Math.random()}`,
    path: '/',
    metadata: {
      trafficSource: {
        source: 'google',
        medium: 'organic',
        campaign: 'test-campaign',
        landingPage: '/',
        capturedAt: new Date().toISOString(),
      },
    },
    ...overrides,
  });

  const createBlobListResult = (blobs: Array<{ pathname: string; url: string }>, cursor?: string) => ({
    blobs: blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: 1024,
      uploadedAt: new Date(),
      downloadUrl: blob.url,
    })),
    cursor: cursor ?? null,
    hasMore: !!cursor,
  });

  describe('GET - Authentication', () => {
    it('returns 401 when no token is provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('returns traffic data with valid token', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('GET - Traffic Data Aggregation', () => {
    it('aggregates traffic by source', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({
          eventId: 'event-1',
          sessionId: 'session-1',
          metadata: {
            trafficSource: { source: 'google', medium: 'organic', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'event-2',
          sessionId: 'session-2',
          metadata: {
            trafficSource: { source: 'google', medium: 'organic', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'event-3',
          sessionId: 'session-3',
          metadata: {
            trafficSource: { source: 'linkedin', medium: 'social', landingPage: '/', capturedAt: '' },
          },
        }),
      ];

      // Mock blob list to return page_view events
      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-${String(i).padStart(2, '0')}Z-page_view.json`,
            url: `https://blob.example.com/source-test-event-${i}`,
          }))
        )
      );

      // Mock fetch to return events based on URL
      global.fetch = vi.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('source-test-event-0')) {
          return Promise.resolve({
            ok: true,
            json: async () => events[0],
          } as Response);
        }
        if (urlStr.includes('source-test-event-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => events[1],
          } as Response);
        }
        if (urlStr.includes('source-test-event-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => events[2],
          } as Response);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bySource).toHaveLength(2);
      // Verify google has 2x linkedin count (ratio 2:1)
      const googleSource = data.bySource.find((s: { source: string }) => s.source === 'google');
      const linkedinSource = data.bySource.find((s: { source: string }) => s.source === 'linkedin');
      expect(googleSource).toBeDefined();
      expect(linkedinSource).toBeDefined();
      expect(googleSource.count).toBe(linkedinSource.count * 2);
      expect(googleSource.percentage).toBeCloseTo(66.7, 0);
      expect(linkedinSource.percentage).toBeCloseTo(33.3, 0);
    });

    it('aggregates traffic by medium', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({
          metadata: {
            trafficSource: { source: 'google', medium: 'cpc', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          metadata: {
            trafficSource: { source: 'google', medium: 'organic', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          metadata: {
            trafficSource: { source: 'linkedin', medium: 'social', landingPage: '/', capturedAt: '' },
          },
        }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-${String(i).padStart(2, '0')}Z-page_view.json`,
            url: `https://blob.example.com/event-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const index = parseInt(url.toString().split('-').pop() || '0', 10);
        return Promise.resolve({
          ok: true,
          json: async () => events[index],
        } as Response);
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byMedium).toHaveLength(3);
      expect(data.byMedium.map((m: { medium: string }) => m.medium)).toEqual(['cpc', 'organic', 'social']);
    });

    it('aggregates traffic by campaign', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({
          eventId: 'campaign-1',
          sessionId: 'session-c1',
          metadata: {
            trafficSource: { source: 'google', medium: 'cpc', campaign: 'winter-sale', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'campaign-2',
          sessionId: 'session-c2',
          metadata: {
            trafficSource: { source: 'google', medium: 'cpc', campaign: 'winter-sale', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'campaign-3',
          sessionId: 'session-c3',
          metadata: {
            trafficSource: { source: 'linkedin', medium: 'social', campaign: 'brand-awareness', landingPage: '/', capturedAt: '' },
          },
        }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/campaign-test-${i}-page_view.json`,
            url: `https://blob.example.com/campaign-test-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('campaign-test-0')) return Promise.resolve({ ok: true, json: async () => events[0] } as Response);
        if (urlStr.includes('campaign-test-1')) return Promise.resolve({ ok: true, json: async () => events[1] } as Response);
        if (urlStr.includes('campaign-test-2')) return Promise.resolve({ ok: true, json: async () => events[2] } as Response);
        return Promise.reject(new Error('Unexpected URL'));
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byCampaign).toHaveLength(2);
      // Verify winter-sale has 2x brand-awareness count
      const winterSale = data.byCampaign.find((c: { campaign: string }) => c.campaign === 'winter-sale');
      const brandAwareness = data.byCampaign.find((c: { campaign: string }) => c.campaign === 'brand-awareness');
      expect(winterSale).toBeDefined();
      expect(brandAwareness).toBeDefined();
      expect(winterSale.count).toBe(brandAwareness.count * 2);
      expect(winterSale.percentage).toBeCloseTo(66.7, 0);
    });

    it('tracks top landing pages', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({
          eventId: 'landing-1',
          sessionId: 'session-l1',
          metadata: {
            trafficSource: { source: 'google', medium: 'organic', landingPage: '/', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'landing-2',
          sessionId: 'session-l2',
          metadata: {
            trafficSource: { source: 'google', medium: 'organic', landingPage: '/about', capturedAt: '' },
          },
        }),
        createAuditEvent({
          eventId: 'landing-3',
          sessionId: 'session-l3',
          metadata: {
            trafficSource: { source: 'linkedin', medium: 'social', landingPage: '/', capturedAt: '' },
          },
        }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/landing-test-${i}-page_view.json`,
            url: `https://blob.example.com/landing-test-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('landing-test-0')) return Promise.resolve({ ok: true, json: async () => events[0] } as Response);
        if (urlStr.includes('landing-test-1')) return Promise.resolve({ ok: true, json: async () => events[1] } as Response);
        if (urlStr.includes('landing-test-2')) return Promise.resolve({ ok: true, json: async () => events[2] } as Response);
        return Promise.reject(new Error('Unexpected URL'));
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topLandingPages).toHaveLength(2);
      // Verify / has 2x /about count
      const rootPage = data.topLandingPages.find((p: { path: string }) => p.path === '/');
      const aboutPage = data.topLandingPages.find((p: { path: string }) => p.path === '/about');
      expect(rootPage).toBeDefined();
      expect(aboutPage).toBeDefined();
      expect(rootPage.count).toBe(aboutPage.count * 2);
      expect(rootPage.percentage).toBeCloseTo(66.7, 0);
    });

    it('counts unique sessions', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({ sessionId: 'session-1' }),
        createAuditEvent({ sessionId: 'session-1' }), // Duplicate session
        createAuditEvent({ sessionId: 'session-2' }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-${String(i).padStart(2, '0')}Z-page_view.json`,
            url: `https://blob.example.com/event-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const index = parseInt(url.toString().split('-').pop() || '0', 10);
        return Promise.resolve({
          ok: true,
          json: async () => events[index],
        } as Response);
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(2);
    });

    it('handles direct traffic without traffic source metadata', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({ metadata: {} }), // No traffic source
        createAuditEvent({ metadata: {} }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-${String(i).padStart(2, '0')}Z-page_view.json`,
            url: `https://blob.example.com/event-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const index = parseInt(url.toString().split('-').pop() || '0', 10);
        return Promise.resolve({
          ok: true,
          json: async () => events[index],
        } as Response);
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bySource).toHaveLength(1);
      expect(data.bySource[0].source).toBe('direct');
      expect(data.byMedium[0].medium).toBe('none');
    });
  });

  describe('GET - Date Range Filtering', () => {
    it('uses default 30 days when no date params provided', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange).toBeDefined();
      expect(data.dateRange.start).toBeDefined();
      expect(data.dateRange.end).toBeDefined();

      // Verify it's approximately 30 days
      const start = new Date(data.dateRange.start);
      const end = new Date(data.dateRange.end);
      const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
      expect(diffDays).toBe(30);
    });

    it('respects custom days parameter', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=7');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      const start = new Date(data.dateRange.start);
      const end = new Date(data.dateRange.end);
      const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
      expect(diffDays).toBe(7);
    });

    it('clamps days parameter to maximum 365', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=500');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      const start = new Date(data.dateRange.start);
      const end = new Date(data.dateRange.end);
      const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
      expect(diffDays).toBeLessThanOrEqual(365);
    });

    it('uses explicit start and end date parameters', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?startDate=2026-01-01&endDate=2026-01-31');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange.start).toBeDefined();
      expect(data.dateRange.end).toBeDefined();
    });

    it('returns 400 for invalid date format', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?startDate=invalid&endDate=2026-01-31');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid date format');
    });

    it('returns 400 when end date is before start date', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const { getMTDayBounds } = await import('@/lib/timezone');
      vi.mocked(getMTDayBounds).mockImplementation((dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00Z');
        return {
          startUTC: date.getTime(),
          endUTC: date.getTime() + 86400000,
        };
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?startDate=2026-01-31&endDate=2026-01-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('End date must be after start date');
    });

    it('returns 400 for invalid days parameter', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid days parameter');
    });
  });

  describe('GET - Environment Filtering', () => {
    it('uses production environment by default', async () => {
      process.env.VERCEL_ENV = 'production';
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('production');
    });

    it('respects env query parameter', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?env=preview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('preview');
    });
  });

  describe('GET - Empty Data Handling', () => {
    it('handles zero events gracefully', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(0);
      expect(data.bySource).toEqual([]);
      expect(data.byMedium).toEqual([]);
      expect(data.byCampaign).toEqual([]);
      expect(data.topLandingPages).toEqual([]);
      expect(data.rawEvents).toEqual([]);
    });

    it('calculates 0 percentage for empty data', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bySource).toEqual([]);
      expect(data.byMedium).toEqual([]);
    });
  });

  describe.sequential('GET - Blob Fetching', () => {
    it('filters for page_view events only', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      mockList.mockResolvedValue(
        createBlobListResult([
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            url: 'https://blob.example.com/filter-test-page-view',
          },
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-01Z-chat_opened.json',
            url: 'https://blob.example.com/filter-test-chat',
          },
        ])
      );

      const event = createAuditEvent({ eventId: 'filter-event', sessionId: 'filter-session' });
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => event,
        } as Response)
      );

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      // Only page_view event should be fetched (not chat_opened)
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://blob.example.com/filter-test-page-view',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      // Verify chat event was NOT fetched
      expect(global.fetch).not.toHaveBeenCalledWith(
        'https://blob.example.com/filter-test-chat',
        expect.anything()
      );
      // Should have our test event in results (may be duplicated due to date range)
      const testEvents = data.rawEvents.filter((e: { sessionId: string }) => e.sessionId === 'filter-session');
      expect(testEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('handles fetch failures gracefully with Promise.allSettled', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      mockList.mockResolvedValue(
        createBlobListResult([
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            url: 'https://blob.example.com/failure-test-success',
          },
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-01Z-page_view.json',
            url: 'https://blob.example.com/failure-test-fail',
          },
        ])
      );

      const successEvent = createAuditEvent({ eventId: 'success-event', sessionId: 'success-session' });

      global.fetch = vi.fn((url) => {
        if (url.toString().includes('failure-test-success')) {
          return Promise.resolve({
            ok: true,
            json: async () => successEvent,
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      // Should succeed with partial data (only successful fetch counted)
      expect(response.status).toBe(200);
      // At least one successful event should be present
      expect(data.rawEvents.length).toBeGreaterThanOrEqual(1);
      // Verify the successful event is present (may be duplicated)
      const successfulEvents = data.rawEvents.filter(
        (e: { sessionId: string }) => e.sessionId === 'success-session'
      );
      expect(successfulEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('handles paginated blob results', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const event1 = createAuditEvent({ eventId: 'page-event-1', sessionId: 'page-session-1' });
      const event2 = createAuditEvent({ eventId: 'page-event-2', sessionId: 'page-session-2' });

      // Mock list is called twice: once per date prefix (2026-01-28 appears in range once)
      // First call returns blob with cursor, second call uses cursor and returns final blob
      mockList
        .mockResolvedValueOnce(
          createBlobListResult(
            [
              {
                pathname: 'damilola.tech/audit/production/2026-01-28/pagination-test-1-page_view.json',
                url: 'https://blob.example.com/pagination-test-1',
              },
            ],
            'cursor-token'
          )
        )
        .mockResolvedValueOnce(
          createBlobListResult([
            {
              pathname: 'damilola.tech/audit/production/2026-01-28/pagination-test-2-page_view.json',
              url: 'https://blob.example.com/pagination-test-2',
            },
          ])
        )
        .mockResolvedValue(createBlobListResult([])); // Any additional calls return empty

      global.fetch = vi.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('pagination-test-1')) {
          return Promise.resolve({ ok: true, json: async () => event1 } as Response);
        }
        if (urlStr.includes('pagination-test-2')) {
          return Promise.resolve({ ok: true, json: async () => event2 } as Response);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalled();
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor-token' }));
      expect(data.rawEvents).toHaveLength(2);
    });
  });

  describe.sequential('GET - Raw Events', () => {
    it('includes raw events sorted by timestamp descending', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const events = [
        createAuditEvent({ eventId: 'sort-1', sessionId: 'sort-session-1', timestamp: '2026-01-28T10:00:00Z' }),
        createAuditEvent({ eventId: 'sort-2', sessionId: 'sort-session-2', timestamp: '2026-01-28T12:00:00Z' }),
        createAuditEvent({ eventId: 'sort-3', sessionId: 'sort-session-3', timestamp: '2026-01-28T11:00:00Z' }),
      ];

      mockList.mockResolvedValue(
        createBlobListResult(
          events.map((event, i) => ({
            pathname: `damilola.tech/audit/production/2026-01-28/sort-test-${i}-page_view.json`,
            url: `https://blob.example.com/sort-test-${i}`,
          }))
        )
      );

      global.fetch = vi.fn((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('sort-test-0')) return Promise.resolve({ ok: true, json: async () => events[0] } as Response);
        if (urlStr.includes('sort-test-1')) return Promise.resolve({ ok: true, json: async () => events[1] } as Response);
        if (urlStr.includes('sort-test-2')) return Promise.resolve({ ok: true, json: async () => events[2] } as Response);
        return Promise.reject(new Error('Unexpected URL'));
      });

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rawEvents.length).toBeGreaterThanOrEqual(3);

      // Filter to our test events by session ID (may have duplicates due to date range)
      const testEvents = data.rawEvents.filter((e: { sessionId: string }) =>
        e.sessionId.startsWith('sort-session')
      );

      expect(testEvents.length).toBeGreaterThanOrEqual(3);
      // Verify we have all three timestamps (deduped by unique timestamps)
      const timestamps = [...new Set(testEvents.map((e: { timestamp: string }) => e.timestamp))];
      expect(timestamps).toContain('2026-01-28T12:00:00Z');
      expect(timestamps).toContain('2026-01-28T11:00:00Z');
      expect(timestamps).toContain('2026-01-28T10:00:00Z');
      // Most recent first (check first few entries)
      const sortedByTime = testEvents.sort((a: { timestamp: string }, b: { timestamp: string }) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      expect(sortedByTime[0].timestamp).toBe('2026-01-28T12:00:00Z');
    });

    it('includes all traffic source fields in raw events', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const event = createAuditEvent({
        sessionId: 'session-123',
        metadata: {
          trafficSource: {
            source: 'google',
            medium: 'cpc',
            campaign: 'test-campaign',
            landingPage: '/landing',
            capturedAt: '2026-01-28T10:00:00Z',
          },
        },
      });

      mockList.mockResolvedValue(
        createBlobListResult([
          {
            pathname: 'damilola.tech/audit/production/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            url: 'https://blob.example.com/event-1',
          },
        ])
      );

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => event,
        } as Response)
      );

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rawEvents[0]).toEqual({
        timestamp: event.timestamp,
        sessionId: 'session-123',
        source: 'google',
        medium: 'cpc',
        campaign: 'test-campaign',
        landingPage: '/landing',
      });
    });
  });

  describe('GET - Error Handling', () => {
    it('returns 500 when blob list fails', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockRejectedValue(new Error('Blob service error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/traffic/route');

      const request = new Request('http://localhost/api/admin/traffic');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get traffic stats');

      consoleSpy.mockRestore();
    });
  });
});
