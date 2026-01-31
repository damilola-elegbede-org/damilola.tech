/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock usage-logger
const mockGetAggregatedStats = vi.fn();
const mockListSessions = vi.fn();
vi.mock('@/lib/usage-logger', () => ({
  getAggregatedStats: (...args: unknown[]) => mockGetAggregatedStats(...args),
  listSessions: (...args: unknown[]) => mockListSessions(...args),
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

describe('v1/usage API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Reset the mock to return resolved promise by default
    mockLogApiAccess.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const mockStats = {
    totalRequests: 10,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCacheReadTokens: 200,
    totalEstimatedCostUsd: 0.05,
  };

  const mockSessions = [
    {
      sessionId: 'session-1',
      totals: {
        requestCount: 5,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 100,
        estimatedCostUsd: 0.025,
      },
      lastUpdatedAt: '2026-01-28T10:30:00Z',
    },
    {
      sessionId: 'session-2',
      totals: {
        requestCount: 5,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 100,
        estimatedCostUsd: 0.025,
      },
      lastUpdatedAt: '2026-01-28T11:00:00Z',
    },
  ];

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
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

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/usage', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
      mockGetAggregatedStats.mockResolvedValue(mockStats);
      mockListSessions.mockResolvedValue(mockSessions);
    });

    it('returns usage stats with valid API key', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalRequests', 10);
      expect(data.data).toHaveProperty('totalInputTokens', 1000);
      expect(data.data).toHaveProperty('totalOutputTokens', 500);
      expect(data.data).toHaveProperty('totalCacheReadTokens', 200);
      expect(data.data).toHaveProperty('totalEstimatedCostUsd', 0.05);
      expect(data.data).toHaveProperty('sessions');
      expect(data.data.sessions).toHaveLength(2);
    });

    it('includes environment in response', async () => {
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.environment).toBe('production');
    });

    it('includes date range in response', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?startDate=2026-01-01&endDate=2026-01-31');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.dateRange).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });
    });

    it('supports startDate query parameter', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?startDate=2026-01-01');
      await GET(request);

      expect(mockGetAggregatedStats).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2026-01-01',
        })
      );
      expect(mockListSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2026-01-01',
        })
      );
    });

    it('supports endDate query parameter', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?endDate=2026-01-31');
      await GET(request);

      expect(mockGetAggregatedStats).toHaveBeenCalledWith(
        expect.objectContaining({
          endDate: '2026-01-31',
        })
      );
      expect(mockListSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          endDate: '2026-01-31',
        })
      );
    });

    it('supports both startDate and endDate query parameters', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?startDate=2026-01-01&endDate=2026-01-31');
      await GET(request);

      expect(mockGetAggregatedStats).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        })
      );
      expect(mockListSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 500,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        })
      );
    });

    it('validates startDate format', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?startDate=invalid-date');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Invalid startDate format');
    });

    it('validates endDate format', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?endDate=20260131');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Invalid endDate format');
    });

    it('formats session data correctly', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.sessions[0]).toEqual({
        sessionId: 'session-1',
        requestCount: 5,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 100,
        costUsd: 0.025,
        lastUpdatedAt: '2026-01-28T10:30:00Z',
      });
    });

    it('calls listSessions with limit 500', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      await GET(request);

      expect(mockListSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 500,
        })
      );
    });

    it('logs API access audit event', async () => {
      process.env.VERCEL_ENV = 'production';

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage?startDate=2026-01-01&endDate=2026-01-31');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_usage_accessed',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          environment: 'production',
          dateRange: { start: '2026-01-01', end: '2026-01-31' },
          sessionCount: 2,
        }),
        '127.0.0.1'
      );
    });

    it('logs audit event with null dates when not provided', async () => {
      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_usage_accessed',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          dateRange: { start: null, end: null },
        }),
        '127.0.0.1'
      );
    });

    it('handles errors gracefully', async () => {
      mockGetAggregatedStats.mockRejectedValue(new Error('Database error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).toBe('Failed to get usage stats');

      consoleSpy.mockRestore();
    });

    it('continues even if audit logging fails', async () => {
      mockLogApiAccess.mockRejectedValue(new Error('Audit logging failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/usage/route');
      const request = new Request('http://localhost/api/v1/usage');
      const response = await GET(request);
      const data = await response.json();

      // Should still succeed even if audit logging fails
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      consoleWarnSpy.mockRestore();
    });
  });
});
