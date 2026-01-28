'use client';

import { useRef, useCallback } from 'react';
import useSWR from 'swr';
import type { CacheKey } from '@/lib/admin-cache';

interface UseAdminCacheOptions<T> {
  /**
   * Cache key for Vercel Blob. Pass null to skip caching (e.g., custom date ranges).
   */
  cacheKey: CacheKey | null;
  /**
   * Function to fetch fresh data from the API.
   */
  fetcher: () => Promise<T>;
  /**
   * Date range to include in cache metadata.
   */
  dateRange?: { start: string; end: string };
}

interface UseAdminCacheResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
}

// Counter to generate unique IDs for non-cached requests (incremented once per hook instance)
let noCacheCounter = 0;

/**
 * SWR-based hook with cache-first loading pattern.
 *
 * When cacheKey is provided:
 * 1. First load: Try Blob cache (~200ms), return if hit
 * 2. Background: Fetch fresh data from API, update SWR + Blob cache
 *
 * When cacheKey is null (custom date range):
 * - Fetch directly from API, no caching
 */
export function useAdminCacheWithFallback<T>({
  cacheKey,
  fetcher,
  dateRange,
}: UseAdminCacheOptions<T>): UseAdminCacheResult<T> {
  // Generate a stable unique ID per hook instance (only increments once on mount)
  const noCacheIdRef = useRef<number | null>(null);
  if (noCacheIdRef.current === null) {
    noCacheIdRef.current = ++noCacheCounter;
  }

  // Track if we've triggered background revalidation
  const revalidationTriggeredRef = useRef(false);

  // Generate SWR key - stable for same cacheKey/dateRange combination
  const swrKey = cacheKey
    ? cacheKey
    : `no-cache-${noCacheIdRef.current}-${dateRange?.start ?? ''}-${dateRange?.end ?? ''}`;

  // Function to fetch fresh data and update Blob cache
  const fetchFreshAndUpdateCache = useCallback(async (): Promise<T> => {
    const freshData = await fetcher();

    // Update Blob cache in background if we have a cache key
    if (cacheKey) {
      fetch(`/api/admin/cache/${cacheKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: freshData, dateRange }),
      }).catch((err) => {
        console.warn('[useAdminCache] Failed to update cache:', err);
      });
    }

    return freshData;
  }, [cacheKey, fetcher, dateRange]);

  // Cache-first fetcher: try Blob cache, then fall back to fresh fetch
  const fetchWithCacheFirst = useCallback(async (): Promise<T> => {
    // For non-cached requests, go directly to API
    if (!cacheKey) {
      return fetchFreshAndUpdateCache();
    }

    // Try Blob cache first (fast ~200ms)
    try {
      const cacheRes = await fetch(`/api/admin/cache/${cacheKey}`);
      if (cacheRes.ok) {
        const entry = await cacheRes.json();
        if (entry?.data) {
          // Cache hit - return cached data immediately
          // SWR will handle background revalidation via revalidateOnMount
          return entry.data as T;
        }
      }
    } catch {
      // Cache miss or error, continue to fresh fetch
    }

    // No cache - fetch fresh (slow ~3s)
    return fetchFreshAndUpdateCache();
  }, [cacheKey, fetchFreshAndUpdateCache]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<T, Error>(
    swrKey,
    fetchWithCacheFirst,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
      // After initial cache hit, trigger background revalidation
      onSuccess: (cachedData) => {
        // Only revalidate once per mount when we got data from cache
        if (cacheKey && !revalidationTriggeredRef.current && cachedData) {
          revalidationTriggeredRef.current = true;
          // Schedule background revalidation after returning cached data
          setTimeout(async () => {
            try {
              const freshData = await fetcher();
              // Update SWR cache without revalidation loop
              mutate(freshData, false);
              // Update Blob cache
              fetch(`/api/admin/cache/${cacheKey}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: freshData, dateRange }),
              }).catch((err) => {
                console.warn('[useAdminCache] Failed to update cache:', err);
              });
            } catch (err) {
              console.warn('[useAdminCache] Background revalidation failed:', err);
            }
          }, 100);
        }
      },
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => mutate(),
  };
}
