/**
 * @vitest-environment node
 *
 * Tests for interview stage field:
 *   1. POST /api/v1/log-application — stage defaults to 'Applied'
 *   2. PATCH /api/v1/log-application/:id — advances stage successfully
 *   3. PATCH /api/v1/log-application/:id — returns 422 for invalid stage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock applications-store for POST tests
const mockSaveApplication = vi.fn();
const mockUpdateApplicationStage = vi.fn();
vi.mock('@/lib/applications-store', () => ({
  saveApplication: (...args: unknown[]) => mockSaveApplication(...args),
  updateApplicationStage: (...args: unknown[]) => mockUpdateApplicationStage(...args),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return { ...actual, randomUUID: vi.fn().mockReturnValue('stage-test-uuid') };
});

const mockValidApiKey = { apiKey: { id: 'key-1', name: 'Test Key', enabled: true } };

describe('Application stage field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockSaveApplication.mockResolvedValue(undefined);
  });

  it('POST /api/v1/log-application — stage defaults to Applied when not provided', async () => {
    const { POST } = await import('@/app/api/v1/log-application/route');

    const req = new Request('http://localhost/api/v1/log-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Anthropic', title: 'Staff Engineer' }),
    });
    await POST(req);

    expect(mockSaveApplication).toHaveBeenCalledOnce();
    const saved = mockSaveApplication.mock.calls[0][0] as Record<string, unknown>;
    expect(saved['id']).toBe('stage-test-uuid');
    expect(saved['stage']).toBe('Applied');
  });

  it('PATCH /api/v1/log-application/:id — advances stage to PhoneScreen', async () => {
    const updatedApp = {
      id: 'app-123',
      company: 'Anthropic',
      title: 'Staff Engineer',
      stage: 'PhoneScreen',
      status: 'applied',
      applied_at: '2026-04-26T00:00:00Z',
      score: null,
      url: null,
      role_id: null,
      notes: null,
      created_at: '2026-04-26T00:00:00Z',
      updated_at: '2026-04-26T15:00:00Z',
    };
    mockUpdateApplicationStage.mockResolvedValue(updatedApp);

    const { PATCH } = await import('@/app/api/v1/log-application/[id]/route');

    const req = new Request('http://localhost/api/v1/log-application/app-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'PhoneScreen' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'app-123' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stage).toBe('PhoneScreen');
    expect(mockUpdateApplicationStage).toHaveBeenCalledWith('app-123', 'PhoneScreen');
  });

  it('PATCH /api/v1/log-application/:id — returns 422 for invalid stage value', async () => {
    const { PATCH } = await import('@/app/api/v1/log-application/[id]/route');

    const req = new Request('http://localhost/api/v1/log-application/app-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'InvalidStage' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'app-123' }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('InvalidStage');
    expect(mockUpdateApplicationStage).not.toHaveBeenCalled();
  });
});
