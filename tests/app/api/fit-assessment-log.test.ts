import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}));

describe('fit-assessment log API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validLogData = {
    assessmentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    inputType: 'text',
    inputLength: 1500,
    jobDescriptionSnippet: 'Senior Software Engineer at Acme Corp...',
    completionLength: 5000,
    streamDurationMs: 3500,
    roleTitle: 'senior-software-engineer',
    downloadedPdf: false,
    downloadedMd: false,
  };

  describe('valid requests', () => {
    it('logs assessment successfully', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test',
        pathname: 'test',
      });

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPut).toHaveBeenCalledTimes(1);

      // Verify the blob path format
      const [pathname, content, options] = mockPut.mock.calls[0];
      expect(pathname).toMatch(/^damilola\.tech\/fit-assessments\/production\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-a1b2c3d4\.json$/);
      expect(options).toEqual({ access: 'public', addRandomSuffix: true, contentType: 'application/json' });

      // Verify the logged content structure
      const parsedContent = JSON.parse(content);
      expect(parsedContent.version).toBe(1);
      expect(parsedContent.assessmentId).toBe(validLogData.assessmentId.toLowerCase());
      expect(parsedContent.environment).toBe('production');
      expect(parsedContent.inputType).toBe(validLogData.inputType);
      expect(parsedContent.inputLength).toBe(validLogData.inputLength);
      expect(parsedContent.completionLength).toBe(validLogData.completionLength);
      expect(parsedContent.streamDurationMs).toBe(validLogData.streamDurationMs);
      expect(parsedContent.roleTitle).toBe(validLogData.roleTitle);
      expect(parsedContent.downloadedPdf).toBe(false);
      expect(parsedContent.downloadedMd).toBe(false);
      expect(parsedContent.createdAt).toBeDefined();
    });

    it('handles url input type', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validLogData,
          inputType: 'url',
          extractedUrl: 'https://example.com/job',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);
      expect(parsedContent.inputType).toBe('url');
      expect(parsedContent.extractedUrl).toBe('https://example.com/job');
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/fit-assessments/preview/');
    });

    it('uses development environment when VERCEL_ENV is not set', async () => {
      delete process.env.VERCEL_ENV;
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/fit-assessments/development/');
    });

    it('truncates job description snippet to 200 chars', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const longSnippet = 'A'.repeat(300);
      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validLogData,
          jobDescriptionSnippet: longSnippet,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);
      expect(parsedContent.jobDescriptionSnippet).toHaveLength(200);
    });
  });

  describe('validation errors', () => {
    it('rejects invalid assessmentId format', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, assessmentId: 'invalid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('assessmentId');
    });

    it('rejects invalid inputType', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, inputType: 'invalid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('inputType');
    });

    it('rejects negative inputLength', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, inputLength: -1 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('inputLength');
    });

    it('rejects missing jobDescriptionSnippet', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const { jobDescriptionSnippet, ...dataWithoutSnippet } = validLogData;
      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutSnippet),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('jobDescriptionSnippet');
    });

    it('rejects negative completionLength', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, completionLength: -1 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('completionLength');
    });

    it('rejects negative streamDurationMs', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, streamDurationMs: -1 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('streamDurationMs');
    });

    it('rejects non-boolean downloadedPdf', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, downloadedPdf: 'true' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('downloadedPdf');
    });

    it('rejects non-boolean downloadedMd', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validLogData, downloadedMd: 'false' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('downloadedMd');
    });

    it('rejects invalid JSON body', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('request size validation', () => {
    it('rejects requests exceeding MAX_BODY_SIZE', async () => {
      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '100000', // 100KB, exceeds 50KB limit
        },
        body: JSON.stringify(validLogData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('too large');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('blob errors', () => {
    it('returns 500 when blob put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const { POST } = await import('@/app/api/fit-assessment/log/route');

      const request = new Request('http://localhost/api/fit-assessment/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLogData),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('log');

      consoleSpy.mockRestore();
    });
  });
});
