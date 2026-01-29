import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CACHE_KEYS,
  getCacheBlobPath,
  PRESET_TO_CACHE_KEY,
  PRESET_TO_TRAFFIC_CACHE_KEY,
  getUsageCacheKeys,
  getTrafficCacheKeys,
  getAllCacheKeys,
} from '@/lib/admin-cache';

describe('admin-cache module', () => {
  describe('CACHE_KEYS', () => {
    it('should have all expected cache keys', () => {
      expect(CACHE_KEYS.DASHBOARD).toBe('dashboard');
      expect(CACHE_KEYS.USAGE_7D).toBe('usage-7d');
      expect(CACHE_KEYS.USAGE_30D).toBe('usage-30d');
      expect(CACHE_KEYS.USAGE_90D).toBe('usage-90d');
      expect(CACHE_KEYS.TRAFFIC_7D).toBe('traffic-7d');
      expect(CACHE_KEYS.TRAFFIC_30D).toBe('traffic-30d');
      expect(CACHE_KEYS.TRAFFIC_90D).toBe('traffic-90d');
    });
  });

  describe('getCacheBlobPath', () => {
    it('should return correct path for production environment', () => {
      expect(getCacheBlobPath(CACHE_KEYS.DASHBOARD, 'production')).toBe(
        'damilola.tech/admin-cache/production/dashboard.json'
      );
    });

    it('should return correct path for preview environment', () => {
      expect(getCacheBlobPath(CACHE_KEYS.USAGE_30D, 'preview')).toBe(
        'damilola.tech/admin-cache/preview/usage-30d.json'
      );
    });

    it('should return correct path for development environment', () => {
      expect(getCacheBlobPath(CACHE_KEYS.TRAFFIC_7D, 'development')).toBe(
        'damilola.tech/admin-cache/development/traffic-7d.json'
      );
    });
  });

  describe('PRESET_TO_CACHE_KEY', () => {
    it('should map 7d preset to usage-7d', () => {
      expect(PRESET_TO_CACHE_KEY['7d']).toBe(CACHE_KEYS.USAGE_7D);
    });

    it('should map 30d preset to usage-30d', () => {
      expect(PRESET_TO_CACHE_KEY['30d']).toBe(CACHE_KEYS.USAGE_30D);
    });

    it('should map 90d preset to usage-90d', () => {
      expect(PRESET_TO_CACHE_KEY['90d']).toBe(CACHE_KEYS.USAGE_90D);
    });

    it('should return null for custom preset', () => {
      expect(PRESET_TO_CACHE_KEY['custom']).toBeNull();
    });
  });

  describe('PRESET_TO_TRAFFIC_CACHE_KEY', () => {
    it('should map 7d preset to traffic-7d', () => {
      expect(PRESET_TO_TRAFFIC_CACHE_KEY['7d']).toBe(CACHE_KEYS.TRAFFIC_7D);
    });

    it('should map 30d preset to traffic-30d', () => {
      expect(PRESET_TO_TRAFFIC_CACHE_KEY['30d']).toBe(CACHE_KEYS.TRAFFIC_30D);
    });

    it('should map 90d preset to traffic-90d', () => {
      expect(PRESET_TO_TRAFFIC_CACHE_KEY['90d']).toBe(CACHE_KEYS.TRAFFIC_90D);
    });

    it('should return null for custom preset', () => {
      expect(PRESET_TO_TRAFFIC_CACHE_KEY['custom']).toBeNull();
    });
  });

  describe('getUsageCacheKeys', () => {
    it('should return all usage cache keys', () => {
      const keys = getUsageCacheKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain(CACHE_KEYS.USAGE_7D);
      expect(keys).toContain(CACHE_KEYS.USAGE_30D);
      expect(keys).toContain(CACHE_KEYS.USAGE_90D);
    });
  });

  describe('getTrafficCacheKeys', () => {
    it('should return all traffic cache keys', () => {
      const keys = getTrafficCacheKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_7D);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_30D);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_90D);
    });
  });

  describe('getAllCacheKeys', () => {
    it('should return all cache keys', () => {
      const keys = getAllCacheKeys();
      expect(keys).toHaveLength(7);
      expect(keys).toContain(CACHE_KEYS.DASHBOARD);
      expect(keys).toContain(CACHE_KEYS.USAGE_7D);
      expect(keys).toContain(CACHE_KEYS.USAGE_30D);
      expect(keys).toContain(CACHE_KEYS.USAGE_90D);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_7D);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_30D);
      expect(keys).toContain(CACHE_KEYS.TRAFFIC_90D);
    });
  });
});

describe('readAdminCache', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return null when BLOB_READ_WRITE_TOKEN is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { readAdminCache } = await import('@/lib/admin-cache');
    const result = await readAdminCache(CACHE_KEYS.DASHBOARD);

    expect(result).toBeNull();
  });
});

describe('writeAdminCache', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return early when BLOB_READ_WRITE_TOKEN is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { writeAdminCache } = await import('@/lib/admin-cache');
    // Should not throw
    await expect(
      writeAdminCache(CACHE_KEYS.DASHBOARD, { test: true })
    ).resolves.toBeUndefined();
  });
});
