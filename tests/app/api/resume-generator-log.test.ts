import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
  list: mockList,
}));

// Mock next/headers
const mockGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: mockGet,
  })),
}));

// Mock admin auth
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_session',
}));

describe('resume-generator log API route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default to authenticated
    mockGet.mockReturnValue({ value: 'valid-token' });
    mockVerifyToken.mockResolvedValue(true);
    mockList.mockResolvedValue({ blobs: [] }); // No existing record by default
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  const validLogData = {
    generationId: 'gen-123',
    jobId: 'job-456',
    jobIdentifier: { type: 'url', hash: 'abc123' },
    companyName: 'Acme Corp',
    roleTitle: 'Senior Software Engineer',
    jobDescriptionFull: 'We are looking for a senior software engineer...',
    datePosted: '2026-01-15',
    inputType: 'url',
    extractedUrl: 'https://example.com/job/123',
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
    changesAccepted: [
      {
        section: 'summary',
        original: 'Experienced engineer',
        modified: 'Senior software engineer with expertise in cloud platforms',
        reason: 'Added keywords from job description',
        keywordsAdded: ['cloud platforms', 'senior'],
        impactPoints: 5,
      },
    ],
    changesRejected: [],
    gapsIdentified: [],
    pdfUrl: 'https://blob.vercel-storage.com/resume.pdf',
    optimizedResumeJson: { name: 'John Doe' },
  };

  describe('authentication', () => {
    it('rejects request without admin token', async () => {
      mockGet.mockReturnValue(undefined);

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects request with invalid admin token', async () => {
      mockGet.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('valid requests - new records', () => {
    it('creates new v2 record successfully', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test.json',
        pathname: 'test.json',
      });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.generationId).toBe('gen-123');
      expect(data.jobId).toBe('job-456');
      expect(data.isUpdate).toBe(false);
      expect(data.generationCount).toBe(1);
      expect(mockPut).toHaveBeenCalledTimes(1);

      // Verify blob path format
      const [pathname, content, options] = mockPut.mock.calls[0];
      expect(pathname).toBe('damilola.tech/resume-generations/production/job-456.json');
      expect(options).toEqual({ access: 'public', contentType: 'application/json' });

      // Verify logged content structure
      const parsedContent = JSON.parse(content);
      expect(parsedContent.version).toBe(2);
      expect(parsedContent.jobId).toBe('job-456');
      expect(parsedContent.generationId).toBe('gen-123');
      expect(parsedContent.environment).toBe('production');
      expect(parsedContent.companyName).toBe('Acme Corp');
      expect(parsedContent.roleTitle).toBe('Senior Software Engineer');
      expect(parsedContent.estimatedCompatibility.before).toBe(65);
      expect(parsedContent.estimatedCompatibility.after).toBe(85);
      expect(parsedContent.changesAccepted).toHaveLength(1);
      expect(parsedContent.generationHistory).toEqual([]);
      expect(parsedContent.applicationStatus).toBe('draft');
      expect(parsedContent.createdAt).toBeDefined();
      expect(parsedContent.updatedAt).toBeDefined();
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/resume-generations/preview/');
    });

    it('uses preview environment when VERCEL_ENV is not set', async () => {
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL;
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/resume-generations/preview/');
    });

    it('handles text input type', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const textInputData = {
        ...validLogData,
        inputType: 'text',
        extractedUrl: undefined,
      };

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textInputData),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);
      expect(parsedContent.inputType).toBe('text');
      expect(parsedContent.extractedUrl).toBeUndefined();
    });

    it('handles optional fields correctly', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const minimalData = {
        generationId: 'gen-123',
        jobId: 'job-456',
        jobIdentifier: { type: 'manual', hash: 'xyz789' },
        companyName: 'Acme Corp',
        roleTitle: 'Engineer',
        jobDescriptionFull: 'Job description here',
      };

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalData),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);
      expect(parsedContent.inputType).toBe('text');
      expect(parsedContent.estimatedCompatibility).toEqual({
        before: 0,
        after: 0,
        breakdown: {
          keywordRelevance: 0,
          skillsQuality: 0,
          experienceAlignment: 0,
          formatParseability: 0,
        },
      });
      expect(parsedContent.changesAccepted).toEqual([]);
      expect(parsedContent.changesRejected).toEqual([]);
      expect(parsedContent.gapsIdentified).toEqual([]);
      expect(parsedContent.pdfUrl).toBe('');
      expect(parsedContent.optimizedResumeJson).toEqual({});
    });
  });

  describe('valid requests - updating existing records', () => {
    it('merges with existing v2 record and adds to history', async () => {
      const existingV2Record = {
        version: 2,
        jobId: 'job-456',
        jobIdentifier: { type: 'url', hash: 'abc123' },
        environment: 'production',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-15T10:00:00Z',
        inputType: 'url',
        extractedUrl: 'https://example.com/job/123',
        companyName: 'Acme Corp',
        roleTitle: 'Senior Software Engineer',
        jobDescriptionFull: 'Previous job description',
        estimatedCompatibility: {
          before: 60,
          after: 80,
          breakdown: {
            keywordRelevance: 30,
            skillsQuality: 18,
            experienceAlignment: 17,
            formatParseability: 15,
          },
        },
        changesAccepted: [],
        changesRejected: [],
        gapsIdentified: [],
        generationId: 'gen-old',
        pdfUrl: 'https://blob.vercel-storage.com/old.pdf',
        optimizedResumeJson: {},
        generationHistory: [],
        applicationStatus: 'applied',
        appliedDate: '2026-01-16',
        notes: 'Applied via LinkedIn',
      };

      mockList.mockResolvedValue({
        blobs: [
          {
            url: 'https://blob.vercel-storage.com/existing.json',
            pathname: 'damilola.tech/resume-generations/production/job-456.json',
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingV2Record,
      });

      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isUpdate).toBe(true);
      expect(data.generationCount).toBe(2);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);

      // Should preserve original createdAt
      expect(parsedContent.createdAt).toBe('2026-01-15T10:00:00Z');
      // Should have new updatedAt
      expect(parsedContent.updatedAt).not.toBe('2026-01-15T10:00:00Z');
      // Should update to new generation data
      expect(parsedContent.generationId).toBe('gen-123');
      expect(parsedContent.estimatedCompatibility.after).toBe(85);
      // Should preserve application status
      expect(parsedContent.applicationStatus).toBe('applied');
      expect(parsedContent.appliedDate).toBe('2026-01-16');
      expect(parsedContent.notes).toBe('Applied via LinkedIn');
      // Should add old generation to history
      expect(parsedContent.generationHistory).toHaveLength(1);
      expect(parsedContent.generationHistory[0]).toEqual({
        generationId: 'gen-old',
        generatedAt: '2026-01-15T10:00:00Z',
        pdfUrl: 'https://blob.vercel-storage.com/old.pdf',
        scoreBefore: 60,
        scoreAfter: 80,
        changesAccepted: 0,
        changesRejected: 0,
      });
    });

    it('converts v1 record to v2 format during migration', async () => {
      const existingV1Record = {
        version: 1,
        generationId: 'gen-v1',
        environment: 'production',
        createdAt: '2026-01-10T08:00:00Z',
        inputType: 'text',
        companyName: 'Acme Corp',
        roleTitle: 'Senior Software Engineer',
        jobDescriptionFull: 'Old v1 job description',
        estimatedCompatibility: {
          before: 55,
          after: 75,
          breakdown: {
            keywordRelevance: 28,
            skillsQuality: 16,
            experienceAlignment: 16,
            formatParseability: 15,
          },
        },
        changesAccepted: [
          {
            section: 'summary',
            original: 'Old text',
            modified: 'New text',
            reason: 'Improvement',
            keywordsAdded: ['keyword'],
            impactPoints: 3,
          },
        ],
        changesRejected: [],
        gapsIdentified: [],
        pdfUrl: 'https://blob.vercel-storage.com/v1.pdf',
        optimizedResumeJson: {},
        applicationStatus: 'draft',
      };

      mockList.mockResolvedValue({
        blobs: [
          {
            url: 'https://blob.vercel-storage.com/v1.json',
            pathname: 'damilola.tech/resume-generations/production/job-456.json',
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => existingV1Record,
      });

      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isUpdate).toBe(true);
      expect(data.generationCount).toBe(2);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);

      // Should be v2 format
      expect(parsedContent.version).toBe(2);
      expect(parsedContent.jobId).toBe('job-456');
      // Should convert v1 to history entry
      expect(parsedContent.generationHistory).toHaveLength(1);
      expect(parsedContent.generationHistory[0]).toEqual({
        generationId: 'gen-v1',
        generatedAt: '2026-01-10T08:00:00Z',
        pdfUrl: 'https://blob.vercel-storage.com/v1.pdf',
        scoreBefore: 55,
        scoreAfter: 75,
        changesAccepted: 1,
        changesRejected: 0,
      });
    });

    it('handles fetch failure when looking up existing record', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            url: 'https://blob.vercel-storage.com/existing.json',
            pathname: 'test.json',
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should create new record instead of failing
      expect(response.status).toBe(200);
      expect(data.isUpdate).toBe(false);
      expect(data.generationCount).toBe(1);
    });
  });

  describe('validation errors', () => {
    it('rejects missing generationId', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { generationId, ...dataWithoutGenerationId } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutGenerationId),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects missing companyName', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { companyName, ...dataWithoutCompany } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutCompany),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects missing roleTitle', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { roleTitle, ...dataWithoutRole } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutRole),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects missing jobDescriptionFull', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { jobDescriptionFull, ...dataWithoutJD } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutJD),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects missing jobId for v2 format', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { jobId, ...dataWithoutJobId } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutJobId),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('jobId');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects missing jobIdentifier for v2 format', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const { jobIdentifier, ...dataWithoutIdentifier } = validLogData; // eslint-disable-line @typescript-eslint/no-unused-vars
      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutIdentifier),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('jobIdentifier');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON body', async () => {
      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('returns 500 when blob put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to save generation log');

      consoleSpy.mockRestore();
    });

    it('returns 500 when blob list fails', async () => {
      mockList.mockRejectedValue(new Error('List operation failed'));

      const { POST } = await import('@/app/api/resume-generator/log/route');

      const request = new Request('http://localhost/api/resume-generator/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to save generation log');

      consoleSpy.mockRestore();
    });
  });
});
