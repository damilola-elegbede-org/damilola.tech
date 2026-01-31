/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-storage
const mockGetApiKeyByHash = vi.fn();
const mockUpdateApiKeyLastUsed = vi.fn();
const mockHashApiKey = vi.fn();

vi.mock('@/lib/api-key-storage', () => ({
  hashApiKey: (key: string) => mockHashApiKey(key),
  getApiKeyByHash: (hash: string) => mockGetApiKeyByHash(hash),
  updateApiKeyLastUsed: (id: string) => mockUpdateApiKeyLastUsed(id),
}));

describe('api-key-auth module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default mock behavior
    mockHashApiKey.mockImplementation((key: string) => `hashed_${key}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authenticateApiKey', () => {
    describe('key extraction', () => {
      it('extracts from Authorization: Bearer header', async () => {
        const validKey = {
          id: 'key-1',
          name: 'Test Key',
          enabled: true,
          keyHash: 'hashed_dk_live_validkey12345678901234',
        };
        mockGetApiKeyByHash.mockResolvedValue(validKey);
        mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_validkey12345678901234',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(true);
        expect(result.apiKey).toEqual(validKey);
      });

      it('extracts from X-API-Key header', async () => {
        const validKey = {
          id: 'key-1',
          name: 'Test Key',
          enabled: true,
          keyHash: 'hashed_dk_live_validkey12345678901234',
        };
        mockGetApiKeyByHash.mockResolvedValue(validKey);
        mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            'X-API-Key': 'dk_live_validkey12345678901234',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(true);
      });

      it('prefers Bearer header when both present', async () => {
        const validKey = {
          id: 'key-bearer',
          name: 'Bearer Key',
          enabled: true,
        };
        mockGetApiKeyByHash
          .mockResolvedValueOnce(validKey); // First call for bearer key
        mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_bearerkey12345678901234',
            'X-API-Key': 'dk_live_xapikey123456789012345',
          },
        });

        await authenticateApiKey(req);

        // Should hash the bearer key, not the X-API-Key
        expect(mockHashApiKey).toHaveBeenCalledWith('dk_live_bearerkey12345678901234');
      });

      it('returns error for missing headers', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost');

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
        expect(result.error).toContain('API key required');
      });

      it('handles malformed Authorization header', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Basic user:password', // Wrong auth type
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
      });

      it('ignores Bearer header without dk_ prefix', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer some_other_token',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
      });

      it('ignores X-API-Key header without dk_ prefix', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            'X-API-Key': 'some_other_key',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
      });
    });

    describe('authentication results', () => {
      it('returns authenticated:true with valid key', async () => {
        const validKey = {
          id: 'key-1',
          name: 'Test Key',
          enabled: true,
        };
        mockGetApiKeyByHash.mockResolvedValue(validKey);
        mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_validkey12345678901234',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(true);
        expect(result.apiKey).toEqual(validKey);
        expect(result.error).toBeUndefined();
      });

      it('returns error for missing key (401)', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost');

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
        expect(result.error).toBeDefined();
      });

      it('returns error for invalid key format (401)', async () => {
        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer invalid_format_key',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
      });

      it('returns error for non-existent key (401)', async () => {
        mockGetApiKeyByHash.mockResolvedValue(null);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_nonexistent123456789012',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(401);
        expect(result.error).toContain('Invalid API key');
      });

      it('returns error for disabled key (403)', async () => {
        const disabledKey = {
          id: 'key-1',
          name: 'Disabled Key',
          enabled: false,
        };
        mockGetApiKeyByHash.mockResolvedValue(disabledKey);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_disabledkey12345678901',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(403);
        expect(result.error).toContain('disabled');
      });

      it('returns error for revoked key (403)', async () => {
        const revokedKey = {
          id: 'key-1',
          name: 'Revoked Key',
          enabled: true,
          revokedAt: '2025-01-01T00:00:00.000Z',
        };
        mockGetApiKeyByHash.mockResolvedValue(revokedKey);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_revokedkey1234567890123',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(403);
        expect(result.error).toContain('revoked');
      });

      it('updates lastUsedAt on success', async () => {
        const validKey = {
          id: 'key-1',
          name: 'Test Key',
          enabled: true,
        };
        mockGetApiKeyByHash.mockResolvedValue(validKey);
        mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_validkey12345678901234',
          },
        });

        await authenticateApiKey(req);

        // Wait for the fire-and-forget Promise to settle
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockUpdateApiKeyLastUsed).toHaveBeenCalledWith('key-1');
      });

      it('handles updateLastUsed errors gracefully', async () => {
        const validKey = {
          id: 'key-1',
          name: 'Test Key',
          enabled: true,
        };
        mockGetApiKeyByHash.mockResolvedValue(validKey);
        mockUpdateApiKeyLastUsed.mockRejectedValue(new Error('Redis error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_validkey12345678901234',
          },
        });

        const result = await authenticateApiKey(req);

        // Should still authenticate successfully
        expect(result.authenticated).toBe(true);

        // Wait for the fire-and-forget Promise to settle
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Error should be logged
        expect(consoleSpy).toHaveBeenCalledWith(
          '[api-key-auth] Failed to update lastUsedAt:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('handles storage lookup errors', async () => {
        mockGetApiKeyByHash.mockRejectedValue(new Error('Redis connection failed'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { authenticateApiKey } = await import('@/lib/api-key-auth');
        const req = new Request('http://localhost', {
          headers: {
            Authorization: 'Bearer dk_live_validkey12345678901234',
          },
        });

        const result = await authenticateApiKey(req);
        expect(result.authenticated).toBe(false);
        expect(result.statusCode).toBe(500);
        expect(result.error).toContain('Authentication failed');

        consoleSpy.mockRestore();
      });
    });
  });

  describe('requireApiKey', () => {
    it('returns auth result for valid key', async () => {
      const validKey = {
        id: 'key-1',
        name: 'Test Key',
        enabled: true,
      };
      mockGetApiKeyByHash.mockResolvedValue(validKey);
      mockUpdateApiKeyLastUsed.mockResolvedValue(undefined);

      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost', {
        headers: {
          Authorization: 'Bearer dk_live_validkey12345678901234',
        },
      });

      const result = await requireApiKey(req);
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { apiKey: typeof validKey }).apiKey).toEqual(validKey);
    });

    it('returns 401 Response for missing key', async () => {
      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost');

      const result = await requireApiKey(req);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);

      const data = await (result as Response).json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 Response for invalid key', async () => {
      mockGetApiKeyByHash.mockResolvedValue(null);

      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost', {
        headers: {
          Authorization: 'Bearer dk_live_invalidkey123456789012',
        },
      });

      const result = await requireApiKey(req);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);

      const data = await (result as Response).json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 Response for disabled key', async () => {
      const disabledKey = {
        id: 'key-1',
        name: 'Disabled Key',
        enabled: false,
      };
      mockGetApiKeyByHash.mockResolvedValue(disabledKey);

      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost', {
        headers: {
          Authorization: 'Bearer dk_live_disabledkey12345678901',
        },
      });

      const result = await requireApiKey(req);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(403);

      const data = await (result as Response).json();
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 Response for revoked key', async () => {
      const revokedKey = {
        id: 'key-1',
        name: 'Revoked Key',
        enabled: true,
        revokedAt: '2025-01-01T00:00:00.000Z',
      };
      mockGetApiKeyByHash.mockResolvedValue(revokedKey);

      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost', {
        headers: {
          Authorization: 'Bearer dk_live_revokedkey1234567890123',
        },
      });

      const result = await requireApiKey(req);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(403);

      const data = await (result as Response).json();
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('response includes success: false', async () => {
      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost');

      const result = await requireApiKey(req);
      const data = await (result as Response).json();
      expect(data.success).toBe(false);
    });

    it('response includes error message', async () => {
      const { requireApiKey } = await import('@/lib/api-key-auth');
      const req = new Request('http://localhost');

      const result = await requireApiKey(req);
      const data = await (result as Response).json();
      expect(data.error.message).toBeDefined();
      expect(typeof data.error.message).toBe('string');
    });
  });
});
