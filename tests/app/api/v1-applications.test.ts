/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Application } from '@/lib/types/application';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock applications-store
const mockListApplicationIds = vi.fn();
const mockGetApplications = vi.fn();
vi.mock('@/lib/applications-store', () => ({
  listApplicationIds: () => mockListApplicationIds(),
  getApplications: (...args: unknown[]) => mockGetApplications(...args),
}));

const makeApp = (overrides: Partial<Application> = {}): Application => ({
  id: 'app-1',
  company: 'Anthropic',
  title: 'Staff SWE',
  url: 'https://example.com/job',
  role_id: null,
  applied_at: '2026-04-23T14:00:00Z',
  status: 'applied',
  stage: 'Applied',
  score: 88,
  notes: null,
  created_at: '2026-04-23T14:00:00Z',
  updated_at: '2026-04-23T14:00:00Z',
  ...overrides,
});

describe('GET /api/v1/applications', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  // --- Authentication ---

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  // --- Happy path ---

  describe('success cases', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns empty list when no applications exist', async () => {
      mockListApplicationIds.mockResolvedValue([]);
      mockGetApplications.mockResolvedValue([]);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.applications).toEqual([]);
      expect(data.data.total).toBe(0);
      expect(data.data.limit).toBe(50);
      expect(data.data.offset).toBe(0);
    });

    it('returns all applications with default limit/offset', async () => {
      const apps = [makeApp({ id: 'app-1' }), makeApp({ id: 'app-2', company: 'Stripe' })];
      mockListApplicationIds.mockResolvedValue(['app-1', 'app-2']);
      mockGetApplications.mockResolvedValue(apps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.applications).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('includes expected fields in each application', async () => {
      const app = makeApp({ score: 91, notes: 'Referral', role_id: 'role-1' });
      mockListApplicationIds.mockResolvedValue(['app-1']);
      mockGetApplications.mockResolvedValue([app]);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);
      const data = await res.json();
      const item = data.data.applications[0] as Application;

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('company');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('url');
      expect(item).toHaveProperty('applied_at');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('score', 91);
      expect(item).toHaveProperty('notes', 'Referral');
      expect(item).toHaveProperty('role_id', 'role-1');
    });

    it('filters by status', async () => {
      const apps = [
        makeApp({ id: 'app-1', status: 'applied' }),
        makeApp({ id: 'app-2', status: 'rejected' }),
        makeApp({ id: 'app-3', status: 'applied' }),
      ];
      mockListApplicationIds.mockResolvedValue(['app-1', 'app-2', 'app-3']);
      mockGetApplications.mockResolvedValue(apps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?status=rejected');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.applications).toHaveLength(1);
      expect(data.data.applications[0].status).toBe('rejected');
      expect(data.data.total).toBe(1);
    });

    it('filters by company (case-insensitive contains)', async () => {
      const apps = [
        makeApp({ id: 'app-1', company: 'Anthropic' }),
        makeApp({ id: 'app-2', company: 'Stripe' }),
        makeApp({ id: 'app-3', company: 'Anthropic AI' }),
      ];
      mockListApplicationIds.mockResolvedValue(['app-1', 'app-2', 'app-3']);
      mockGetApplications.mockResolvedValue(apps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?company=anthropic');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.applications).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('filters by both status and company', async () => {
      const apps = [
        makeApp({ id: 'app-1', company: 'Anthropic', status: 'applied' }),
        makeApp({ id: 'app-2', company: 'Anthropic', status: 'rejected' }),
        makeApp({ id: 'app-3', company: 'Stripe', status: 'applied' }),
      ];
      mockListApplicationIds.mockResolvedValue(['app-1', 'app-2', 'app-3']);
      mockGetApplications.mockResolvedValue(apps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?status=applied&company=anthropic');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.applications).toHaveLength(1);
      expect(data.data.applications[0].id).toBe('app-1');
    });

    it('respects limit parameter', async () => {
      const allIds = Array.from({ length: 10 }, (_, i) => `app-${i}`);
      // The route slices to [app-0, app-1, app-2] and calls getApplications with those 3 IDs.
      // The mock returns exactly those 3 items.
      const pageApps = Array.from({ length: 3 }, (_, i) => makeApp({ id: `app-${i}` }));
      mockListApplicationIds.mockResolvedValue(allIds);
      mockGetApplications.mockResolvedValue(pageApps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?limit=3');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.applications).toHaveLength(3);
      expect(data.data.limit).toBe(3);
      expect(data.data.total).toBe(10);
    });

    it('respects offset parameter', async () => {
      const allIds = ['app-0', 'app-1', 'app-2'];
      // Route slices offset=1 → ['app-1', 'app-2'] and calls getApplications with those 2 IDs.
      const pageApps = [
        makeApp({ id: 'app-1', company: 'B' }),
        makeApp({ id: 'app-2', company: 'C' }),
      ];
      mockListApplicationIds.mockResolvedValue(allIds);
      mockGetApplications.mockResolvedValue(pageApps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?offset=1');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.applications).toHaveLength(2);
      expect(data.data.applications[0].id).toBe('app-1');
      expect(data.data.offset).toBe(1);
    });

    it('caps limit at 100', async () => {
      const apps = Array.from({ length: 5 }, (_, i) => makeApp({ id: `app-${i}` }));
      mockListApplicationIds.mockResolvedValue(apps.map((a) => a.id));
      mockGetApplications.mockResolvedValue(apps);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?limit=999');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.limit).toBe(100);
    });

    it('returns 400 for invalid status filter', async () => {
      mockListApplicationIds.mockResolvedValue([]);
      mockGetApplications.mockResolvedValue([]);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?status=bogus');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('bogus');
    });

    it('passes correct IDs slice to getApplications based on offset+limit', async () => {
      const ids = ['id-0', 'id-1', 'id-2', 'id-3', 'id-4'];
      mockListApplicationIds.mockResolvedValue(ids);
      mockGetApplications.mockResolvedValue([
        makeApp({ id: 'id-2' }),
        makeApp({ id: 'id-3' }),
      ]);

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications?offset=2&limit=2');
      await GET(req);

      expect(mockGetApplications).toHaveBeenCalledWith(['id-2', 'id-3']);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 500 when listApplicationIds throws', async () => {
      mockListApplicationIds.mockRejectedValue(new Error('Redis down'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('returns 500 when getApplications throws', async () => {
      mockListApplicationIds.mockResolvedValue(['app-1']);
      mockGetApplications.mockRejectedValue(new Error('Redis pipeline error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/applications/route');
      const req = new Request('http://localhost/api/v1/applications');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });
  });
});
