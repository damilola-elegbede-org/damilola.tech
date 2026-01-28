import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers cookies
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock admin-auth module
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_token',
}));

// Mock admin-cache module
const mockReadAdminCache = vi.fn();
const mockWriteAdminCache = vi.fn();
vi.mock('@/lib/admin-cache', () => ({
  readAdminCache: mockReadAdminCache,
  writeAdminCache: mockWriteAdminCache,
  CACHE_KEYS: {
    DASHBOARD: 'dashboard',
    USAGE_7D: 'usage-7d',
    USAGE_30D: 'usage-30d',
    USAGE_90D: 'usage-90d',
    TRAFFIC_7D: 'traffic-7d',
    TRAFFIC_30D: 'traffic-30d',
    TRAFFIC_90D: 'traffic-90d',
  },
}));

describe('admin cache API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mocks
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    });
    mockVerifyToken.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/cache/[key]', () => {
    it('returns cached value with valid auth', async () => {
      const mockCachedData = {
        data: { totalMessages: 100, totalConversations: 50 },
        cachedAt: '2026-01-28T10:00:00Z',
        dateRange: {
          start: '2026-01-21T00:00:00Z',
          end: '2026-01-28T23:59:59Z',
        },
      };

      mockReadAdminCache.mockResolvedValue(mockCachedData);

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d');
      const response = await GET(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockCachedData);
      expect(mockReadAdminCache).toHaveBeenCalledWith('usage-7d');
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('returns 401 when no token provided', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d');
      const response = await GET(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockReadAdminCache).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d');
      const response = await GET(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockReadAdminCache).not.toHaveBeenCalled();
    });

    it('returns 404 when cache miss occurs', async () => {
      mockReadAdminCache.mockResolvedValue(null);

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d');
      const response = await GET(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Cache miss');
      expect(mockReadAdminCache).toHaveBeenCalledWith('usage-7d');
    });

    it('returns 400 for invalid cache key', async () => {
      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/invalid-key');
      const response = await GET(request, { params: Promise.resolve({ key: 'invalid-key' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid cache key');
      expect(mockReadAdminCache).not.toHaveBeenCalled();
    });

    it('returns 500 when cache read fails', async () => {
      mockReadAdminCache.mockRejectedValue(new Error('Blob read error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d');
      const response = await GET(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read cache');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/cache/usage-7d] Error reading cache:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('accepts all valid cache keys', async () => {
      const validKeys = [
        'dashboard',
        'usage-7d',
        'usage-30d',
        'usage-90d',
        'traffic-7d',
        'traffic-30d',
        'traffic-90d',
      ];

      for (const key of validKeys) {
        vi.clearAllMocks();
        vi.resetModules();

        mockCookies.mockResolvedValue({
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        });
        mockVerifyToken.mockResolvedValue(true);
        mockReadAdminCache.mockResolvedValue({
          data: { test: 'data' },
          cachedAt: '2026-01-28T10:00:00Z',
        });

        const { GET: GetHandler } = await import('@/app/api/admin/cache/[key]/route');

        const request = new Request(`http://localhost/api/admin/cache/${key}`);
        const response = await GetHandler(request, { params: Promise.resolve({ key }) });

        expect(response.status).toBe(200);
        expect(mockReadAdminCache).toHaveBeenCalledWith(key);
      }
    });

    it('returns cached data without dateRange', async () => {
      const mockCachedData = {
        data: { totalMessages: 100 },
        cachedAt: '2026-01-28T10:00:00Z',
      };

      mockReadAdminCache.mockResolvedValue(mockCachedData);

      const { GET } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/dashboard');
      const response = await GET(request, { params: Promise.resolve({ key: 'dashboard' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockCachedData);
      expect(data.dateRange).toBeUndefined();
    });
  });

  describe('PUT /api/admin/cache/[key]', () => {
    it('updates cache with valid auth and data', async () => {
      mockWriteAdminCache.mockResolvedValue(undefined);

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const requestBody = {
        data: { totalMessages: 150, totalConversations: 75 },
        dateRange: {
          start: '2026-01-21T00:00:00Z',
          end: '2026-01-28T23:59:59Z',
        },
      };

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockWriteAdminCache).toHaveBeenCalledWith(
        'usage-7d',
        requestBody.data,
        requestBody.dateRange
      );
    });

    it('updates cache without dateRange', async () => {
      mockWriteAdminCache.mockResolvedValue(undefined);

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const requestBody = {
        data: { totalMessages: 150 },
      };

      const request = new Request('http://localhost/api/admin/cache/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'dashboard' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockWriteAdminCache).toHaveBeenCalledWith('dashboard', requestBody.data, undefined);
    });

    it('returns 401 when no token provided', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { test: 'data' } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      mockVerifyToken.mockResolvedValue(false);

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { test: 'data' } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid cache key', async () => {
      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/invalid-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { test: 'data' } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'invalid-key' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid cache key');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 400 when data field is missing', async () => {
      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid data field');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 400 when data is not an object', async () => {
      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'not an object' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid data field');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 400 when dateRange is invalid', async () => {
      await import('@/app/api/admin/cache/[key]/route');

      const invalidDateRanges = [
        { dateRange: 'invalid' },
        { dateRange: null },
        { dateRange: { start: '2026-01-21' } }, // Missing end
        { dateRange: { end: '2026-01-28' } }, // Missing start
        { dateRange: { start: 123, end: '2026-01-28' } }, // Invalid start type
        { dateRange: { start: '2026-01-21', end: 456 } }, // Invalid end type
      ];

      for (const invalidDateRange of invalidDateRanges) {
        vi.clearAllMocks();
        vi.resetModules();

        mockCookies.mockResolvedValue({
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        });
        mockVerifyToken.mockResolvedValue(true);

        const { PUT: PutHandler } = await import('@/app/api/admin/cache/[key]/route');

        const request = new Request('http://localhost/api/admin/cache/usage-7d', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { test: 'data' }, ...invalidDateRange }),
        });

        const response = await PutHandler(request, { params: Promise.resolve({ key: 'usage-7d' }) });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid dateRange format');
        expect(mockWriteAdminCache).not.toHaveBeenCalled();
      }
    });

    it('returns 400 when data exceeds 5MB', async () => {
      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      // Create a large data object (>5MB when stringified)
      const largeData = {
        data: {
          items: Array(200000).fill({ text: 'x'.repeat(100) }), // ~20MB of data
        },
      };

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeData),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Data too large (max 5MB)');
      expect(mockWriteAdminCache).not.toHaveBeenCalled();
    });

    it('returns 500 when cache write fails', async () => {
      mockWriteAdminCache.mockRejectedValue(new Error('Blob write error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { test: 'data' } }),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to write cache');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/cache/usage-7d] Error writing cache:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('accepts complex data structures', async () => {
      mockWriteAdminCache.mockResolvedValue(undefined);

      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const complexData = {
        data: {
          metrics: {
            total: 100,
            nested: {
              deep: {
                value: 'test',
              },
            },
          },
          arrays: [1, 2, 3],
          mixed: [{ id: 1 }, { id: 2 }],
        },
        dateRange: {
          start: '2026-01-21T00:00:00Z',
          end: '2026-01-28T23:59:59Z',
        },
      };

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexData),
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockWriteAdminCache).toHaveBeenCalledWith(
        'usage-7d',
        complexData.data,
        complexData.dateRange
      );
    });

    it('returns 400 for invalid JSON body', async () => {
      const { PUT } = await import('@/app/api/admin/cache/[key]/route');

      const request = new Request('http://localhost/api/admin/cache/usage-7d', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{',
      });

      const response = await PUT(request, { params: Promise.resolve({ key: 'usage-7d' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });
  });
});
