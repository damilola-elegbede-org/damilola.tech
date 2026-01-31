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

describe('v1/fit-assessments API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/fit-assessments', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns fit assessment list', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 5000,
            url: 'https://blob.url/assessment1',
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.assessments).toHaveLength(1);
    });

    it('supports pagination', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: 'next-cursor',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments?limit=25&cursor=prev');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          cursor: 'prev',
        })
      );
    });

    it('limits max results to 100', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments?limit=500');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('supports environment filter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments?env=preview');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/preview/'),
        })
      );
    });

    it('returns proper response format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 5000,
            url: 'https://blob.url/assessment1',
          },
        ],
        cursor: 'next-page',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.assessments[0]).toHaveProperty('id');
      expect(data.data.assessments[0]).toHaveProperty('pathname');
      expect(data.data.assessments[0]).toHaveProperty('assessmentId');
      expect(data.data.assessments[0]).toHaveProperty('environment');
      expect(data.data.assessments[0]).toHaveProperty('timestamp');
      expect(data.data.assessments[0]).toHaveProperty('size');
      expect(data.data.assessments[0]).toHaveProperty('url');
      expect(data.meta.pagination).toHaveProperty('cursor', 'next-page');
      expect(data.meta.pagination).toHaveProperty('hasMore', true);
    });

    it('parses timestamp from filename', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/fit-assessments/production/2026-01-28T10-30-00Z-abc12345.json',
            size: 5000,
            url: 'https://blob.url/assessment1',
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      // Timestamp should be converted from dashes to colons
      expect(data.data.assessments[0].timestamp).toBe('2026-01-28T10:30:00Z');
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('handles invalid limit values', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false });

      const { GET } = await import('@/app/api/v1/fit-assessments/route');
      const request = new Request('http://localhost/api/v1/fit-assessments?limit=invalid');
      await GET(request);

      // Should use default limit of 50
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });
  });
});
