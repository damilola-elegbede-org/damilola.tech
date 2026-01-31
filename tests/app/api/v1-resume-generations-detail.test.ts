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

describe('v1/resume-generations/[id] API route', () => {
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

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const request = new Request('http://localhost/api/v1/resume-generations/test-id');
      const response = await GET(request, createParams('test-id'));

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/resume-generations/[id]', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 404 for non-existent generation', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.public.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('returns generation content', async () => {
      const generationData = {
        version: 2,
        jobId: 'job-123',
        generationId: 'gen-456',
        companyName: 'Tech Corp',
        roleTitle: 'Senior Engineer',
        estimatedCompatibility: { before: 60, after: 85 },
        applicationStatus: 'submitted',
        tailoredResume: { sections: [] },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => generationData,
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validBlobUrl}`);
      const response = await GET(request, createParams(validBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(generationData);
    });

    it('validates URL is from allowed blob storage domain (SSRF protection)', async () => {
      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');

      const maliciousUrl = encodeURIComponent('https://evil.com/data');
      const request = new Request(`http://localhost/api/v1/resume-generations/${maliciousUrl}`);
      const response = await GET(request, createParams(maliciousUrl));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('BAD_REQUEST');
      expect(data.error.message).toContain('Invalid');
    });

    it('accepts public.blob.vercel-storage.com URLs', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ companyName: 'Test' }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validUrl = encodeURIComponent(
        'https://abc.public.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validUrl}`);
      const response = await GET(request, createParams(validUrl));

      expect(response.status).toBe(200);
    });

    it('accepts blob.vercel-storage.com URLs', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ companyName: 'Test' }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validUrl}`);
      const response = await GET(request, createParams(validUrl));

      expect(response.status).toBe(200);
    });

    it('rejects non-https URLs', async () => {
      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');

      const httpUrl = encodeURIComponent('http://abc.blob.vercel-storage.com/resume.json');
      const request = new Request(`http://localhost/api/v1/resume-generations/${httpUrl}`);
      const response = await GET(request, createParams(httpUrl));

      expect(response.status).toBe(400);
    });

    it('logs admin_resume_generation_viewed with accessType: api', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ companyName: 'Test' }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validBlobUrl}`);
      await GET(request, createParams(validBlobUrl));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_resume_generation_viewed',
        expect.objectContaining({ generationUrl: expect.any(String) }),
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

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const validBlobUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${validBlobUrl}`);
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

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const encodedUrl = encodeURIComponent(
        'https://abc.blob.vercel-storage.com/path/to/resume.json'
      );
      const request = new Request(`http://localhost/api/v1/resume-generations/${encodedUrl}`);
      await GET(request, createParams(encodedUrl));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://abc.blob.vercel-storage.com/path/to/resume.json'
      );
    });
  });
});
