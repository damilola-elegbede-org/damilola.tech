import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('admin fit assessments API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockReset();
    process.env = { ...originalEnv };
    mockCookieStore.get.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const createBlobListResult = (
    blobs: Array<{ pathname: string; url: string; size?: number }>,
    cursor?: string
  ) => ({
    blobs: blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size || 1024,
      uploadedAt: new Date(),
      downloadUrl: blob.url,
    })),
    cursor: cursor ?? null,
    hasMore: !!cursor,
  });

  describe('GET - Authentication', () => {
    it('returns 401 when no token is provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('returns assessment list with valid token', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('GET - Assessment List', () => {
    it('returns assessments with correct structure', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-30-00Z-a1b2c3d4.json',
          url: 'https://blob.example.com/assessment-1',
          size: 2048,
        },
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T11-45-30Z-a1b2c3d4e5f6.json',
          url: 'https://blob.example.com/assessment-2',
          size: 3072,
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments).toHaveLength(2);
      expect(data.assessments[0]).toEqual({
        id: blobs[0].pathname,
        pathname: blobs[0].pathname,
        assessmentId: 'a1b2c3d4',
        environment: 'production',
        timestamp: '2026-01-28T10:30:00Z',
        size: 2048,
        url: blobs[0].url,
      });
      expect(data.assessments[1]).toEqual({
        id: blobs[1].pathname,
        pathname: blobs[1].pathname,
        assessmentId: 'a1b2c3d4e5f6',
        environment: 'production',
        timestamp: '2026-01-28T11:45:30Z',
        size: 3072,
        url: blobs[1].url,
      });
    });

    it('handles empty assessment list', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments).toEqual([]);
      expect(data.cursor).toBeNull();
      expect(data.hasMore).toBe(false);
    });

    it('parses timestamp correctly from filename', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T14-22-33Z-abc123.json',
          url: 'https://blob.example.com/assessment',
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments[0].timestamp).toBe('2026-01-28T14:22:33Z');
    });

    it('extracts assessment ID from filename', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-00-00Z-deadbeef.json',
          url: 'https://blob.example.com/assessment',
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments[0].assessmentId).toBe('deadbeef');
    });

    it('handles malformed filename gracefully', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/invalid-filename.json',
          url: 'https://blob.example.com/assessment',
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments[0].assessmentId).toBe('');
      expect(data.assessments[0].timestamp).toBe('');
    });
  });

  describe('GET - Environment Filtering', () => {
    it('uses production environment by default', async () => {
      process.env.VERCEL_ENV = 'production';
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/fit-assessments/production/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('uses VERCEL_ENV when available', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/fit-assessments/preview/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('respects env query parameter', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?env=development');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/fit-assessments/development/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('env query parameter overrides VERCEL_ENV', async () => {
      process.env.VERCEL_ENV = 'production';
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?env=preview');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/fit-assessments/preview/',
        cursor: undefined,
        limit: 50,
      });
    });
  });

  describe('GET - Pagination', () => {
    it('uses default limit of 50', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });

    it('respects custom limit parameter', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?limit=25');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        })
      );
    });

    it('clamps limit to maximum of 100', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?limit=500');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('handles cursor for pagination', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?cursor=next-page-token');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: 'next-page-token',
        })
      );
    });

    it('returns cursor and hasMore in response', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-00-00Z-abc123.json',
          url: 'https://blob.example.com/assessment',
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs, 'next-cursor-token'));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cursor).toBe('next-cursor-token');
      expect(data.hasMore).toBe(true);
    });

    it('indicates no more pages when cursor is null', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-00-00Z-abc123.json',
          url: 'https://blob.example.com/assessment',
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cursor).toBeNull();
      expect(data.hasMore).toBe(false);
    });
  });

  describe('GET - Error Handling', () => {
    it('returns 500 when blob list fails', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockRejectedValue(new Error('Blob service error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list assessments');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/fit-assessments] Error listing assessments:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles invalid limit parameter gracefully', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      mockList.mockResolvedValue(createBlobListResult([]));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments?limit=invalid');
      const response = await GET(request);

      expect(response.status).toBe(200);
      // parseInt returns NaN for invalid input, route defaults to 50
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });
  });

  describe('GET - Response Structure', () => {
    it('includes all required fields in assessment summary', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);

      const blobs = [
        {
          pathname: 'damilola.tech/fit-assessments/production/2026-01-28T15-30-45Z-1a2b3c4d.json',
          url: 'https://blob.example.com/test-assessment',
          size: 5120,
        },
      ];

      mockList.mockResolvedValue(createBlobListResult(blobs));

      const { GET } = await import('@/app/api/admin/fit-assessments/route');

      const request = new Request('http://localhost/api/admin/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assessments[0]).toHaveProperty('id');
      expect(data.assessments[0]).toHaveProperty('pathname');
      expect(data.assessments[0]).toHaveProperty('assessmentId');
      expect(data.assessments[0]).toHaveProperty('environment');
      expect(data.assessments[0]).toHaveProperty('timestamp');
      expect(data.assessments[0]).toHaveProperty('size');
      expect(data.assessments[0]).toHaveProperty('url');
    });
  });
});
