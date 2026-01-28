'use client';

import { useRef } from 'react';
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
 * Simpler hook that fetches data and updates cache.
 *
 * When cacheKey is provided:
 * 1. Fetch fresh data from API
 * 2. Update Blob cache in background
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

  // Generate SWR key - stable for same cacheKey/dateRange combination
  const swrKey = cacheKey
    ? cacheKey
    : `no-cache-${noCacheIdRef.current}-${dateRange?.start ?? ''}-${dateRange?.end ?? ''}`;

  // Fetcher that also updates cache
  const fetchAndCache = async (): Promise<T> => {
    const freshData = await fetcher();

    // Update cache if we have a cache key
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
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<T, Error>(
    swrKey,
    fetchAndCache,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
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
