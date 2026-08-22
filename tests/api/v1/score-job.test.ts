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
  RATE_LIMIT_CONFIGS: {
    resumeGenerator: { key: 'resume-generator', limit: 100, windowSeconds: 3600 },
    scoreJobAuthenticated: { key: 'score-job-authenticated', limit: 600, windowSeconds: 3600 },
  },
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
const mockExtractTextContent = vi.fn();
const mockParseJsonResponse = vi.fn();
const mockBuildScoringInput = vi.fn();
const mockBuildScorePayload = vi.fn();
const mockBuildGapAnalysisPrompt = vi.fn();
vi.mock('@/lib/score-core', () => ({
  extractTextContent: (...args: unknown[]) => mockExtractTextContent(...args),
  parseJsonResponse: (...args: unknown[]) => mockParseJsonResponse(...args),
  buildScoringInput: (...args: unknown[]) => mockBuildScoringInput(...args),
  buildResumeText: () => 'RESUME TEXT',
  buildScorePayload: (...args: unknown[]) => mockBuildScorePayload(...args),
  buildGapAnalysisPrompt: (...args: unknown[]) => mockBuildGapAnalysisPrompt(...args),
  scoringClient: {
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// Mock the Fit Score scorer (to isolate route logic — fit-score.test.ts is the
// source of truth for gate/component correctness against D's rubric).
const mockEvaluateFitGates = vi.fn();
const mockAssembleFitScore = vi.fn();
const mockGatedFitResult = vi.fn();
vi.mock('@/lib/fit-score', () => ({
  evaluateFitGates: (...args: unknown[]) => mockEvaluateFitGates(...args),
  assembleFitScore: (...args: unknown[]) => mockAssembleFitScore(...args),
  gatedFitResult: (...args: unknown[]) => mockGatedFitResult(...args),
  FIT_SCORE_SURFACE: 80,
}));

const mockScoreExperienceDimensions = vi.fn();
vi.mock('@/lib/fit-experience', () => ({
  scoreExperienceDimensions: (...args: unknown[]) => mockScoreExperienceDimensions(...args),
}));

const passingGates = {
  failed: [] as string[],
  evidence: {} as Record<string, string>,
  normalized: 'senior engineering manager',
  head: 'senior engineering manager',
  tail: '',
  geo: 'us',
  maxStatedSalary: null,
  posture: 'unknown',
};

const defaultFitResult = {
  total: 83,
  gateFailed: [] as string[],
  gateEvidence: {} as Record<string, string>,
  breakdown: { experience: 30, title: 25, comp: 20, remote: 8 },
  flags: ['comp_undisclosed'],
  titleTier: 'exact',
  remotePosture: 'hub-flex',
  experienceRaw: 9,
};

const defaultExperienceDimensions = [
  {
    dimension: 'requirement_coverage',
    score: 3,
    band: 'strong',
    resumeQuote: 'Led platform engineering',
    jdQuote: 'lead platform engineering',
    evidenceRejected: false,
    optionOrder: [],
  },
  {
    dimension: 'domain_evidence',
    score: 3,
    band: 'strong',
    resumeQuote: 'CI/CD pipeline design',
    jdQuote: 'CI/CD',
    evidenceRejected: false,
    optionOrder: [],
  },
  {
    dimension: 'leadership_evidence',
    score: 3,
    band: 'strong',
    resumeQuote: 'Hired and developed engineers',
    jdQuote: 'hiring',
    evidenceRejected: false,
    optionOrder: [],
  },
];

const mockValidApiKey = {
  apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
};

const validBody = {
  url: 'https://example.com/jobs/senior-engineering-manager',
  title: 'Senior Engineering Manager',
  company: 'Acme Corp',
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
      text: 'Senior Engineering Manager at Acme Corp. TypeScript, Node.js required.',
      inputType: 'url',
      extractedUrl: 'https://example.com/jobs/senior-engineering-manager',
    });
    mockResolvePreFetchedJobDescription.mockReturnValue({
      text: 'Senior Engineering Manager at Acme Corp. TypeScript, Node.js required. Responsibilities include API design.',
      inputType: 'content',
      extractedUrl: 'https://example.com/jobs/senior-engineering-manager',
    });
    mockEvaluateFitGates.mockReturnValue(passingGates);
    mockAssembleFitScore.mockReturnValue(defaultFitResult);
    mockGatedFitResult.mockImplementation((gates: { failed: string[]; evidence: Record<string, string> }) => ({
      total: 0,
      gateFailed: gates.failed,
      gateEvidence: gates.evidence,
      breakdown: { experience: 0, title: 0, comp: 0, remote: 0 },
      flags: [],
      titleTier: 'none',
      remotePosture: 'unknown',
      experienceRaw: null,
    }));
    mockScoreExperienceDimensions.mockResolvedValue(defaultExperienceDimensions);
    mockBuildScoringInput.mockReturnValue({ readinessScore: { total: 75 } });
    mockBuildScorePayload.mockReturnValue({
      total: 75,
      breakdown: { roleRelevance: 30, claritySkimmability: 20, businessImpact: 15, presentationQuality: 10 },
      matchedKeywords: ['TypeScript'],
      missingKeywords: ['Kubernetes'],
      matchRate: 50,
      keywordDensity: 3,
    });
    mockBuildGapAnalysisPrompt.mockReturnValue('Readiness prompt');
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

    // ENG-1800. score-job requires an API key (requireApiKey runs first), yet it
    // was metered under `resumeGenerator` — a 100/hr bucket keyed by IP and shared
    // with four other endpoints. A first-party authenticated batch client sat under
    // an anonymous abuse limit and hit 429 partway through every full run.
    it('meters under the authenticated score-job tier, not the shared resumeGenerator bucket', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest(validBody));

      expect(mockCheckGenericRateLimit).toHaveBeenCalledTimes(1);
      const [config] = mockCheckGenericRateLimit.mock.calls[0] as [{ key: string }];
      expect(config.key).toBe('score-job-authenticated');
    });

    it('keys the limit on the API key id, so one caller cannot exhaust another', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest(validBody));

      const [, identifier] = mockCheckGenericRateLimit.mock.calls[0] as [unknown, string];
      // 'key-1' is mockValidApiKey.apiKey.id; '127.0.0.1' is the mocked client IP.
      // Keying on IP is what let the whole fleet share one bucket from one machine.
      expect(identifier).toBe('key-1');
      expect(identifier).not.toBe('127.0.0.1');
    });
  });

  describe('success', () => {
    it('returns a zero-score knockout without calling AI and audits its reasons', async () => {
      mockEvaluateFitGates.mockReturnValue({
        ...passingGates,
        failed: ['G1_no_mgmt_signal'],
        evidence: { G1_no_mgmt_signal: 'no management-title match' },
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as {
        success: boolean;
        data: {
          fitScore: { total: number; threshold: number; surfaced: boolean };
          currentScore: { total: number; breakdown: { roleRelevance: number } };
          recommendation: string;
          knockout: { knockedOut: boolean; hardReasons: string[] };
          resumeGap: { achievable: null; closeable: null; structural: null };
        };
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.recommendation).toBe('knocked_out');
      expect(data.data.fitScore.total).toBe(0);
      expect(data.data.fitScore.surfaced).toBe(false);
      expect(mockScoreExperienceDimensions).not.toHaveBeenCalled();
      expect(data.data.currentScore.total).toBe(75);
      expect(data.data.currentScore.breakdown.roleRelevance).toBe(30);
      expect(data.data.resumeGap).toEqual({ achievable: null, closeable: null, structural: null });
      expect(data.data.knockout).toEqual(expect.objectContaining({
        knockedOut: true,
        hardReasons: expect.arrayContaining(['G1_no_mgmt_signal']),
      }));
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_score_job',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          recommendation: 'knocked_out',
          knockoutReasons: ['G1_no_mgmt_signal'],
        }),
        '127.0.0.1'
      );
    });

    it('a scored (not knocked-out) role returns knockedOut: false with no reasons', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as {
        data: { knockout: { knockedOut: boolean; hardReasons: string[] } };
      };

      expect(response.status).toBe(200);
      expect(data.data.knockout).toEqual({ knockedOut: false, hardReasons: [], gateEvidence: {} });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with company, title, url, and scoring fields', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.company).toBe('Acme Corp');
      expect(data.data.title).toBe('Senior Engineering Manager');
      expect(data.data.url).toBe('https://example.com/jobs/senior-engineering-manager');
      expect(data.data.currentScore).toBeDefined();
      expect(data.data.fitScore).toEqual(expect.objectContaining({
        total: 83,
        threshold: 80,
        surfaced: true,
        breakdown: defaultFitResult.breakdown,
        flags: ['comp_undisclosed'],
        titleTier: 'exact',
        experienceRaw: 9,
      }));
      expect(data.data.experienceEvidence).toEqual([
        expect.objectContaining({ dimension: 'requirement_coverage', score: 3 }),
        expect.objectContaining({ dimension: 'domain_evidence', score: 3 }),
        expect.objectContaining({ dimension: 'leadership_evidence', score: 3 }),
      ]);
      expect(data.data.currentScore).toEqual(expect.objectContaining({
        total: 75,
        breakdown: expect.objectContaining({ roleRelevance: 30 }),
      }));
      expect(data.data.resumeGap).toEqual({ achievable: null, closeable: null, structural: null });
      expect(data.data.maxPossibleScore).toBeDefined();
      expect(data.data.gapAnalysis).toBe('Strong fit.');
      expect(data.data.recommendation).toBe('marginal_improvement');
    });

    it('calls resolveJobDescriptionInput with the url', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest(validBody));
      expect(mockResolveJobDescriptionInput).toHaveBeenCalledWith(
        'https://example.com/jobs/senior-engineering-manager',
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
          title: 'Senior Engineering Manager',
        }),
        '127.0.0.1'
      );
    });

    it('returns recommendation strong_fit when gap < 5', async () => {
      mockBuildScorePayload.mockReturnValue({
        total: 85, breakdown: {}, matchedKeywords: [], missingKeywords: [], matchRate: 0, keywordDensity: 0,
      });
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
      mockBuildScorePayload.mockReturnValue({
        total: 50, breakdown: {}, matchedKeywords: [], missingKeywords: [], matchRate: 0, keywordDensity: 0,
      });
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
        'https://example.com/jobs/senior-engineering-manager'
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

  // ENG-1975: evaluateRoleFit takes RoleFitInput.location, but the route
  // never accepted or threaded a "location" field — structuredLocation was
  // unreachable from any caller, so G5/the 8-point location signal always
  // fell back to scraping the title tail + JD preamble.
  describe('location (ENG-1975)', () => {
    it('threads a provided location string into evaluateFitGates as structuredLocation', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest({ ...validBody, location: 'Boulder, CO, United States' }));

      expect(mockEvaluateFitGates).toHaveBeenCalledTimes(1);
      const [input] = mockEvaluateFitGates.mock.calls[0] as [{ location?: string }];
      expect(input.location).toBe('Boulder, CO, United States');
    });

    it('trims a provided location before threading it through', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      await POST(makeRequest({ ...validBody, location: '  Boulder, CO  ' }));

      const [input] = mockEvaluateFitGates.mock.calls[0] as [{ location?: string }];
      expect(input.location).toBe('Boulder, CO');
    });

    it('omits location when the caller does not send one — unchanged behavior for scrapers with no location field (AC2)', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(200);
      const [input] = mockEvaluateFitGates.mock.calls[0] as [{ location?: string }];
      expect(input.location).toBeUndefined();
    });

    it('returns 400 when location is not a string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, location: 12345 }));
      const data = (await response.json()) as { error: { code: string } };
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('does not throw when location is an empty string — falls back like omitted (AC2)', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, location: '' }));
      expect(response.status).toBe(200);
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

  describe('interview-prep mode', () => {
    const prepQuestions = [
      'Tell me about a time you designed a scalable distributed system.',
      'How would you approach leading a team through a major architectural migration?',
      'Tell me about a time you had to balance technical debt against feature velocity.',
      'How would you approach mentoring engineers on Kubernetes-based infrastructure?',
      'Tell me about a time you drove cross-functional alignment on a technical decision.',
    ];

    beforeEach(() => {
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Strong fit.',
        maxPossibleScore: 88,
        recommendation: 'marginal_improvement',
        interviewPrepQuestions: prepQuestions,
      });
    });

    it('returns interviewPrepQuestions with exactly 5 items when mode=interview-prep', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: 'interview-prep' }));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.interviewPrepQuestions)).toBe(true);
      expect((data.data.interviewPrepQuestions as string[]).length).toBe(5);
    });

    it('response does not include interviewPrepQuestions when mode is absent', async () => {
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Strong fit.',
        maxPossibleScore: 88,
        recommendation: 'marginal_improvement',
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest(validBody));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.data.interviewPrepQuestions).toBeUndefined();
    });

    it('response does not include interviewPrepQuestions when mode is null', async () => {
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Strong fit.',
        maxPossibleScore: 88,
        recommendation: 'marginal_improvement',
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: null }));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.data.interviewPrepQuestions).toBeUndefined();
    });

    it('returns 400 with Invalid mode error when mode is an unrecognized string', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: 'invalid-mode' }));
      const data = await response.json() as { error: { message: string } };

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid mode');
    });

    it('questions use behavioral framing (Tell me about or How would you)', async () => {
      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: 'interview-prep' }));
      const data = await response.json() as { data: { interviewPrepQuestions: string[] } };

      const questions = data.data.interviewPrepQuestions;
      const allBehavioral = questions.every(
        (q) => q.startsWith('Tell me about') || q.startsWith('How would you')
      );
      expect(allBehavioral).toBe(true);
    });

    it('omits interviewPrepQuestions when AI returns mixed-type array (strings and numbers)', async () => {
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Strong fit.',
        maxPossibleScore: 88,
        recommendation: 'marginal_improvement',
        interviewPrepQuestions: ['Q1', 2, 'Q3', 4, 'Q5'],
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: 'interview-prep' }));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.data.interviewPrepQuestions).toBeUndefined();
    });

    it('omits interviewPrepQuestions when AI returns fewer than 5 items', async () => {
      mockParseJsonResponse.mockReturnValue({
        gapAnalysis: 'Strong fit.',
        maxPossibleScore: 88,
        recommendation: 'marginal_improvement',
        interviewPrepQuestions: ['Q1', 'Q2', 'Q3'],
      });

      const { POST } = await import('@/app/api/v1/score-job/route');
      const response = await POST(makeRequest({ ...validBody, mode: 'interview-prep' }));
      const data = await response.json() as { success: boolean; data: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(data.data.interviewPrepQuestions).toBeUndefined();
    });
  });
});
