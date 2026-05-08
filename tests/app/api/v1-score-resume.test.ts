/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

const mockCheckGenericRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  checkGenericRateLimit: (...args: unknown[]) => mockCheckGenericRateLimit(...args),
  RATE_LIMIT_CONFIGS: {
    resumeGenerator: { key: 'resume-generator', limit: 10, windowSeconds: 3600 },
  },
}));

const mockCalculateReadinessScore = vi.fn();
const mockResumeDataToText = vi.fn();
vi.mock('@/lib/readiness-scorer', () => ({
  calculateReadinessScore: (...args: unknown[]) => mockCalculateReadinessScore(...args),
  resumeDataToText: (...args: unknown[]) => mockResumeDataToText(...args),
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    title: 'Engineering Manager',
    name: 'Damilola',
    brandingStatement: 'Summary',
    skills: [{ category: 'Cloud', items: ['AWS', 'GCP'] }],
    experiences: [{ title: 'EM', company: 'Verily', highlights: ['Did thing'] }],
    education: [{ degree: 'MBA', institution: 'School' }],
  },
}));

vi.mock('@/lib/score-utils', () => ({
  sanitizeBreakdown: (breakdown: Record<string, number>) => breakdown,
  sanitizeScoreValue: (value: unknown, min: number, max: number) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.max(min, Math.min(max, numeric));
  },
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe('v1/score-resume API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
    });
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 9 });
    mockResumeDataToText.mockReturnValue('resume text');
    mockCalculateReadinessScore.mockReturnValue({
      total: 64,
      breakdown: {
        roleRelevance: 25,
        claritySkimmability: 18,
        businessImpact: 14,
        presentationQuality: 7,
      },
      isOptimized: true,
      details: {
        matchedKeywords: ['cloud', 'kubernetes'],
        missingKeywords: ['terraform', 'cost optimization'],
        matchRate: 45.2,
        keywordDensity: 2.1,
      },
    });
    mockCreate.mockResolvedValue({
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: '{"gapAnalysis":"Needs stronger infra depth.","maxPossibleScore":89,"recommendation":"full_generation_recommended"}' }],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('authentication', () => {
    it('returns 401 when API key is missing', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'missing' } }, { status: 401 })
      );

      const { POST } = await import('@/app/api/v1/score-resume/route');
      const response = await POST(new Request('http://localhost/api/v1/score-resume', { method: 'POST' }));
      expect(response.status).toBe(401);
    });

    it('returns 401 when API key is invalid', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'invalid' } }, { status: 401 })
      );

      const { POST } = await import('@/app/api/v1/score-resume/route');
      const response = await POST(new Request('http://localhost/api/v1/score-resume', { method: 'POST' }));
      expect(response.status).toBe(401);
    });

    it('returns 403 when API key is revoked', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'revoked' } }, { status: 403 })
      );

      const { POST } = await import('@/app/api/v1/score-resume/route');
      const response = await POST(new Request('http://localhost/api/v1/score-resume', { method: 'POST' }));
      expect(response.status).toBe(403);
    });
  });

  it('returns 400 for missing input', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns score and AI analysis for text input', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text with requirements and responsibilities' }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.currentScore.total).toBe(64);
    expect(data.data.maxPossibleScore).toBe(89);
    expect(data.data.recommendation).toBe('full_generation_recommended');
    expect(mockCalculateReadinessScore).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_score_resume',
      expect.any(Object),
      expect.objectContaining({ inputType: 'text', currentScore: 64 }),
      '127.0.0.1'
    );
  });

  it('fetches URL input before scoring', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '200' }),
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new TextEncoder().encode(`<html><body>Job description responsibilities requirements qualifications experience skills about the role what we're looking for minimum requirements preferred qualifications and extensive details for senior engineering leadership cloud infrastructure kubernetes terraform cost optimization distributed systems observability and delivery excellence with measurable outcomes and team management expectations for this position. Duties include driving technical roadmap, managing oncall rotations, and hiring senior engineers. Apply now to join the platform team.</body></html>`) };
            },
            releaseLock: () => {},
          };
        },
      },
    } as unknown as Response);

    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'https://8.8.8.8/job' }),
      })
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    mockCheckGenericRateLimit.mockResolvedValue({ limited: true, remaining: 0, retryAfter: 60 });

    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text' }),
      })
    );

    expect(response.status).toBe(429);
  });

  it('returns 500 on Anthropic failure', async () => {
    mockCreate.mockRejectedValue(new Error('Anthropic down'));

    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text' }),
      })
    );

    expect(response.status).toBe(500);
  });
});
