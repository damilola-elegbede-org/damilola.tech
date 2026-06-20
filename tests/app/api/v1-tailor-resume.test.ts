/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    tailorResume: { key: 'tailor-resume', limit: 100, windowSeconds: 3600 },
  },
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    name: 'Damilola Elegbede',
    title: 'Sr. Engineering Manager',
    experiences: [
      {
        id: 'visa',
        company: 'Visa',
        title: 'Sr. Manager, DX',
        highlights: [
          'Led platform investments improving engineering velocity across Visa.',
          'Drove CI/CD improvements reducing cycle time.',
        ],
      },
      {
        id: 'verily',
        company: 'Verily Life Sciences',
        title: 'Engineering Manager',
        highlights: [
          'Architected GCP cloud transformation supporting 30+ production systems.',
          'Built and scaled Cloud Infrastructure team to 13 engineers.',
        ],
      },
    ],
  },
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const MOCK_CLAUDE_RESPONSE = {
  top_bullets: [
    'Architected GCP cloud transformation supporting 30+ production systems.',
    'Led platform investments improving engineering velocity across Visa.',
  ],
  rationale: 'These bullets best align with the cloud infrastructure focus of this role.',
  skills_match: ['GCP', 'Cloud Infrastructure', 'Platform Engineering'],
};

describe('v1/tailor-resume API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
    });
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 99 });
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_CLAUDE_RESPONSE) }],
    });
  });

  async function callRoute(body: unknown, headers: Record<string, string> = {}) {
    const { POST } = await import('@/app/api/v1/tailor-resume/route');
    const req = new Request('http://localhost/api/v1/tailor-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return POST(req);
  }

  it('returns 401 when DK_API_KEY is missing', async () => {
    mockRequireApiKey.mockResolvedValue(
      Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'API key required.' } }, { status: 401 })
    );
    const res = await callRoute({ job_description: 'Looking for a cloud engineer.' });
    expect(res.status).toBe(401);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('returns 400 when job_description is empty', async () => {
    const res = await callRoute({ job_description: '' });
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when job_description is missing', async () => {
    const res = await callRoute({});
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns top_bullets, rationale, and skills_match for a valid JD', async () => {
    const res = await callRoute({ job_description: 'We are looking for a cloud infrastructure leader.' });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: { top_bullets: string[]; rationale: string; skills_match: string[] };
    };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.top_bullets)).toBe(true);
    expect(json.data.top_bullets.length).toBeGreaterThan(0);
    expect(typeof json.data.rationale).toBe('string');
    expect(Array.isArray(json.data.skills_match)).toBe(true);
  });

  it('respects max_bullets parameter', async () => {
    const capped: typeof MOCK_CLAUDE_RESPONSE = {
      top_bullets: ['Architected GCP cloud transformation supporting 30+ production systems.'],
      rationale: 'Top 1 bullet selected.',
      skills_match: ['GCP'],
    };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(capped) }],
    });
    const res = await callRoute({ job_description: 'Cloud infrastructure role.', max_bullets: 1 });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { top_bullets: string[] } };
    expect(json.success).toBe(true);
    // Claude returned 1; verify we pass through the response faithfully
    expect(json.data.top_bullets).toHaveLength(1);
  });

  it('clamps max_bullets to 10 when caller requests more', async () => {
    await callRoute({ job_description: 'Cloud infrastructure role.', max_bullets: 50 });
    const callArgs = mockCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const prompt = callArgs.messages[0].content as string;
    // Prompt should reflect the clamped value (10), not 50
    expect(prompt).toContain('10 most relevant bullets');
    expect(prompt).not.toContain('50 most relevant bullets');
  });

  it('enforces max_bullets server-side when model returns more bullets than requested', async () => {
    const overage: typeof MOCK_CLAUDE_RESPONSE = {
      top_bullets: [
        'Bullet A', 'Bullet B', 'Bullet C', 'Bullet D', 'Bullet E',
        'Bullet F', 'Bullet G', 'Bullet H', 'Bullet I', 'Bullet J',
        'Bullet K', // 11th — should be sliced off
      ],
      rationale: 'Returned too many bullets.',
      skills_match: [],
    };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(overage) }],
    });
    const res = await callRoute({ job_description: 'Cloud infrastructure role.', max_bullets: 3 });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { top_bullets: string[] } };
    expect(json.success).toBe(true);
    expect(json.data.top_bullets).toHaveLength(3);
  });

  it('strips company prefix from bullets returned by model', async () => {
    const withPrefix: typeof MOCK_CLAUDE_RESPONSE = {
      top_bullets: [
        '[Visa — Sr. Manager, DX] Led platform investments improving engineering velocity.',
        'Built and scaled Cloud Infrastructure team to 13 engineers.',
      ],
      rationale: 'Platform focus matches.',
      skills_match: ['Platform Engineering'],
    };
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(withPrefix) }],
    });
    const res = await callRoute({ job_description: 'Platform engineering role.' });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { top_bullets: string[] } };
    expect(json.data.top_bullets[0]).toBe('Led platform investments improving engineering velocity.');
    expect(json.data.top_bullets[1]).toBe('Built and scaled Cloud Infrastructure team to 13 engineers.');
  });

  it('uses claude-sonnet-4-6 model', async () => {
    await callRoute({ job_description: 'We need an engineering leader.' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    );
  });

  it('returns 429 when rate limited', async () => {
    mockCheckGenericRateLimit.mockResolvedValue({ limited: true, retryAfter: 60 });
    const res = await callRoute({ job_description: 'Looking for an engineer.' });
    expect(res.status).toBe(429);
  });

  it('logs api_tailor_resume audit event on success', async () => {
    await callRoute({ job_description: 'Cloud infrastructure role.' });
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_tailor_resume',
      expect.objectContaining({ id: 'key-1' }),
      expect.any(Object),
      expect.any(String)
    );
  });

  it('returns 500 when Claude returns unparseable JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This is not valid JSON at all.' }],
    });
    const res = await callRoute({ job_description: 'Cloud infrastructure role.' });
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INTERNAL_ERROR');
  });
});
