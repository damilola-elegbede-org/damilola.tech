/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock rate-limit
const mockCheckGenericRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  checkGenericRateLimit: (...args: unknown[]) => mockCheckGenericRateLimit(...args),
  RATE_LIMIT_CONFIGS: { resumeGenerator: {} },
}));

// Mock job-description-input
const mockResolveJobDescriptionInput = vi.fn();
vi.mock('@/lib/job-description-input', () => ({
  resolveJobDescriptionInput: (...args: unknown[]) => mockResolveJobDescriptionInput(...args),
  JobDescriptionInputError: class JobDescriptionInputError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JobDescriptionInputError';
    }
  },
}));

// Mock api-audit
const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

const mockValidApiKey = {
  apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
};

const validBody = {
  url: 'https://jobs.ashby.com/exampleco/senior-engineer',
};

const JD_TEXT = 'Senior Software Engineer at ExampleCo. Responsibilities: design APIs, mentor engineers. Qualifications: TypeScript, Node.js, 5+ years experience.';

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/v1/extract-job-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/v1/extract-job-description', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 9 });
    mockResolveJobDescriptionInput.mockResolvedValue({
      text: JD_TEXT,
      inputType: 'url',
      extractedUrl: validBody.url,
    });
  });

  describe('authentication', () => {
    it('returns 401 when api key is missing', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('returns 400 when body is invalid JSON', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const req = new Request('http://localhost/api/v1/extract-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when url is missing', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest({}));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when url is not a string', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest({ url: 123 }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when url is malformed', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest({ url: 'not-a-url' }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when url is non-http scheme', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest({ url: 'ftp://example.com/job' }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when body is a JSON array', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const req = new Request('http://localhost/api/v1/extract-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([validBody]),
      });
      const response = await POST(req);
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 429 when rate limited', async () => {
      mockCheckGenericRateLimit.mockResolvedValue({ limited: true, remaining: 0, retryAfter: 60 });
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(429);
    });
  });

  describe('success — standard ATS page', () => {
    it('returns 200 with content, char_count, and source_url', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.content).toBe(JD_TEXT);
      expect(data.data.char_count).toBe(JD_TEXT.length);
      expect(data.data.source_url).toBe(validBody.url);
      expect(data.data.failure_mode).toBeUndefined();
    });

    it('calls resolveJobDescriptionInput with the url', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      await POST(makeRequest(validBody));
      expect(mockResolveJobDescriptionInput).toHaveBeenCalledWith(
        validBody.url,
        expect.any(String)
      );
    });

    it('logs api_extract_job_description audit event', async () => {
      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      await POST(makeRequest(validBody));
      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_extract_job_description',
        mockValidApiKey.apiKey,
        expect.objectContaining({ url: validBody.url }),
        '127.0.0.1'
      );
    });
  });

  describe('success — JS-rendered ATS (empty shell)', () => {
    it('returns 200 with failure_mode empty_shell when page is a SPA shell', async () => {
      mockResolveJobDescriptionInput.mockResolvedValue({
        text: '',
        inputType: 'url',
        extractedUrl: validBody.url,
        isEmptyShell: true,
      });

      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.failure_mode).toBe('empty_shell');
      expect(data.data.source_url).toBe(validBody.url);
    });
  });

  describe('error handling', () => {
    it('returns 400 when JobDescriptionInputError is thrown (network failure)', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Could not fetch the job posting.')
      );

      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { error: { message: string } };

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Could not fetch');
    });

    it('returns 400 when URL is blocked by SSRF validator', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('This URL is not allowed. Please provide the job description text directly.')
      );

      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest({ url: 'http://192.168.1.1/jobs' }));
      expect(response.status).toBe(400);
    });

    it('returns 500 on unexpected errors', async () => {
      mockResolveJobDescriptionInput.mockRejectedValue(new Error('Unexpected failure'));

      const { POST } = await import('@/app/api/v1/extract-job-description/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(500);
    });
  });
});
