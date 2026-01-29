import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock('@/lib/admin-auth', () => ({
  verifyToken: vi.fn(),
  ADMIN_COOKIE_NAME: 'admin_session',
}));

vi.mock('@/lib/usage-logger', () => ({
  getAggregatedStats: vi.fn(),
  listSessions: vi.fn(),
}));

describe('admin usage API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieStore.get.mockClear();
  });

  describe('GET - returns usage stats', () => {
    it('returns usage stats with valid auth', async () => {
      const { verifyToken, ADMIN_COOKIE_NAME } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const mockStats = {
        totalSessions: 5,
        totalRequests: 23,
        totalInputTokens: 45000,
        totalOutputTokens: 12000,
        totalCacheCreationTokens: 8000,
        totalCacheReadTokens: 32000,
        totalCostUsd: 1.234567,
        cacheHitRate: 68.5,
        costSavingsUsd: 0.876543,
        byEndpoint: {
          chat: {
            requestCount: 15,
            inputTokens: 30000,
            outputTokens: 8000,
            costUsd: 0.789012,
          },
          'fit-assessment': {
            requestCount: 8,
            inputTokens: 15000,
            outputTokens: 4000,
            costUsd: 0.445555,
          },
        },
        recentSessions: [
          {
            sessionId: 'session-123',
            lastUpdatedAt: '2026-01-28T12:00:00Z',
            requestCount: 10,
            costUsd: 0.567890,
          },
        ],
      };

      const mockSessions = [
        {
          sessionId: 'session-123',
          createdAt: '2026-01-28T10:00:00Z',
          lastUpdatedAt: '2026-01-28T12:00:00Z',
          requests: [],
          totals: {
            requestCount: 10,
            inputTokens: 20000,
            outputTokens: 5000,
            cacheCreationTokens: 3000,
            cacheReadTokens: 15000,
            estimatedCostUsd: 0.567890,
          },
        },
        {
          sessionId: 'session-456',
          createdAt: '2026-01-27T14:00:00Z',
          lastUpdatedAt: '2026-01-27T16:00:00Z',
          requests: [],
          totals: {
            requestCount: 5,
            inputTokens: 10000,
            outputTokens: 2500,
            cacheCreationTokens: 2000,
            cacheReadTokens: 8000,
            estimatedCostUsd: 0.234567,
          },
        },
      ];

      vi.mocked(getAggregatedStats).mockResolvedValue(mockStats);
      vi.mocked(listSessions).mockResolvedValue(mockSessions);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(5);
      expect(data.totalRequests).toBe(23);
      expect(data.totalCostUsd).toBe(1.234567);
      expect(data.cacheHitRate).toBe(68.5);
      expect(data.byEndpoint).toEqual(mockStats.byEndpoint);
      expect(data.environment).toBeDefined();
      expect(data.dateRange).toEqual({ start: null, end: null });

      // Verify sessions table data
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0]).toEqual({
        sessionId: 'session-123',
        requestCount: 10,
        inputTokens: 20000,
        outputTokens: 5000,
        cacheReadTokens: 15000,
        costUsd: 0.567890,
        lastUpdatedAt: '2026-01-28T12:00:00Z',
      });

      // Verify auth check
      expect(mockCookieStore.get).toHaveBeenCalledWith(ADMIN_COOKIE_NAME);
      expect(verifyToken).toHaveBeenCalledWith('valid-token');

      // Verify usage logger calls
      expect(getAggregatedStats).toHaveBeenCalledWith({});
      expect(listSessions).toHaveBeenCalledWith({ limit: 500 });
    });

    it('returns usage stats with date range filters', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const mockStats = {
        totalSessions: 2,
        totalRequests: 10,
        totalInputTokens: 20000,
        totalOutputTokens: 5000,
        totalCacheCreationTokens: 3000,
        totalCacheReadTokens: 15000,
        totalCostUsd: 0.567890,
        cacheHitRate: 75.0,
        costSavingsUsd: 0.405000,
        byEndpoint: {},
        recentSessions: [],
      };

      vi.mocked(getAggregatedStats).mockResolvedValue(mockStats);
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request(
        'http://localhost/api/admin/usage?startDate=2026-01-01&endDate=2026-01-31'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(2);
      expect(data.dateRange).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });

      // Verify date range was passed to usage logger
      expect(getAggregatedStats).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
      expect(listSessions).toHaveBeenCalledWith({
        limit: 500,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
    });

    it('returns usage stats with only startDate', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(getAggregatedStats).mockResolvedValue({
        totalSessions: 1,
        totalRequests: 5,
        totalInputTokens: 10000,
        totalOutputTokens: 2500,
        totalCacheCreationTokens: 1500,
        totalCacheReadTokens: 7500,
        totalCostUsd: 0.234567,
        cacheHitRate: 75.0,
        costSavingsUsd: 0.202500,
        byEndpoint: {},
        recentSessions: [],
      });
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage?startDate=2026-01-15');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange).toEqual({
        start: '2026-01-15',
        end: null,
      });

      expect(getAggregatedStats).toHaveBeenCalledWith({
        startDate: '2026-01-15',
        endDate: undefined,
      });
    });

    it('includes environment in response', async () => {
      const originalEnv = process.env.VERCEL_ENV;
      process.env.VERCEL_ENV = 'production';

      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(getAggregatedStats).mockResolvedValue({
        totalSessions: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalCostUsd: 0,
        cacheHitRate: 0,
        costSavingsUsd: 0,
        byEndpoint: {},
        recentSessions: [],
      });
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('production');

      process.env.VERCEL_ENV = originalEnv;
    });

    it('defaults environment to development when not set', async () => {
      const originalEnv = process.env.VERCEL_ENV;
      delete process.env.VERCEL_ENV;

      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(getAggregatedStats).mockResolvedValue({
        totalSessions: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalCostUsd: 0,
        cacheHitRate: 0,
        costSavingsUsd: 0,
        byEndpoint: {},
        recentSessions: [],
      });
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('development');

      process.env.VERCEL_ENV = originalEnv;
    });
  });

  describe('GET - authentication', () => {
    it('returns 401 when no token provided', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');

      // Verify token was not verified
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      vi.mocked(verifyToken).mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');

      // Verify token was checked
      expect(verifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('returns 401 when cookie value is empty', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: '' });

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');

      // Verify token was not verified (empty string is falsy)
      expect(verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('GET - date validation', () => {
    it('returns 400 when startDate format is invalid', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage?startDate=2026-1-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid startDate format');
      expect(data.error).toContain('YYYY-MM-DD');
    });

    it('returns 400 when endDate format is invalid', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage?endDate=01/31/2026');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid endDate format');
      expect(data.error).toContain('YYYY-MM-DD');
    });

    it('returns 400 when both dates are invalid', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request(
        'http://localhost/api/admin/usage?startDate=invalid&endDate=also-invalid'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid startDate format');
    });

    it('accepts valid YYYY-MM-DD dates', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(getAggregatedStats).mockResolvedValue({
        totalSessions: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalCostUsd: 0,
        cacheHitRate: 0,
        costSavingsUsd: 0,
        byEndpoint: {},
        recentSessions: [],
      });
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request(
        'http://localhost/api/admin/usage?startDate=2026-01-01&endDate=2026-12-31'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('GET - empty data handling', () => {
    it('handles empty usage data gracefully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      const emptyStats = {
        totalSessions: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalCostUsd: 0,
        cacheHitRate: 0,
        costSavingsUsd: 0,
        byEndpoint: {},
        recentSessions: [],
      };

      vi.mocked(getAggregatedStats).mockResolvedValue(emptyStats);
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(0);
      expect(data.totalRequests).toBe(0);
      expect(data.totalCostUsd).toBe(0);
      expect(data.sessions).toEqual([]);
      expect(data.byEndpoint).toEqual({});
    });

    it('handles empty sessions list with non-zero stats', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats, listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      // Stats show data but sessions list is empty (edge case)
      const statsWithNoSessionDetails = {
        totalSessions: 5,
        totalRequests: 10,
        totalInputTokens: 5000,
        totalOutputTokens: 1000,
        totalCacheCreationTokens: 500,
        totalCacheReadTokens: 3000,
        totalCostUsd: 0.123456,
        cacheHitRate: 60.0,
        costSavingsUsd: 0.081000,
        byEndpoint: {
          chat: {
            requestCount: 10,
            inputTokens: 5000,
            outputTokens: 1000,
            costUsd: 0.123456,
          },
        },
        recentSessions: [],
      };

      vi.mocked(getAggregatedStats).mockResolvedValue(statsWithNoSessionDetails);
      vi.mocked(listSessions).mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalSessions).toBe(5);
      expect(data.sessions).toEqual([]);
    });
  });

  describe('GET - error handling', () => {
    it('returns 500 when getAggregatedStats fails', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { getAggregatedStats } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(getAggregatedStats).mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get usage stats');

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/usage] Error getting usage stats:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when listSessions fails', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { listSessions } = await import('@/lib/usage-logger');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);

      vi.mocked(listSessions).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/usage/route');

      const request = new Request('http://localhost/api/admin/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get usage stats');

      consoleSpy.mockRestore();
    });
  });
});
