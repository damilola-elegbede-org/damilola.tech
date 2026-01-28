/**
 * Admin cache utilities for stale-while-revalidate caching.
 *
 * Cache is stored in Vercel Blob and pre-populated at build time.
 * Pages show cached data instantly, then revalidate in background.
 */

import { list, put } from '@vercel/blob';

// Cache key constants
export const CACHE_KEYS = {
  DASHBOARD: 'dashboard',
  USAGE_7D: 'usage-7d',
  USAGE_30D: 'usage-30d',
  USAGE_90D: 'usage-90d',
  TRAFFIC_7D: 'traffic-7d',
  TRAFFIC_30D: 'traffic-30d',
  TRAFFIC_90D: 'traffic-90d',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// Map preset to cache key
export const PRESET_TO_CACHE_KEY: Record<string, CacheKey | null> = {
  '7d': CACHE_KEYS.USAGE_7D,
  '30d': CACHE_KEYS.USAGE_30D,
  '90d': CACHE_KEYS.USAGE_90D,
  'custom': null, // Custom ranges bypass cache
};

export const PRESET_TO_TRAFFIC_CACHE_KEY: Record<string, CacheKey | null> = {
  '7d': CACHE_KEYS.TRAFFIC_7D,
  '30d': CACHE_KEYS.TRAFFIC_30D,
  '90d': CACHE_KEYS.TRAFFIC_90D,
  'custom': null,
};

// Cache entry structure
export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Blob path prefix for admin cache
const CACHE_PATH_PREFIX = 'damilola.tech/admin-cache';

/**
 * Get the blob path for a cache key.
 */
export function getCacheBlobPath(key: CacheKey, env: string): string {
  return `${CACHE_PATH_PREFIX}/${env}/${key}.json`;
}

/**
 * Read admin cache from Vercel Blob.
 * Returns null if cache doesn't exist or is invalid.
 */
export async function readAdminCache<T>(
  key: CacheKey,
  env?: string
): Promise<CacheEntry<T> | null> {
  const environment = env || process.env.VERCEL_ENV || 'production';
  const blobPath = getCacheBlobPath(key, environment);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.warn('[admin-cache] BLOB_READ_WRITE_TOKEN not configured');
    return null;
  }

  try {
    // List blobs to find our cache file
    const { blobs } = await list({
      prefix: blobPath,
      token,
    });

    const blob = blobs.find((b) => b.pathname === blobPath);

    if (!blob) {
      return null;
    }

    // Fetch the content
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(blob.url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }

      const content = await response.json();
      return content as CacheEntry<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`[admin-cache] Error reading cache ${key}:`, error);
    return null;
  }
}

/**
 * Write admin cache to Vercel Blob.
 */
export async function writeAdminCache<T>(
  key: CacheKey,
  data: T,
  dateRange?: { start: string; end: string },
  env?: string
): Promise<void> {
  const environment = env || process.env.VERCEL_ENV || 'production';
  const blobPath = getCacheBlobPath(key, environment);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.warn('[admin-cache] BLOB_READ_WRITE_TOKEN not configured');
    return;
  }

  const cacheEntry: CacheEntry<T> = {
    data,
    cachedAt: new Date().toISOString(),
    dateRange,
  };

  try {
    await put(blobPath, JSON.stringify(cacheEntry), {
      access: 'public',
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (error) {
    console.error(`[admin-cache] Error writing cache ${key}:`, error);
    throw error;
  }
}

/**
 * Get all cache keys for a specific type (usage or traffic).
 */
export function getUsageCacheKeys(): CacheKey[] {
  return [CACHE_KEYS.USAGE_7D, CACHE_KEYS.USAGE_30D, CACHE_KEYS.USAGE_90D];
}

export function getTrafficCacheKeys(): CacheKey[] {
  return [CACHE_KEYS.TRAFFIC_7D, CACHE_KEYS.TRAFFIC_30D, CACHE_KEYS.TRAFFIC_90D];
}

export function getAllCacheKeys(): CacheKey[] {
  return Object.values(CACHE_KEYS);
}
