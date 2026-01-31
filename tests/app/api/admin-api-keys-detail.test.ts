/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock admin-auth
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: vi.fn(),
  ADMIN_COOKIE_NAME: 'admin_session',
}));

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock api-key-storage
const mockGetApiKeyById = vi.fn();
const mockUpdateApiKey = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockIsApiKeyStorageAvailable = vi.fn();

vi.mock('@/lib/api-key-storage', () => ({
  getApiKeyById: (id: string) => mockGetApiKeyById(id),
  updateApiKey: (...args: unknown[]) => mockUpdateApiKey(...args),
  revokeApiKey: (id: string) => mockRevokeApiKey(id),
  isApiKeyStorageAvailable: () => mockIsApiKeyStorageAvailable(),
}));

// Mock audit-server
const mockLogAdminEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('admin/api-keys/[id] API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const createContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  describe('GET /api/admin/api-keys/[id]', () => {
    it('returns 401 without admin token', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1');
      const response = await GET(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 503 when Redis unavailable', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(false);

      const { GET } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1');
      const response = await GET(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('not available');
    });

    it('returns 404 for non-existent key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);
      mockGetApiKeyById.mockResolvedValue(null);

      const { GET } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/non-existent');
      const response = await GET(request, createContext('non-existent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('returns key without keyHash', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        description: 'My description',
        keyHash: 'sensitive-hash',
        keyPrefix: 'dk_live_abc123',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-02T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);

      const { GET } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1');
      const response = await GET(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key).not.toHaveProperty('keyHash');
      expect(data.key.id).toBe('key-1');
      expect(data.key.name).toBe('Test Key');
    });

    it('includes all expected fields', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        description: 'My description',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc123',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-02T00:00:00.000Z',
        revokedAt: undefined,
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);

      const { GET } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1');
      const response = await GET(request, createContext('key-1'));
      const data = await response.json();

      expect(data.key).toHaveProperty('id');
      expect(data.key).toHaveProperty('name');
      expect(data.key).toHaveProperty('description');
      expect(data.key).toHaveProperty('keyPrefix');
      expect(data.key).toHaveProperty('enabled');
      expect(data.key).toHaveProperty('createdAt');
      expect(data.key).toHaveProperty('lastUsedAt');
    });
  });

  describe('PATCH /api/admin/api-keys/[id]', () => {
    it('returns 401 without admin token', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 503 when Redis unavailable', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(false);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(503);
    });

    it('returns 404 for non-existent key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);
      mockGetApiKeyById.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('returns 400 for revoked key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const revokedKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        revokedAt: '2025-01-02T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(revokedKey);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('revoked');
    });

    it('returns 400 for no updates', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No valid updates');
    });

    it('returns 400 for invalid name (empty)', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '   ' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('non-empty string');
    });

    it('returns 400 for name > 100 chars', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'a'.repeat(101) }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('100 characters');
    });

    it('returns 400 for description > 500 chars', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'a'.repeat(501) }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('500 characters');
    });

    it('returns 400 for invalid enabled type', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: 'yes' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('boolean');
    });

    it('updates name successfully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Old Name',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, name: 'New Name' });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key.name).toBe('New Name');
    });

    it('updates description successfully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        description: 'Old desc',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, description: 'New description' });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'New description' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key.description).toBe('New description');
    });

    it('updates enabled successfully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, enabled: false });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key.enabled).toBe(false);
    });

    it('logs api_key_enabled event', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: false, // Currently disabled
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, enabled: true });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: true }),
      });
      await PATCH(request, createContext('key-1'));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'api_key_enabled',
        expect.objectContaining({ keyId: 'key-1' }),
        expect.any(String),
        expect.objectContaining({ accessType: 'browser' })
      );
    });

    it('logs api_key_disabled event', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true, // Currently enabled
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, enabled: false });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      });
      await PATCH(request, createContext('key-1'));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'api_key_disabled',
        expect.objectContaining({ keyId: 'key-1' }),
        expect.any(String),
        expect.objectContaining({ accessType: 'browser' })
      );
    });

    it('excludes keyHash from response', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Old Name',
        keyHash: 'sensitive-hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockUpdateApiKey.mockResolvedValue({ ...mockKey, name: 'New Name' });

      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request, createContext('key-1'));
      const data = await response.json();

      expect(data.key).not.toHaveProperty('keyHash');
    });
  });

  describe('DELETE /api/admin/api-keys/[id]', () => {
    it('returns 401 without admin token', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 503 when Redis unavailable', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(false);

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(503);
    });

    it('returns 404 for non-existent key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);
      mockGetApiKeyById.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('returns 400 for already revoked key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const revokedKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        revokedAt: '2025-01-02T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(revokedKey);

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already revoked');
    });

    it('revokes key successfully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockRevokeApiKey.mockResolvedValue({
        ...mockKey,
        enabled: false,
        revokedAt: '2025-01-03T00:00:00.000Z',
      });

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key.enabled).toBe(false);
      expect(data.key.revokedAt).toBeDefined();
    });

    it('logs api_key_revoked event', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockRevokeApiKey.mockResolvedValue({
        ...mockKey,
        enabled: false,
        revokedAt: '2025-01-03T00:00:00.000Z',
      });

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      await DELETE(request, createContext('key-1'));

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'api_key_revoked',
        expect.objectContaining({ keyId: 'key-1', keyName: 'Test Key' }),
        expect.any(String),
        expect.objectContaining({ accessType: 'browser' })
      );
    });

    it('returns success message', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKey = {
        id: 'key-1',
        name: 'Test Key',
        keyHash: 'hash',
        keyPrefix: 'dk_live_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyById.mockResolvedValue(mockKey);
      mockRevokeApiKey.mockResolvedValue({
        ...mockKey,
        enabled: false,
        revokedAt: '2025-01-03T00:00:00.000Z',
      });

      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
      const request = new Request('http://localhost/api/admin/api-keys/key-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, createContext('key-1'));
      const data = await response.json();

      expect(data.message).toContain('revoked');
    });
  });
});
