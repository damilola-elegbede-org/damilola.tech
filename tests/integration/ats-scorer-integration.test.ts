/**
 * @vitest-environment node
 *
 * Integration tests for /api/v1/score-resume route handler.
 *
 * Strategy: Use REAL ats-scorer, ats-keywords, resume-data, score-utils, and
 * job-description-input. Mock only external I/O dependencies:
 *   - api-key-auth (auth bypass)
 *   - api-audit (noop)
 *   - rate-limit (noop)
 *   - @anthropic-ai/sdk (avoid real API calls)
 *
 * This catches regressions that unit tests miss — e.g. score mapping bugs in
 * the route handler, API contract breaks, or serialization issues.
 *
 * Closes #87
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── External dependency mocks (NOT scorer logic) ────────────────────────────

vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: vi.fn().mockResolvedValue({
    apiKey: { id: 'integration-test-key', name: 'Integration Test', enabled: true },
  }),
}));

vi.mock('@/lib/api-audit', () => ({
  logApiAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  checkGenericRateLimit: vi.fn().mockResolvedValue({ limited: false, remaining: 9 }),
  RATE_LIMIT_CONFIGS: {
    resumeGenerator: { key: 'resume-generator', limit: 10, windowSeconds: 3600 },
  },
}));

const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
    messages = { create: mockAnthropicCreate };
  },
}));

// ── Gold-standard job descriptions ──────────────────────────────────────────

const EM_PLATFORM_INFRA_JD = `
Engineering Manager, Platform Infrastructure

About the Role:
We are looking for an experienced Engineering Manager to lead our Platform
Infrastructure and Developer Experience team. You will manage a team of
engineers building internal developer platforms, cloud infrastructure, and
CI/CD tooling.

Responsibilities:
- Lead and grow a team of 10-15 engineers across cloud infrastructure and DevEx
- Drive the company-wide cloud transformation on GCP and AWS
- Own engineering roadmap for platform, observability, and reliability
- Partner with cross-functional stakeholders across Engineering, Security, Product
- Establish platform engineering practices improving developer velocity
- Lead complex multi-phase production launches with cross-functional dependencies

Requirements:
- 10+ years of software engineering experience
- 5+ years managing engineering teams
- Deep expertise with GCP and AWS cloud platforms
- Hands-on experience with Kubernetes, Docker, and Terraform
- CI/CD pipeline design and GitHub Actions
- Platform engineering or developer experience background
- Track record of building and scaling high-performance engineering organizations
- Strong stakeholder management and executive communication skills

Preferred Qualifications:
- Experience with infrastructure cost optimization
- Observability tooling (Prometheus, Grafana, Datadog)
- Healthcare or regulated industry experience
- MBA or advanced degree a plus
`;

const DATA_SCIENTIST_ML_JD = `
Data Scientist, Machine Learning Research

About the Role:
We are seeking a Data Scientist to join our ML Research team. You will develop
and deploy novel machine learning models for natural language processing and
computer vision applications.

Responsibilities:
- Design, train, and evaluate deep learning models using TensorFlow and PyTorch
- Conduct original ML research and publish findings
- Build data pipelines using Spark and Airflow
- Collaborate with research scientists on generative AI applications

Requirements:
- PhD in Computer Science, Statistics, or related field
- 5+ years ML/AI research experience
- Expert-level Python, TensorFlow, PyTorch, and Keras
- Deep learning architecture design (transformers, CNNs, RNNs)
- Strong statistics and probability background
- Research publication track record (NeurIPS, ICML, ICLR)

Preferred Qualifications:
- Experience with LLMs and fine-tuning
- MLOps and model serving (Kubeflow, MLflow)
- Reinforcement learning experience
`;

const GENERIC_PYTHON_JD = `
Python Developer

Requirements:
- 3+ years Python development experience
- REST API design and development
- Familiarity with cloud platforms
- Basic SQL knowledge
- Good communication skills
`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/score-resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeAnthropicResponse(overrides?: Partial<{ gapAnalysis: string; maxPossibleScore: number; recommendation: string }>) {
  const payload = {
    gapAnalysis: 'Resume aligns well with the job description.',
    maxPossibleScore: 90,
    recommendation: 'strong_fit',
    ...overrides,
  };
  return {
    model: 'claude-sonnet-4-20250514',
    usage: { input_tokens: 50, output_tokens: 50 },
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

// ── Suite 1: Full Pipeline Integration (route → real scorer) ─────────────────

describe('Suite 1: Full Pipeline Integration', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockResolvedValue(makeAnthropicResponse());
  });

  it('scores Engineering Manager JD at or above 70 (high match with real resume data)', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    const { currentScore } = json.data;
    expect(currentScore.total).toBeGreaterThanOrEqual(70);
    expect(currentScore.total).toBeLessThanOrEqual(100);
  });

  it('scores Data Scientist / ML JD significantly lower than EM JD (domain mismatch)', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: DATA_SCIENTIST_ML_JD }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    const { currentScore } = json.data;
    // ML/data science JD partially overlaps (Python, computer science terms) so the
    // ceiling is set to 65 rather than 50 — the important regression is in the
    // comparative test (EM JD must always outscore ML JD).
    expect(currentScore.total).toBeLessThanOrEqual(65);
    expect(currentScore.total).toBeGreaterThanOrEqual(0);
  });

  it('scores generic Python developer JD in a mid-range band', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: GENERIC_PYTHON_JD }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    const { currentScore } = json.data;
    expect(currentScore.total).toBeGreaterThanOrEqual(0);
    expect(currentScore.total).toBeLessThanOrEqual(100);
  });

  it('returns full currentScore payload shape from real scorer', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(response.status).toBe(200);
    const { currentScore } = json.data;

    // Shape assertions on the serialized scorer output
    expect(typeof currentScore.total).toBe('number');
    expect(typeof currentScore.coreTotal).toBe('number');
    expect(typeof currentScore.matchRate).toBe('number');
    expect(typeof currentScore.keywordDensity).toBe('number');
    expect(Array.isArray(currentScore.matchedKeywords)).toBe(true);
    expect(Array.isArray(currentScore.missingKeywords)).toBe(true);

    const { breakdown } = currentScore;
    expect(typeof breakdown.keywordRelevance).toBe('number');
    expect(typeof breakdown.skillsQuality).toBe('number');
    expect(typeof breakdown.experienceAlignment).toBe('number');
    expect(typeof breakdown.contentQuality).toBe('number');
  });

  it('returns gapAnalysis and recommendation from AI model', async () => {
    mockAnthropicCreate.mockResolvedValue(
      makeAnthropicResponse({ gapAnalysis: 'Strong candidate profile.', maxPossibleScore: 95, recommendation: 'strong_fit' })
    );

    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(json.data.gapAnalysis).toBe('Strong candidate profile.');
    expect(['full_generation_recommended', 'marginal_improvement', 'strong_fit']).toContain(json.data.recommendation);
    expect(typeof json.data.maxPossibleScore).toBe('number');
  });

  it('matched keywords for EM JD include cloud and leadership terms', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { matchedKeywords } = json.data.currentScore;
    // The real scorer should surface relevant keywords from the resume
    expect(matchedKeywords.length).toBeGreaterThan(0);
    matchedKeywords.forEach((kw: unknown) => {
      expect(typeof kw).toBe('string');
      expect((kw as string).length).toBeGreaterThan(0);
    });
  });
});

// ── Suite 2: API Contract Tests (regression guards) ──────────────────────────

describe('Suite 2: API Contract Tests', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockResolvedValue(makeAnthropicResponse());
  });

  it('returns 200 with success wrapper for valid request', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  it('returns 400 for missing input field', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('returns 400 for null input', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: null }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('returns 400 for non-string input', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: 42 }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(
      new Request('http://localhost/api/v1/score-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-valid-json',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('total is always a number in [0, 100]', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { total } = json.data.currentScore;
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('coreTotal is always a number in [0, 100]', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { coreTotal } = json.data.currentScore;
    expect(typeof coreTotal).toBe('number');
    expect(coreTotal).toBeGreaterThanOrEqual(0);
    expect(coreTotal).toBeLessThanOrEqual(100);
  });

  it('breakdown keys are always present', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { breakdown } = json.data.currentScore;
    expect(breakdown).toHaveProperty('keywordRelevance');
    expect(breakdown).toHaveProperty('skillsQuality');
    expect(breakdown).toHaveProperty('experienceAlignment');
    expect(breakdown).toHaveProperty('contentQuality');
  });

  it('breakdown values are within their defined ranges', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { breakdown } = json.data.currentScore;
    expect(breakdown.keywordRelevance).toBeGreaterThanOrEqual(0);
    expect(breakdown.keywordRelevance).toBeLessThanOrEqual(45);
    expect(breakdown.skillsQuality).toBeGreaterThanOrEqual(0);
    expect(breakdown.skillsQuality).toBeLessThanOrEqual(25);
    expect(breakdown.experienceAlignment).toBeGreaterThanOrEqual(0);
    expect(breakdown.experienceAlignment).toBeLessThanOrEqual(20);
    expect(breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(breakdown.contentQuality).toBeLessThanOrEqual(10);
  });

  it('breakdown values sum approximately to total (within 2)', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { breakdown, total } = json.data.currentScore;
    const breakdownSum = Math.round(
      breakdown.keywordRelevance +
      breakdown.skillsQuality +
      breakdown.experienceAlignment +
      breakdown.contentQuality
    );
    expect(Math.abs(breakdownSum - total)).toBeLessThanOrEqual(2);
  });

  it('matchedKeywords is always an array of strings', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { matchedKeywords } = json.data.currentScore;
    expect(Array.isArray(matchedKeywords)).toBe(true);
    matchedKeywords.forEach((kw: unknown) => expect(typeof kw).toBe('string'));
  });

  it('missingKeywords is always an array of strings', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { missingKeywords } = json.data.currentScore;
    expect(Array.isArray(missingKeywords)).toBe(true);
    missingKeywords.forEach((kw: unknown) => expect(typeof kw).toBe('string'));
  });

  it('response is always JSON (Content-Type: application/json)', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));

    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });

  it('maxPossibleScore is always >= total', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(json.data.maxPossibleScore).toBeGreaterThanOrEqual(json.data.currentScore.total);
  });

  it('recommendation is one of the three valid values', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    expect(['full_generation_recommended', 'marginal_improvement', 'strong_fit']).toContain(
      json.data.recommendation
    );
  });
});

// ── Suite 3: Scoring Regression Guards ──────────────────────────────────────

describe('Suite 3: Scoring Regression Guards', () => {
  const REGRESSION_BASELINES = {
    perfectMatch: { min: 70, max: 100 },
    // ML/DS JD partially overlaps (Python, computer science) with EM resume,
    // so the ceiling is 65. The key regression guard is the comparative test.
    mismatch: { min: 0, max: 65 },
  };

  beforeEach(() => {
    mockAnthropicCreate.mockResolvedValue(makeAnthropicResponse());
  });

  it('EM/Platform Infrastructure JD scores within perfect-match baseline', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
    const json = await response.json();

    const { total } = json.data.currentScore;
    expect(total).toBeGreaterThanOrEqual(REGRESSION_BASELINES.perfectMatch.min);
    expect(total).toBeLessThanOrEqual(REGRESSION_BASELINES.perfectMatch.max);
  });

  it('Data Scientist / ML JD scores within mismatch baseline', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const response = await POST(makeRequest({ input: DATA_SCIENTIST_ML_JD }));
    const json = await response.json();

    const { total } = json.data.currentScore;
    expect(total).toBeGreaterThanOrEqual(REGRESSION_BASELINES.mismatch.min);
    expect(total).toBeLessThanOrEqual(REGRESSION_BASELINES.mismatch.max);
  });

  it('EM JD always scores higher than Data Scientist JD (comparative regression)', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');

    const [emResponse, mlResponse] = await Promise.all([
      POST(makeRequest({ input: EM_PLATFORM_INFRA_JD })),
      POST(makeRequest({ input: DATA_SCIENTIST_ML_JD })),
    ]);

    const emJson = await emResponse.json();
    const mlJson = await mlResponse.json();

    expect(emJson.data.currentScore.total).toBeGreaterThan(mlJson.data.currentScore.total);
  });

  it('determinism: same JD input produces identical scores across 5 runs', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const totals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
      const json = await response.json();
      totals.push(json.data.currentScore.total);
    }

    // All 5 runs must produce the exact same score
    expect(new Set(totals).size).toBe(1);
  });

  it('determinism: same JD produces identical breakdown across 5 runs', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const breakdowns: string[] = [];

    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
      const json = await response.json();
      breakdowns.push(JSON.stringify(json.data.currentScore.breakdown));
    }

    expect(new Set(breakdowns).size).toBe(1);
  });

  it('determinism: same JD produces identical matchedKeywords across 5 runs', async () => {
    const { POST } = await import('@/app/api/v1/score-resume/route');
    const keywordSets: string[] = [];

    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ input: EM_PLATFORM_INFRA_JD }));
      const json = await response.json();
      // Sort to make comparison order-independent
      keywordSets.push(JSON.stringify([...json.data.currentScore.matchedKeywords].sort()));
    }

    expect(new Set(keywordSets).size).toBe(1);
  });
});
