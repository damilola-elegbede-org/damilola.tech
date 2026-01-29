import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  list: mockList,
}));

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock admin auth
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_session',
}));

// Mock job ID generation
const mockGenerateJobId = vi.fn();
vi.mock('@/lib/job-id', () => ({
  generateJobId: mockGenerateJobId,
}));

describe('admin resume-generations API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    mockCookieStore.get.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const mockBlobV2 = {
    pathname: 'damilola.tech/resume-generations/production/job1.json',
    url: 'https://blob.vercel-storage.com/job1',
    size: 12345,
    uploadedAt: new Date('2026-01-15T10:00:00Z'),
  };

  const mockV2LogData = {
    version: 2,
    jobId: 'job-abc123',
    jobIdentifier: { type: 'url' as const, url: 'https://example.com/job' },
    environment: 'production',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-20T14:30:00Z',
    inputType: 'url' as const,
    extractedUrl: 'https://example.com/job',
    companyName: 'Acme Corp',
    roleTitle: 'Senior Software Engineer',
    jobDescriptionFull: 'We are looking for...',
    estimatedCompatibility: {
      before: 65,
      after: 85,
      breakdown: {
        keywordRelevance: 32,
        skillsQuality: 20,
        experienceAlignment: 18,
        formatParseability: 15,
      },
    },
    changesAccepted: [],
    changesRejected: [],
    gapsIdentified: [],
    generationId: 'gen-xyz789',
    pdfUrl: 'https://blob.vercel-storage.com/resume.pdf',
    optimizedResumeJson: {},
    generationHistory: [
      {
        generationId: 'gen-xyz788',
        generatedAt: '2026-01-15T10:00:00Z',
        pdfUrl: 'https://blob.vercel-storage.com/resume-old.pdf',
        scoreBefore: 60,
        scoreAfter: 80,
        changesAccepted: 5,
        changesRejected: 2,
      },
    ],
    applicationStatus: 'applied' as const,
  };

  const mockBlobV1 = {
    pathname: 'damilola.tech/resume-generations/production/job2.json',
    url: 'https://blob.vercel-storage.com/job2',
    size: 10000,
    uploadedAt: new Date('2026-01-10T08:00:00Z'),
  };

  const mockV1LogData = {
    version: 1,
    generationId: 'gen-old123',
    environment: 'production',
    createdAt: '2026-01-10T08:00:00Z',
    inputType: 'text' as const,
    companyName: 'Tech Inc',
    roleTitle: 'Product Manager',
    jobDescriptionFull: 'Looking for a PM...',
    estimatedCompatibility: {
      before: 70,
      after: 88,
      breakdown: {
        keywordRelevance: 35,
        skillsQuality: 22,
        experienceAlignment: 16,
        formatParseability: 15,
      },
    },
    changesAccepted: [],
    changesRejected: [],
    gapsIdentified: [],
    pdfUrl: 'https://blob.vercel-storage.com/resume2.pdf',
    optimizedResumeJson: {},
    applicationStatus: 'draft' as const,
  };

  describe('GET - authentication', () => {
    it('returns 401 when no admin token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(mockList).not.toHaveBeenCalled();
    });

    it('returns 401 when admin token is invalid', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe('GET - success cases', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      global.fetch = vi.fn();
    });

    it('returns paginated list of resume generations', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockV2LogData,
      } as unknown as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '900' }),
        json: async () => mockV1LogData,
      } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(2);
      expect(data.cursor).toBeNull();
      expect(data.hasMore).toBe(false);
      expect(data.totalFetched).toBe(2);
      expect(data.filtered).toBe(false);

      // Verify V2 generation
      expect(data.generations[0]).toMatchObject({
        id: mockBlobV2.pathname,
        jobId: mockV2LogData.jobId,
        generationId: mockV2LogData.generationId,
        environment: mockV2LogData.environment,
        timestamp: mockV2LogData.createdAt,
        updatedAt: mockV2LogData.updatedAt,
        companyName: mockV2LogData.companyName,
        roleTitle: mockV2LogData.roleTitle,
        scoreBefore: mockV2LogData.estimatedCompatibility.before,
        scoreAfter: mockV2LogData.estimatedCompatibility.after,
        applicationStatus: mockV2LogData.applicationStatus,
        url: mockBlobV2.url,
        size: mockBlobV2.size,
        generationCount: 2, // 1 current + 1 in history
      });

      // Verify V1 generation (computed jobId)
      expect(data.generations[1]).toMatchObject({
        id: mockBlobV1.pathname,
        jobId: 'computed-job-id',
        generationId: mockV1LogData.generationId,
        environment: mockV1LogData.environment,
        timestamp: mockV1LogData.createdAt,
        updatedAt: mockV1LogData.createdAt, // V1 uses createdAt for updatedAt
        companyName: mockV1LogData.companyName,
        roleTitle: mockV1LogData.roleTitle,
        scoreBefore: mockV1LogData.estimatedCompatibility.before,
        scoreAfter: mockV1LogData.estimatedCompatibility.after,
        applicationStatus: mockV1LogData.applicationStatus,
        url: mockBlobV1.url,
        size: mockBlobV1.size,
        generationCount: 1, // V1 always has 1 generation
      });

      // Verify sorted by timestamp descending (newest first)
      expect(new Date(data.generations[0].timestamp).getTime())
        .toBeGreaterThan(new Date(data.generations[1].timestamp).getTime());

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/resume-generations/production/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('returns cursor when more results available', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: 'next-page-token',
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockV2LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cursor).toBe('next-page-token');
      expect(data.hasMore).toBe(true);
    });

    it('handles pagination with cursor parameter', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '900' }),
        json: async () => mockV1LogData,
      } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?cursor=page2');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/resume-generations/production/',
        cursor: 'page2',
        limit: 50,
      });
    });

    it('handles empty blob list', async () => {
      mockList.mockResolvedValue({
        blobs: [],
        cursor: null,
      });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(0);
      expect(data.cursor).toBeNull();
      expect(data.hasMore).toBe(false);
      expect(data.totalFetched).toBe(0);
      expect(data.filtered).toBe(false);
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockList.mockResolvedValue({
        blobs: [],
        cursor: null,
      });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/resume-generations/preview/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('uses preview environment when not on Vercel and NODE_ENV is not production', async () => {
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
      mockList.mockResolvedValue({
        blobs: [],
        cursor: null,
      });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/resume-generations/preview/',
        cursor: undefined,
        limit: 50,
      });
    });

    it('handles blob fetch errors gracefully', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      // First fetch succeeds, second fails
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockV2LogData,
      } as unknown as Response);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(2);

      // First generation is valid
      expect(data.generations[0].companyName).toBe('Acme Corp');

      // Second generation is placeholder due to fetch error
      expect(data.generations[1]).toMatchObject({
        id: mockBlobV1.pathname,
        jobId: 'unknown',
        generationId: 'unknown',
        companyName: 'Unknown',
        roleTitle: 'Unknown',
        scoreBefore: 0,
        scoreAfter: 0,
        applicationStatus: 'draft',
        generationCount: 1,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations] Error parsing blob:',
        mockBlobV1.pathname,
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles blob parse errors gracefully', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0]).toMatchObject({
        companyName: 'Unknown',
        roleTitle: 'Unknown',
      });

      consoleSpy.mockRestore();
    });

    it('skips blobs that exceed size limit', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '2000000' }), // 2MB, exceeds 1MB limit
        json: async () => mockV2LogData,
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].companyName).toBe('Unknown');

      consoleSpy.mockRestore();
    });

    it('handles fetch timeout gracefully', async () => {
      vi.useFakeTimers();

      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: null,
      });

      // Mock fetch to never resolve, but handle abort
      vi.mocked(global.fetch).mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('Aborted'));
            });
          }
        });
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const responsePromise = GET(request);

      // Advance time to trigger timeout
      await vi.advanceTimersByTimeAsync(10000);

      const response = await responsePromise;
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].companyName).toBe('Unknown');

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });

    it('computes jobId from URL for V1 logs with extractedUrl', async () => {
      const v1WithUrl = {
        ...mockV1LogData,
        extractedUrl: 'https://example.com/job/123',
      };

      mockList.mockResolvedValue({
        blobs: [mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => v1WithUrl,
      } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'job-from-url' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations[0].jobId).toBe('job-from-url');
      expect(mockGenerateJobId).toHaveBeenCalledWith({ url: 'https://example.com/job/123' });
    });

    it('computes jobId from title+company for V1 logs without URL', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '900' }),
        json: async () => mockV1LogData,
      } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'job-from-title-company' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations[0].jobId).toBe('job-from-title-company');
      expect(mockGenerateJobId).toHaveBeenCalledWith({
        title: mockV1LogData.roleTitle,
        company: mockV1LogData.companyName,
      });
    });
  });

  describe('GET - filtering', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      global.fetch = vi.fn();
    });

    it('filters by application status', async () => {
      const appliedLog = { ...mockV2LogData, applicationStatus: 'applied' as const };
      const draftLog = { ...mockV1LogData, applicationStatus: 'draft' as const };

      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => appliedLog,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => draftLog,
        } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?status=applied');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].applicationStatus).toBe('applied');
      expect(data.totalFetched).toBe(2);
      expect(data.filtered).toBe(true);
    });

    it('filters by company name (case-insensitive partial match)', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => ({ ...mockV2LogData, companyName: 'Acme Corp' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => ({ ...mockV1LogData, companyName: 'Tech Inc' }),
        } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?company=acme');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].companyName).toBe('Acme Corp');
      expect(data.filtered).toBe(true);
    });

    it('filters by date range', async () => {
      const oldLog = { ...mockV1LogData, createdAt: '2026-01-05T08:00:00Z' };
      const newLog = { ...mockV2LogData, createdAt: '2026-01-20T10:00:00Z' };

      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => newLog,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => oldLog,
        } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?dateFrom=2026-01-10&dateTo=2026-01-25');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].timestamp).toBe('2026-01-20T10:00:00Z');
      expect(data.filtered).toBe(true);
    });

    it('filters by minimum score', async () => {
      const lowScore = { ...mockV1LogData, estimatedCompatibility: { ...mockV1LogData.estimatedCompatibility, after: 70 } };
      const highScore = { ...mockV2LogData, estimatedCompatibility: { ...mockV2LogData.estimatedCompatibility, after: 90 } };

      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => highScore,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => lowScore,
        } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?minScore=80');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].scoreAfter).toBe(90);
      expect(data.filtered).toBe(true);
    });

    it('filters by maximum score', async () => {
      const lowScore = { ...mockV1LogData, estimatedCompatibility: { ...mockV1LogData.estimatedCompatibility, after: 70 } };
      const highScore = { ...mockV2LogData, estimatedCompatibility: { ...mockV2LogData.estimatedCompatibility, after: 90 } };

      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => highScore,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => lowScore,
        } as unknown as Response);

      mockGenerateJobId.mockReturnValue({ jobId: 'computed-job-id' });

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?maxScore=80');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].scoreAfter).toBe(70);
      expect(data.filtered).toBe(true);
    });

    it('combines multiple filters', async () => {
      const matchingLog = {
        ...mockV2LogData,
        companyName: 'Acme Corp',
        applicationStatus: 'applied' as const,
        createdAt: '2026-01-15T10:00:00Z',
        estimatedCompatibility: { ...mockV2LogData.estimatedCompatibility, after: 85 },
      };

      const notMatchingStatus = { ...mockV1LogData, applicationStatus: 'draft' as const };

      mockList.mockResolvedValue({
        blobs: [mockBlobV2, mockBlobV1],
        cursor: null,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '1000' }),
          json: async () => matchingLog,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-length': '900' }),
          json: async () => notMatchingStatus,
        } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request(
        'http://localhost/api/admin/resume-generations?status=applied&company=acme&minScore=80&dateFrom=2026-01-10&dateTo=2026-01-20'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.generations[0].companyName).toBe('Acme Corp');
      expect(data.filtered).toBe(true);
    });

    it('ignores invalid status filter', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockV2LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?status=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.filtered).toBe(false); // Invalid filter ignored
    });

    it('ignores invalid score filter', async () => {
      mockList.mockResolvedValue({
        blobs: [mockBlobV2],
        cursor: null,
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000' }),
        json: async () => mockV2LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations?minScore=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generations).toHaveLength(1);
      expect(data.filtered).toBe(false); // Invalid filter ignored
    });
  });

  describe('GET - error handling', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
    });

    it('returns 500 when blob list fails', async () => {
      mockList.mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/route');

      const request = new Request('http://localhost/api/admin/resume-generations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch generations');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations] Error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
