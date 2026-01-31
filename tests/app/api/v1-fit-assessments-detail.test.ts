/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock audit-server
const mockLogAdminEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/fit-assessments/[id] API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const createParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const request = new Request('http://localhost/api/v1/fit-assessments/test-id');
      const response = await GET(request, createParams('test-id'));

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/fit-assessments/[id]', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 404 for non-existent assessment', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns assessment content', async () => {
      const assessmentData = {
        companyName: 'Test Corp',
        roleTitle: 'Senior Engineer',
        fitScore: 85,
        analysis: 'Strong match...',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => assessmentData,
      } as Response);

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(assessmentData);
    });

    it('validates URL is Vercel Blob (SSRF protection)', async () => {
      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');

      const maliciousUrl = encodeURIComponent('https://evil.com/data');
      const request = new Request(`http://localhost/api/v1/fit-assessments/${maliciousUrl}`);
      const response = await GET(request, createParams(maliciousUrl));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('BAD_REQUEST');
    });

    it('rejects URLs not containing fit-assessments path', async () => {
      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');

      const wrongPathUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/other/path/file.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${wrongPathUrl}`);
      const response = await GET(request, createParams(wrongPathUrl));

      expect(response.status).toBe(400);
    });

    it('logs admin_assessment_viewed with accessType: api', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ companyName: 'Test' }),
      } as Response);

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${validBlobUrl}`);
      await GET(request, createParams(validBlobUrl));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_assessment_viewed',
        expect.objectContaining({ assessmentUrl: expect.any(String) }),
        expect.any(String),
        expect.objectContaining({
          accessType: 'api',
          apiKeyId: 'key-1',
          apiKeyName: 'Test Key',
        })
      );
    });

    it('handles fetch errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('decodes URL-encoded IDs', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { GET } = await import('@/app/api/v1/fit-assessments/[id]/route');
      const encodedUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
      const request = new Request(`http://localhost/api/v1/fit-assessments/${encodedUrl}`);
      await GET(request, createParams(encodedUrl));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://abc.blob.vercel-storage.com/damilola.tech/fit-assessments/production/assessment.json'
      );
    });
  });
});
