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

// Mock job-id
vi.mock('@/lib/job-id', () => ({
  generateJobId: vi.fn(({ url, title, company }) => {
    if (url) return { jobId: `url-${url.slice(0, 10)}` };
    return { jobId: `${company}-${title}`.toLowerCase().replace(/\s+/g, '-') };
  }),
}));

// Mock api-audit
const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/resume-generations API route', () => {
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

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/resume-generations', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns generation list', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/resume-generations/preview/resume1.json',
            size: 5000,
            url: 'https://blob.url/resume1',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
        ],
        cursor: undefined,
        hasMore: false,
      });

      const mockGenerationData = {
        version: 2,
        jobId: 'job-123',
        generationId: 'gen-456',
        environment: 'preview',
        createdAt: '2026-01-28T10:00:00.000Z',
        updatedAt: '2026-01-28T10:00:00.000Z',
        companyName: 'Tech Corp',
        roleTitle: 'Senior Engineer',
        estimatedCompatibility: { before: 60, after: 85 },
        applicationStatus: 'draft',
        generationHistory: [],
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockGenerationData,
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.generations).toHaveLength(1);
    });

    it('supports pagination', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: 'next-cursor',
        hasMore: true,
      });

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations?cursor=prev-cursor');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: 'prev-cursor',
        })
      );
    });

    it('returns proper response format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/resume-generations/preview/resume1.json',
            size: 5000,
            url: 'https://blob.url/resume1',
            uploadedAt: new Date('2026-01-28T10:00:00Z'),
          },
        ],
        cursor: 'next-page',
        hasMore: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => ({
          version: 2,
          jobId: 'job-123',
          generationId: 'gen-456',
          environment: 'preview',
          createdAt: '2026-01-28T10:00:00.000Z',
          updatedAt: '2026-01-28T11:00:00.000Z',
          companyName: 'Test Corp',
          roleTitle: 'Engineer',
          estimatedCompatibility: { before: 50, after: 80 },
          applicationStatus: 'submitted',
          generationHistory: [{}],
        }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.generations[0]).toHaveProperty('id');
      expect(data.data.generations[0]).toHaveProperty('jobId');
      expect(data.data.generations[0]).toHaveProperty('generationId');
      expect(data.data.generations[0]).toHaveProperty('companyName');
      expect(data.data.generations[0]).toHaveProperty('roleTitle');
      expect(data.data.generations[0]).toHaveProperty('scoreBefore');
      expect(data.data.generations[0]).toHaveProperty('scoreAfter');
      expect(data.data.generations[0]).toHaveProperty('applicationStatus');
      expect(data.data.generations[0]).toHaveProperty('generationCount');
      expect(data.meta.pagination).toHaveProperty('cursor', 'next-page');
      expect(data.meta.pagination).toHaveProperty('hasMore', true);
    });

    it('supports status filter', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
          { pathname: 'resume2.json', size: 1000, url: 'https://blob.url/resume2', uploadedAt: new Date() },
        ],
        cursor: undefined,
        hasMore: false,
      });

      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        const isFirst = callCount === 1;
        return {
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => ({
            version: 2,
            jobId: isFirst ? 'job-1' : 'job-2',
            generationId: isFirst ? 'gen-1' : 'gen-2',
            environment: 'preview',
            createdAt: isFirst ? '2026-01-28T10:00:00.000Z' : '2026-01-28T11:00:00.000Z',
            updatedAt: isFirst ? '2026-01-28T10:00:00.000Z' : '2026-01-28T11:00:00.000Z',
            companyName: isFirst ? 'Corp A' : 'Corp B',
            roleTitle: 'Eng',
            estimatedCompatibility: { before: 50, after: 80 },
            applicationStatus: isFirst ? 'applied' : 'draft',
            generationHistory: [],
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations?status=applied');
      const response = await GET(request);
      const data = await response.json();

      // Should only return applied resumes
      expect(data.data.generations).toHaveLength(1);
      expect(data.data.generations[0].applicationStatus).toBe('applied');
    });

    it('supports company name filter', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
          { pathname: 'resume2.json', size: 1000, url: 'https://blob.url/resume2', uploadedAt: new Date() },
        ],
        cursor: undefined,
        hasMore: false,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const companyName = urlStr.includes('resume1') ? 'Google' : 'Meta';
        return {
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => ({
            version: 2,
            jobId: 'job-1',
            generationId: 'gen-1',
            environment: 'preview',
            createdAt: '2026-01-28T10:00:00.000Z',
            updatedAt: '2026-01-28T10:00:00.000Z',
            companyName,
            roleTitle: 'Eng',
            estimatedCompatibility: { before: 50, after: 80 },
            applicationStatus: 'draft',
            generationHistory: [],
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations?company=google');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.generations).toHaveLength(1);
      expect(data.data.generations[0].companyName).toBe('Google');
    });

    it('supports score filters (minScore, maxScore)', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
          { pathname: 'resume2.json', size: 1000, url: 'https://blob.url/resume2', uploadedAt: new Date() },
        ],
        cursor: undefined,
        hasMore: false,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const score = urlStr.includes('resume1') ? 90 : 70;
        return {
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => ({
            version: 2,
            jobId: 'job-1',
            generationId: 'gen-1',
            environment: 'preview',
            createdAt: '2026-01-28T10:00:00.000Z',
            updatedAt: '2026-01-28T10:00:00.000Z',
            companyName: 'Corp',
            roleTitle: 'Eng',
            estimatedCompatibility: { before: 50, after: score },
            applicationStatus: 'draft',
            generationHistory: [],
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations?minScore=85');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.generations).toHaveLength(1);
      expect(data.data.generations[0].scoreAfter).toBe(90);
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('sorts by timestamp descending', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
          { pathname: 'resume2.json', size: 1000, url: 'https://blob.url/resume2', uploadedAt: new Date() },
        ],
        cursor: undefined,
        hasMore: false,
      });

      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        const createdAt = urlStr.includes('resume1')
          ? '2026-01-27T10:00:00.000Z'
          : '2026-01-28T10:00:00.000Z';
        return {
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => ({
            version: 2,
            jobId: 'job-1',
            generationId: 'gen-1',
            environment: 'preview',
            createdAt,
            updatedAt: createdAt,
            companyName: 'Corp',
            roleTitle: 'Eng',
            estimatedCompatibility: { before: 50, after: 80 },
            applicationStatus: 'draft',
            generationHistory: [],
          }),
        } as Response;
      });

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      // Should be sorted newest first
      expect(data.data.generations[0].timestamp).toBe('2026-01-28T10:00:00.000Z');
      expect(data.data.generations[1].timestamp).toBe('2026-01-27T10:00:00.000Z');
    });

    it('handles v1 (legacy) generation format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
        ],
        cursor: undefined,
        hasMore: false,
      });

      // v1 format doesn't have version or generationHistory
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => ({
          generationId: 'gen-1',
          environment: 'preview',
          createdAt: '2026-01-28T10:00:00.000Z',
          companyName: 'Corp',
          roleTitle: 'Eng',
          extractedUrl: 'https://jobs.example.com/123',
          estimatedCompatibility: { before: 50, after: 80 },
          applicationStatus: 'draft',
        }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.generations).toHaveLength(1);
      expect(data.data.generations[0].generationCount).toBe(1); // Default for v1
    });

    it('logs api_resume_generations_list audit event with correct parameters', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'resume1.json', size: 1000, url: 'https://blob.url/resume1', uploadedAt: new Date() },
          { pathname: 'resume2.json', size: 1000, url: 'https://blob.url/resume2', uploadedAt: new Date() },
        ],
        cursor: 'next-cursor',
        hasMore: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => ({
          version: 2,
          jobId: 'job-123',
          generationId: 'gen-456',
          environment: 'preview',
          createdAt: '2026-01-28T10:00:00.000Z',
          updatedAt: '2026-01-28T10:00:00.000Z',
          companyName: 'Tech Corp',
          roleTitle: 'Senior Engineer',
          estimatedCompatibility: { before: 60, after: 85 },
          applicationStatus: 'draft',
          generationHistory: [],
        }),
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/route');
      const request = new Request('http://localhost/api/v1/resume-generations');
      await GET(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_resume_generations_list',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          environment: 'preview',
          resultCount: 2,
          hasFilters: false,
          hasMore: true,
        }),
        '127.0.0.1'
      );
    });
  });
});
