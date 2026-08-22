/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEAL_JD, PASTRY_JD } from '@/lib/__tests__/fixtures/probe-jds';

const mockCreate = vi.fn();
const mockScoreAts = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({ requireApiKey: vi.fn().mockResolvedValue({ apiKey: { id: 'test' } }) }));
vi.mock('@/lib/api-audit', () => ({ logApiAccess: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ getClientIp: () => '127.0.0.1', checkGenericRateLimit: vi.fn().mockResolvedValue({ limited: false }), RATE_LIMIT_CONFIGS: { resumeGenerator: {} } }));
vi.mock('@/lib/resume-generator-prompt', () => ({ getResumeGeneratorPrompt: vi.fn().mockResolvedValue('prompt') }));
vi.mock('@/lib/score-core', () => ({
  buildResumeText: () => 'Verily\nBuilt CI/CD platform with Kubernetes and Terraform\nQualcomm\nLed modem releases',
  scoreAts: (...args: unknown[]) => mockScoreAts(...args),
}));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: mockCreate }; } }));

const ats = (gap: number) => ({ current: { total: 70, breakdown: [] }, max: { total: 70 + gap, breakdown: [], reachesTarget90: false }, gap, gapLine: 'Structural mismatch' });
const request = (input: string) => new Request('http://test/api/v1/resume-generator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }) });

describe('v1 resume generator ATS contract', () => {
  beforeEach(() => { vi.clearAllMocks(); mockScoreAts.mockResolvedValue(ats(6)); });

  it('completes the ideal probe and assigns exactly the ATS addressable gap', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ proposedChanges: [{ section: 'experience', original: 'Built CI/CD platform with Kubernetes and Terraform', modified: 'Built CI/CD platform', reason: 'surface evidence', jdRequirement: 'CI/CD, build and release infrastructure' }] }) }] });
    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(request(IDEAL_JD));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.atsScore.max.total).toBe(76);
    expect(body.data.proposedChanges.reduce((sum: number, change: { impactPoints: number }) => sum + change.impactPoints, 0)).toBe(6);
  });

  it('does not turn pastry requirements into Verily or Qualcomm rewrites', async () => {
    mockScoreAts.mockResolvedValue(ats(0));
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ proposedChanges: [{ section: 'experience.verily', original: 'Built CI/CD platform with Kubernetes and Terraform', modified: 'Prepared croissants', reason: 'pastry', jdRequirement: 'laminated doughs, croissants, danishes, and viennoiserie' }] }) }] });
    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(request(PASTRY_JD));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.proposedChanges).toEqual([]);
  });
});
