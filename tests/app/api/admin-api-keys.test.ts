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
const mockGenerateApiKey = vi.fn();
const mockStoreApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockIsApiKeyStorageAvailable = vi.fn();

vi.mock('@/lib/api-key-storage', () => ({
  generateApiKey: () => mockGenerateApiKey(),
  storeApiKey: (...args: unknown[]) => mockStoreApiKey(...args),
  listApiKeys: () => mockListApiKeys(),
  isApiKeyStorageAvailable: () => mockIsApiKeyStorageAvailable(),
}));

// Mock audit-server
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('admin/api-keys API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('GET /api/admin/api-keys', () => {
    it('returns 401 without admin token', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 with invalid token', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      vi.mocked(verifyToken).mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 503 when Redis unavailable', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(false);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('not available');
    });

    it('returns empty array when no keys', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);
      mockListApiKeys.mockResolvedValue([]);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toEqual([]);
    });

    it('returns list of keys', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key 1',
          description: 'First key',
          keyHash: 'hash1',
          keyPrefix: 'dk_live_abc123',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'key-2',
          name: 'Test Key 2',
          keyHash: 'hash2',
          keyPrefix: 'dk_live_def456',
          enabled: false,
          createdAt: '2025-01-02T00:00:00.000Z',
        },
      ];
      mockListApiKeys.mockResolvedValue(mockKeys);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys).toHaveLength(2);
    });

    it('excludes keyHash from response', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key',
          keyHash: 'sensitive-hash-should-not-appear',
          keyPrefix: 'dk_live_abc123',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ];
      mockListApiKeys.mockResolvedValue(mockKeys);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(data.keys[0]).not.toHaveProperty('keyHash');
    });

    it('includes expected fields in response', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key',
          description: 'A description',
          keyHash: 'hash1',
          keyPrefix: 'dk_live_abc123',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          lastUsedAt: '2025-01-02T00:00:00.000Z',
        },
      ];
      mockListApiKeys.mockResolvedValue(mockKeys);

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(data.keys[0]).toHaveProperty('id', 'key-1');
      expect(data.keys[0]).toHaveProperty('name', 'Test Key');
      expect(data.keys[0]).toHaveProperty('description', 'A description');
      expect(data.keys[0]).toHaveProperty('keyPrefix', 'dk_live_abc123');
      expect(data.keys[0]).toHaveProperty('enabled', true);
      expect(data.keys[0]).toHaveProperty('createdAt', '2025-01-01T00:00:00.000Z');
    });

    it('handles list error gracefully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);
      mockListApiKeys.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/api-keys/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to list');

      consoleSpy.mockRestore();
    });
  });

  describe('POST /api/admin/api-keys', () => {
    it('returns 401 without admin token', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 503 when Redis unavailable', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(false);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('not available');
    });

    it('returns 400 for missing name', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Name is required');
    });

    it('returns 400 for empty name', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: '   ' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Name is required');
    });

    it('returns 400 for name > 100 chars', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'a'.repeat(101) }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('100 characters');
    });

    it('returns 400 for description > 500 chars', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', description: 'a'.repeat(501) }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('500 characters');
    });

    it('creates key with valid input', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123def456ghi789jkl012mn',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
      });

      const storedKey = {
        id: 'new-key-id',
        name: 'Test Key',
        description: 'My description',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockStoreApiKey.mockResolvedValue(storedKey);

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key', description: 'My description' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.key).toHaveProperty('id', 'new-key-id');
      expect(data.key).toHaveProperty('name', 'Test Key');
    });

    it('returns rawKey only at creation', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123def456ghi789jkl012mn',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
      });

      mockStoreApiKey.mockResolvedValue({
        id: 'new-key-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.rawKey).toBe('dk_test_abc123def456ghi789jkl012mn');
    });

    it('returns warning about storing key', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc',
      });

      mockStoreApiKey.mockResolvedValue({
        id: 'new-key-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.warning).toContain('Store this key securely');
      expect(data.warning).toContain('will not be shown again');
    });

    it('logs api_key_created audit event', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      const { logAdminEvent } = await import('@/lib/audit-server');

      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc',
      });

      mockStoreApiKey.mockResolvedValue({
        id: 'new-key-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      await POST(request);

      expect(logAdminEvent).toHaveBeenCalledWith(
        'api_key_created',
        expect.objectContaining({ keyId: 'new-key-id', keyName: 'Test Key' }),
        expect.any(String),
        expect.objectContaining({ accessType: 'browser' })
      );
    });

    it('uses dk_live_ prefix in production', async () => {
      process.env.VERCEL_ENV = 'production';

      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_live_abc123def456ghi789jkl012mn',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abc12345',
      });

      mockStoreApiKey.mockResolvedValue({
        id: 'new-key-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abc12345',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.rawKey).toMatch(/^dk_live_/);
    });

    it('uses dk_test_ prefix in non-production', async () => {
      process.env.VERCEL_ENV = 'preview';

      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123def456ghi789jkl012mn',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
      });

      mockStoreApiKey.mockResolvedValue({
        id: 'new-key-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc12345',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.rawKey).toMatch(/^dk_test_/);
    });

    it('handles store error gracefully', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
      mockIsApiKeyStorageAvailable.mockReturnValue(true);

      mockGenerateApiKey.mockReturnValue({
        rawKey: 'dk_test_abc123',
        keyHash: 'hash123',
        keyPrefix: 'dk_test_abc',
      });

      mockStoreApiKey.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/admin/api-keys/route');
      const request = new Request('http://localhost/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create');

      consoleSpy.mockRestore();
    });
  });
});
