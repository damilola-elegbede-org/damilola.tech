'use client';

import { useRef, useCallback, useEffect } from 'react';
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
  // Generate a stable unique ID per hook instance using lazy initialization
  const idRef = useRef<{ id: number } | null>(null);
  if (idRef.current === null) {
    idRef.current = { id: ++noCacheCounter };
  }
  const noCacheId = idRef.current.id;

  // Track if we've triggered background revalidation
  const revalidationTriggeredRef = useRef(false);
  // Track cache timestamp to check staleness
  const cacheTimestampRef = useRef<string | null>(null);

  // Reset refs when cache key or date range changes
  useEffect(() => {
    revalidationTriggeredRef.current = false;
    cacheTimestampRef.current = null;
  }, [cacheKey, dateRange?.start, dateRange?.end]);

  // Generate SWR key - stable for same cacheKey/dateRange combination
  const swrKey = cacheKey
    ? cacheKey
    : `no-cache-${noCacheId}-${dateRange?.start ?? ''}-${dateRange?.end ?? ''}`;

  // Function to fetch fresh data and update Blob cache
  const fetchFreshAndUpdateCache = useCallback(async (): Promise<T> => {
    const freshData = await fetcher();

    // Update Blob cache in background if we have a cache key
    if (cacheKey) {
      fetch(`/api/admin/cache/${cacheKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: freshData, dateRange }),
      })
        .then((res) => {
          if (!res.ok) {
            console.warn('[useAdminCache] Cache update failed:', res.status);
          }
        })
        .catch((err) => {
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
          // Track cache timestamp for staleness check
          cacheTimestampRef.current = entry.cachedAt || null;
          // Cache hit - return cached data immediately
          // SWR will handle background revalidation via revalidateOnMount
          return entry.data as T;
        }
        console.warn(`[useAdminCache] Cache hit but no data for ${cacheKey}`);
      } else if (cacheRes.status === 404) {
        // Normal cache miss
        console.debug?.(`[useAdminCache] Cache miss for ${cacheKey}`);
      } else {
        console.warn(`[useAdminCache] Cache fetch failed for ${cacheKey}: ${cacheRes.status}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[useAdminCache] Cache read error for ${cacheKey}: ${errorMsg}`);
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
      // After initial cache hit, trigger background revalidation if cache is stale
      onSuccess: (cachedData) => {
        // Only revalidate once per mount when we got data from cache
        if (cacheKey && !revalidationTriggeredRef.current && cachedData) {
          revalidationTriggeredRef.current = true;

          // Skip revalidation if cache is fresh (less than 1 minute old)
          if (cacheTimestampRef.current) {
            const cacheAge = Date.now() - new Date(cacheTimestampRef.current).getTime();
            const STALE_THRESHOLD_MS = 60 * 1000; // 1 minute
            if (cacheAge < STALE_THRESHOLD_MS) {
              console.debug?.(`[useAdminCache] Cache fresh for ${cacheKey}, skipping revalidation`);
              return;
            }
          }

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
              })
                .then((res) => {
                  if (!res.ok) {
                    console.warn('[useAdminCache] Cache update failed:', res.status);
                  }
                })
                .catch((err) => {
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
