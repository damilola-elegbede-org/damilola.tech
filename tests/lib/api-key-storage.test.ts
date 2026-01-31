/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// Mock @upstash/redis with hoisted mock client
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
};

vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      get = mockRedisClient.get;
      set = mockRedisClient.set;
      sadd = mockRedisClient.sadd;
      smembers = mockRedisClient.smembers;
    },
  };
});

describe('api-key-storage module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Configure Redis by default
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('generateApiKey', () => {
    it('generates key with dk_live_ prefix in production', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const { rawKey } = generateApiKey(true);
      expect(rawKey).toMatch(/^dk_live_/);
    });

    it('generates key with dk_test_ prefix in non-production', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const { rawKey } = generateApiKey(false);
      expect(rawKey).toMatch(/^dk_test_/);
    });

    it('returns rawKey, keyHash, and keyPrefix', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const result = generateApiKey(true);
      expect(result).toHaveProperty('rawKey');
      expect(result).toHaveProperty('keyHash');
      expect(result).toHaveProperty('keyPrefix');
    });

    it('keyPrefix is first 16 characters', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const { rawKey, keyPrefix } = generateApiKey(true);
      expect(keyPrefix).toBe(rawKey.slice(0, 16));
      expect(keyPrefix).toHaveLength(16);
    });

    it('keyHash is SHA-256 of rawKey', async () => {
      const { generateApiKey, hashApiKey } = await import('@/lib/api-key-storage');
      const { rawKey, keyHash } = generateApiKey(true);
      const expectedHash = hashApiKey(rawKey);
      expect(keyHash).toBe(expectedHash);
    });

    it('generates unique keys on each call', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const key1 = generateApiKey(true);
      const key2 = generateApiKey(true);
      expect(key1.rawKey).not.toBe(key2.rawKey);
      expect(key1.keyHash).not.toBe(key2.keyHash);
    });

    it('generates keys with correct length', async () => {
      const { generateApiKey } = await import('@/lib/api-key-storage');
      const { rawKey } = generateApiKey(true);
      // dk_live_ (8 chars) + 32 random chars = 40 chars total
      expect(rawKey.length).toBe(40);
    });
  });

  describe('hashApiKey', () => {
    it('produces consistent SHA-256 hash', async () => {
      const { hashApiKey } = await import('@/lib/api-key-storage');
      const testKey = 'dk_live_testkey123456789012345678';
      const hash1 = hashApiKey(testKey);
      const hash2 = hashApiKey(testKey);
      expect(hash1).toBe(hash2);
    });

    it('different keys produce different hashes', async () => {
      const { hashApiKey } = await import('@/lib/api-key-storage');
      const hash1 = hashApiKey('dk_live_key1');
      const hash2 = hashApiKey('dk_live_key2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces valid hex string', async () => {
      const { hashApiKey } = await import('@/lib/api-key-storage');
      const hash = hashApiKey('dk_live_testkey');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('matches Node.js crypto SHA-256', async () => {
      const { hashApiKey } = await import('@/lib/api-key-storage');
      const testKey = 'dk_live_testkey';
      const expectedHash = createHash('sha256').update(testKey).digest('hex');
      expect(hashApiKey(testKey)).toBe(expectedHash);
    });
  });

  describe('verifyApiKeyHash', () => {
    it('returns true for matching key', async () => {
      const { verifyApiKeyHash, hashApiKey } = await import('@/lib/api-key-storage');
      const rawKey = 'dk_live_testkey123456789012345678';
      const expectedHash = hashApiKey(rawKey);
      expect(verifyApiKeyHash(rawKey, expectedHash)).toBe(true);
    });

    it('returns false for non-matching key', async () => {
      const { verifyApiKeyHash, hashApiKey } = await import('@/lib/api-key-storage');
      const rawKey1 = 'dk_live_testkey1';
      const rawKey2 = 'dk_live_testkey2';
      const hash1 = hashApiKey(rawKey1);
      expect(verifyApiKeyHash(rawKey2, hash1)).toBe(false);
    });

    it('returns false for invalid hash format', async () => {
      const { verifyApiKeyHash } = await import('@/lib/api-key-storage');
      const rawKey = 'dk_live_testkey';
      // Invalid hex hash
      expect(verifyApiKeyHash(rawKey, 'invalid-hash')).toBe(false);
    });

    it('returns false for different length hashes', async () => {
      const { verifyApiKeyHash } = await import('@/lib/api-key-storage');
      const rawKey = 'dk_live_testkey';
      // Shorter hash (not 64 chars)
      expect(verifyApiKeyHash(rawKey, 'abcd1234')).toBe(false);
    });
  });

  describe('isApiKeyStorageAvailable', () => {
    it('returns true when Redis URL configured', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const { isApiKeyStorageAvailable } = await import('@/lib/api-key-storage');
      expect(isApiKeyStorageAvailable()).toBe(true);
    });

    it('returns false when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { isApiKeyStorageAvailable } = await import('@/lib/api-key-storage');
      expect(isApiKeyStorageAvailable()).toBe(false);
    });

    it('returns false when only URL is configured', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { isApiKeyStorageAvailable } = await import('@/lib/api-key-storage');
      expect(isApiKeyStorageAvailable()).toBe(false);
    });

    it('returns false when only token is configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const { isApiKeyStorageAvailable } = await import('@/lib/api-key-storage');
      expect(isApiKeyStorageAvailable()).toBe(false);
    });
  });

  describe('storeApiKey', () => {
    it('stores key with all required fields', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      const apiKey = await storeApiKey('Test Key', 'hash123', 'dk_live_abcd1234');

      expect(apiKey).toHaveProperty('id');
      expect(apiKey).toHaveProperty('name', 'Test Key');
      expect(apiKey).toHaveProperty('keyHash', 'hash123');
      expect(apiKey).toHaveProperty('keyPrefix', 'dk_live_abcd1234');
      expect(apiKey).toHaveProperty('enabled', true);
      expect(apiKey).toHaveProperty('createdAt');
    });

    it('generates UUID for id', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      const apiKey = await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');

      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(apiKey.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('sets enabled to true by default', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      const apiKey = await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');

      expect(apiKey.enabled).toBe(true);
    });

    it('sets createdAt to current time', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const before = new Date().toISOString();
      const { storeApiKey } = await import('@/lib/api-key-storage');
      const apiKey = await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');
      const after = new Date().toISOString();

      expect(apiKey.createdAt >= before).toBe(true);
      expect(apiKey.createdAt <= after).toBe(true);
    });

    it('stores optional description', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      const apiKey = await storeApiKey('Test Key', 'hash123', 'dk_live_abcd', 'My description');

      expect(apiKey.description).toBe('My description');
    });

    it('calls Redis set for key data', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');

      // Should store key data with apikey:{id} prefix
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^apikey:[0-9a-f-]+$/),
        expect.any(String)
      );
    });

    it('creates hash index for lookup', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');

      // Should store hash index
      expect(mockRedisClient.set).toHaveBeenCalledWith('apikey:hash:hash123', expect.any(String));
    });

    it('adds key to list set', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.sadd.mockResolvedValue(1);

      const { storeApiKey } = await import('@/lib/api-key-storage');
      await storeApiKey('Test Key', 'hash123', 'dk_live_abcd');

      expect(mockRedisClient.sadd).toHaveBeenCalledWith('apikey:list', expect.any(String));
    });
  });

  describe('getApiKeyById', () => {
    it('retrieves key by ID', async () => {
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abcd',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockApiKey));

      const { getApiKeyById } = await import('@/lib/api-key-storage');
      const result = await getApiKeyById('test-id');

      expect(result).toEqual(mockApiKey);
      expect(mockRedisClient.get).toHaveBeenCalledWith('apikey:test-id');
    });

    it('returns null for non-existent ID', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const { getApiKeyById } = await import('@/lib/api-key-storage');
      const result = await getApiKeyById('non-existent');

      expect(result).toBeNull();
    });

    it('handles already-parsed object from Redis', async () => {
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abcd',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      // Redis might return already parsed object
      mockRedisClient.get.mockResolvedValue(mockApiKey);

      const { getApiKeyById } = await import('@/lib/api-key-storage');
      const result = await getApiKeyById('test-id');

      expect(result).toEqual(mockApiKey);
    });
  });

  describe('getApiKeyByHash', () => {
    it('retrieves key by hash', async () => {
      const mockApiKey = {
        id: 'test-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abcd',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      // First call returns ID, second call returns key data
      mockRedisClient.get
        .mockResolvedValueOnce('test-id')
        .mockResolvedValueOnce(JSON.stringify(mockApiKey));

      const { getApiKeyByHash } = await import('@/lib/api-key-storage');
      const result = await getApiKeyByHash('hash123');

      expect(result).toEqual(mockApiKey);
      expect(mockRedisClient.get).toHaveBeenCalledWith('apikey:hash:hash123');
    });

    it('returns null for non-existent hash', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const { getApiKeyByHash } = await import('@/lib/api-key-storage');
      const result = await getApiKeyByHash('non-existent-hash');

      expect(result).toBeNull();
    });

    it('returns null when hash exists but key data is missing', async () => {
      mockRedisClient.get.mockResolvedValueOnce('test-id').mockResolvedValueOnce(null);

      const { getApiKeyByHash } = await import('@/lib/api-key-storage');
      const result = await getApiKeyByHash('hash123');

      expect(result).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('returns all keys sorted by createdAt desc', async () => {
      const mockKeys = [
        {
          id: 'key1',
          name: 'Key 1',
          keyHash: 'hash1',
          keyPrefix: 'dk_live_',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'key2',
          name: 'Key 2',
          keyHash: 'hash2',
          keyPrefix: 'dk_live_',
          enabled: true,
          createdAt: '2025-01-02T00:00:00.000Z',
        },
      ];
      mockRedisClient.smembers.mockResolvedValue(['key1', 'key2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockKeys[0]))
        .mockResolvedValueOnce(JSON.stringify(mockKeys[1]));

      const { listApiKeys } = await import('@/lib/api-key-storage');
      const result = await listApiKeys();

      // Should be sorted by createdAt desc (key2 first)
      expect(result[0].id).toBe('key2');
      expect(result[1].id).toBe('key1');
    });

    it('returns empty array when no keys', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      const { listApiKeys } = await import('@/lib/api-key-storage');
      const result = await listApiKeys();

      expect(result).toEqual([]);
    });

    it('filters out null values from missing keys', async () => {
      mockRedisClient.smembers.mockResolvedValue(['key1', 'key2']);
      mockRedisClient.get
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'key1',
            name: 'Key 1',
            keyHash: 'hash1',
            keyPrefix: 'dk_live_',
            enabled: true,
            createdAt: '2025-01-01T00:00:00.000Z',
          })
        )
        .mockResolvedValueOnce(null);

      const { listApiKeys } = await import('@/lib/api-key-storage');
      const result = await listApiKeys();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('key1');
    });
  });

  describe('updateApiKey', () => {
    const existingKey = {
      id: 'test-id',
      name: 'Original Name',
      description: 'Original desc',
      keyHash: 'hash123',
      keyPrefix: 'dk_live_abcd',
      enabled: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    it('updates name field', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('test-id', { name: 'New Name' });

      expect(result?.name).toBe('New Name');
    });

    it('updates description field', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('test-id', { description: 'New description' });

      expect(result?.description).toBe('New description');
    });

    it('updates enabled field', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('test-id', { enabled: false });

      expect(result?.enabled).toBe(false);
    });

    it('returns null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('returns null for revoked key', async () => {
      const revokedKey = { ...existingKey, revokedAt: '2025-01-02T00:00:00.000Z' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(revokedKey));

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('test-id', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('preserves other fields when updating', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { updateApiKey } = await import('@/lib/api-key-storage');
      const result = await updateApiKey('test-id', { name: 'New Name' });

      expect(result?.keyHash).toBe('hash123');
      expect(result?.keyPrefix).toBe('dk_live_abcd');
      expect(result?.createdAt).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('updateApiKeyLastUsed', () => {
    it('updates lastUsedAt timestamp', async () => {
      const existingKey = {
        id: 'test-id',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'dk_live_abcd',
        enabled: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { updateApiKeyLastUsed } = await import('@/lib/api-key-storage');
      await updateApiKeyLastUsed('test-id');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'apikey:test-id',
        expect.stringContaining('"lastUsedAt"')
      );
    });

    it('does nothing for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const { updateApiKeyLastUsed } = await import('@/lib/api-key-storage');
      await updateApiKeyLastUsed('non-existent');

      // Should not call set
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('revokeApiKey', () => {
    const existingKey = {
      id: 'test-id',
      name: 'Test Key',
      keyHash: 'hash123',
      keyPrefix: 'dk_live_abcd',
      enabled: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    it('sets revokedAt timestamp', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { revokeApiKey } = await import('@/lib/api-key-storage');
      const result = await revokeApiKey('test-id');

      expect(result?.revokedAt).toBeDefined();
      expect(new Date(result!.revokedAt!).getTime()).toBeGreaterThan(0);
    });

    it('sets enabled to false', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingKey));
      mockRedisClient.set.mockResolvedValue('OK');

      const { revokeApiKey } = await import('@/lib/api-key-storage');
      const result = await revokeApiKey('test-id');

      expect(result?.enabled).toBe(false);
    });

    it('returns null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const { revokeApiKey } = await import('@/lib/api-key-storage');
      const result = await revokeApiKey('non-existent');

      expect(result).toBeNull();
    });

    it('returns existing key if already revoked', async () => {
      const revokedKey = { ...existingKey, revokedAt: '2025-01-02T00:00:00.000Z' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(revokedKey));

      const { revokeApiKey } = await import('@/lib/api-key-storage');
      const result = await revokeApiKey('test-id');

      expect(result).toEqual(revokedKey);
      // Should not call set again
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });
});
