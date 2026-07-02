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
const mockResolvePreFetchedJobDescription = vi.fn();
vi.mock('@/lib/job-description-input', () => ({
  resolveJobDescriptionInput: (...args: unknown[]) => mockResolveJobDescriptionInput(...args),
  resolvePreFetchedJobDescription: (...args: unknown[]) => mockResolvePreFetchedJobDescription(...args),
  JobDescriptionInputError: class JobDescriptionInputError extends Error {
    failureMode: string;
    constructor(message: string, failureMode: string) {
      super(message);
      this.name = 'JobDescriptionInputError';
      this.failureMode = failureMode;
    }
  },
}));

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  })),
}));

// Mock api-audit
const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock score-core (to isolate route logic)
const mockBuildScoringInput = vi.fn();
const mockBuildScorePayload = vi.fn();
const mockBuildGapAnalysisPrompt = vi.fn();
const mockExtractTextContent = vi.fn();
const mockParseJsonResponse = vi.fn();
vi.mock('@/lib/score-core', () => ({
  buildScoringInput: (...args: unknown[]) => mockBuildScoringInput(...args),
  buildScorePayload: (...args: unknown[]) => mockBuildScorePayload(...args),
  buildGapAnalysisPrompt: (...args: unknown[]) => mockBuildGapAnalysisPrompt(...args),
  extractTextContent: (...args: unknown[]) => mockExtractTextContent(...args),
  parseJsonResponse: (...args: unknown[]) => mockParseJsonResponse(...args),
  scoringClient: {
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

const mockValidApiKey = {
  apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
};

const validBody = {
  url: 'https://example.com/jobs/senior-engineer',
  title: 'Senior Software Engineer',
  company: 'Acme Corp',
};

const mockScore = {
  total: 75,
  breakdown: {
    roleRelevance: 22,
    claritySkimmability: 22,
    businessImpact: 18,
    presentationQuality: 13,
  },
  matchedKeywords: ['typescript', 'node'],
  missingKeywords: ['kubernetes'],
  matchRate: 70,
  keywordDensity: 5.0,
};

const mockAnthropicResponse = {
  content: [{ type: 'text', text: '{"gapAnalysis":"Strong fit.","maxPossibleScore":88,"recommendation":"marginal_improvement"}' }],
};

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/v1/score-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/v1/score-job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 9 });
    mockResolveJobDescriptionInput.mockResolvedValue({
      text: 'Senior Software Engineer at Acme Corp. TypeScript, Node.js required.',
      inputType: 'url',
      extractedUrl: 'https://example.com/jobs/senior-engineer',
    });
    mockResolvePreFetchedJobDescription.mockReturnValue({
      text: 'Senior Software Engineer at Acme Corp. TypeScript, Node.js required. Responsibilities include API design.',
      inputType: 'content',
      extractedUrl: 'https://example.com/jobs/senior-engineer',
    });
    mockBuildScoringInput.mockReturnValue({ readinessScore: { total: 75, breakdown: {}, details: {} } });
    mockBuildScorePayload.mockReturnValue(mockScore);
    mockBuildGapAnalysisPrompt.mockReturnValue('Analyze this...');
    mockCreate.mockResolvedValue(mockAnthropicResponse);
    mockExtractTextContent.mockReturnValue('{"gapAnalysis":"Strong fit.","maxPossibleScore":88,"recommendation":"marginal_improvement"}');
    mockParseJsonResponse.mockReturnValue({
      gapAnalysis: 'Strong fit.',
      maxPossibleScore: 88,
      recommendation: 'marginal_improvement',
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

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(401);
    });
  });

  describe('validation', () => {
    it('returns 400 when body is invalid JSON', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const req = new Request('http://localhost/api/v1/score-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when url is missing', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const { url: _url, ...rest } = validBody;
      void _url;
      const response = await POST(makeRequest(rest));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when title is missing', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const { title: _title, ...rest } = validBody;
      void _title;
      const response = await POST(makeRequest(rest));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when company is missing', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const { company: _company, ...rest } = validBody;
      void _company;
      const response = await POST(makeRequest(rest));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when url is not a valid URL string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, url: 123 }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when url is a malformed string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, url: 'not-a-url' }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when body is a JSON array', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const req = new Request('http://localhost/api/v1/score-job', {
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
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(429);
    });
  });

  describe('success', () => {
    it('returns 200 with company, title, url, and scoring fields', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.company).toBe('Acme Corp');
      expect(data.data.title).toBe('Senior Software Engineer');
      expect(data.data.url).toBe('https://example.com/jobs/senior-engineer');
      expect(data.data.currentScore).toBeDefined();
      expect(data.data.maxPossibleScore).toBeDefined();
      expect(data.data.gapAnalysis).toBe('Strong fit.');
      expect(data.data.recommendation).toBe('marginal_improvement');
    });

    it('calls resolveJobDescriptionInput with the url', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest(validBody));
      expect(mockResolveJobDescriptionInput).toHaveBeenCalledWith(
        'https://example.com/jobs/senior-engineer',
        expect.any(String)
      );
    });

    it('calls logApiAccess with api_score_job event type', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest(validBody));
      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_score_job',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          company: 'Acme Corp',
          title: 'Senior Software Engineer',
        }),
        '127.0.0.1'
      );
    });

    it('returns recommendation strong_fit when gap < 5', async () => {
      mockBuildScorePayload.mockReturnValue({ ...mockScore, total: 85 });
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Excellent.',
        maxPossibleScore: 87,
        recommendation: 'strong_fit',
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { data: { recommendation: string } };
      expect(data.data.recommendation).toBe('strong_fit');
    });

    it('returns recommendation full_generation_recommended when gap > 15', async () => {
      mockBuildScorePayload.mockReturnValue({ ...mockScore, total: 50 });
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Large gap.',
        maxPossibleScore: 90,
        recommendation: 'full_generation_recommended',
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { data: { recommendation: string } };
      expect(data.data.recommendation).toBe('full_generation_recommended');
    });
  });

  describe('pre-fetched job_content', () => {
    it('uses pre-fetched content when job_content is provided and does not call URL fetch', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({
        ...validBody,
        job_content: '<html><body>Senior Engineer responsibilities and qualifications here.</body></html>',
      }));
      expect(response.status).toBe(200);
      expect(mockResolvePreFetchedJobDescription).toHaveBeenCalledTimes(1);
      expect(mockResolveJobDescriptionInput).not.toHaveBeenCalled();
    });

    it('passes job_content and url to resolvePreFetchedJobDescription', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest({
        ...validBody,
        job_content: 'Plain text responsibilities and qualifications for the role.',
      }));
      expect(mockResolvePreFetchedJobDescription).toHaveBeenCalledWith(
        'Plain text responsibilities and qualifications for the role.',
        'https://example.com/jobs/senior-engineer'
      );
    });

    it('falls back to URL fetch when job_content is empty string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, job_content: '' }));
      expect(response.status).toBe(200);
      expect(mockResolveJobDescriptionInput).toHaveBeenCalledTimes(1);
      expect(mockResolvePreFetchedJobDescription).not.toHaveBeenCalled();
    });

    it('returns 400 when job_content is not a string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, job_content: 12345 }));
      const data = await response.json() as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when job_content exceeds the size limit', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const oversized = 'x'.repeat(201 * 1024);
      const response = await POST(makeRequest({ ...validBody, job_content: oversized }));
      expect(response.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('returns 400 when JobDescriptionInputError is thrown', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Cannot fetch URL', 'posting_404')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(400);
    });

    it('includes failure_mode in 400 response for empty_body_spa', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Content too short.', 'empty_body_spa')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: false; error: { code: string; message: string; failure_mode: string } };
      expect(response.status).toBe(400);
      expect(data.error.failure_mode).toBe('empty_body_spa');
    });

    it('includes failure_mode in 400 response for ua_blocked', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Access denied.', 'ua_blocked')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: false; error: { failure_mode: string } };
      expect(response.status).toBe(400);
      expect(data.error.failure_mode).toBe('ua_blocked');
    });

    it('includes failure_mode in 400 response for posting_404', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Job posting not found.', 'posting_404')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: false; error: { failure_mode: string } };
      expect(response.status).toBe(400);
      expect(data.error.failure_mode).toBe('posting_404');
    });

    it('includes failure_mode in 400 response for not_jd_content', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Not a job description.', 'not_jd_content')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: false; error: { failure_mode: string } };
      expect(response.status).toBe(400);
      expect(data.error.failure_mode).toBe('not_jd_content');
    });

    it('includes failure_mode in 400 response for fetch_timeout', async () => {
      const { JobDescriptionInputError } = await import('@/lib/job-description-input');
      mockResolveJobDescriptionInput.mockRejectedValue(
        new JobDescriptionInputError('Request timed out.', 'fetch_timeout')
      );

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: false; error: { failure_mode: string } };
      expect(response.status).toBe(400);
      expect(data.error.failure_mode).toBe('fetch_timeout');
    });

    it('returns 500 on unexpected errors', async () => {
      mockCreate.mockRejectedValue(new Error('Anthropic down'));

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      expect(response.status).toBe(500);
    });
  });
});
