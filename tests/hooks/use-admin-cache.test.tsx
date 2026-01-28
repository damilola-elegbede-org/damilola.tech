import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminCacheWithFallback } from '@/hooks/use-admin-cache';
import { CACHE_KEYS } from '@/lib/admin-cache';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAdminCacheWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should call the fetcher and return data', async () => {
    const mockData = { total: 100, environment: 'test' };
    const mockFetcher = vi.fn().mockResolvedValue(mockData);

    // Mock the cache update fetch
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: CACHE_KEYS.DASHBOARD,
        fetcher: mockFetcher,
      })
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('should not use cache when cacheKey is null', async () => {
    const mockData = { total: 50 };
    const mockFetcher = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: null, // Custom date range - no caching
        fetcher: mockFetcher,
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    // Should not call cache API when cacheKey is null
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/cache/'),
      expect.anything()
    );
  });

  it('should attempt to update cache after fetching fresh data', async () => {
    const mockData = { total: 100 };
    const mockFetcher = vi.fn().mockResolvedValue(mockData);

    // Mock cache update
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: CACHE_KEYS.USAGE_30D,
        fetcher: mockFetcher,
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    // Wait for cache update to be attempted
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/cache/usage-30d',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('should handle fetcher errors', async () => {
    const mockError = new Error('Failed to fetch');
    const mockFetcher = vi.fn().mockRejectedValue(mockError);

    // Use a unique cache key to avoid interference
    const uniqueKey = `${CACHE_KEYS.DASHBOARD}-error-test` as typeof CACHE_KEYS.DASHBOARD;

    const { result } = renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: uniqueKey,
        fetcher: mockFetcher,
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.data).toBeUndefined();
  });

  it('should include dateRange in cache update body', async () => {
    const mockData = { total: 100 };
    const mockFetcher = vi.fn().mockResolvedValue(mockData);
    const dateRange = { start: '2024-01-01', end: '2024-01-31' };

    mockFetch.mockResolvedValue({ ok: true });

    renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: CACHE_KEYS.TRAFFIC_30D,
        fetcher: mockFetcher,
        dateRange,
      })
    );

    await waitFor(() => {
      const putCall = mockFetch.mock.calls.find(
        (call) => call[0] === '/api/admin/cache/traffic-30d' && call[1]?.method === 'PUT'
      );
      // Assert PUT call was made
      expect(putCall).toBeDefined();
      // Assert body contains correct dateRange
      const body = JSON.parse(putCall![1].body);
      expect(body.dateRange).toEqual(dateRange);
    });
  });

  it('should not throw when cache update fails', async () => {
    const mockData = { total: 100 };
    const mockFetcher = vi.fn().mockResolvedValue(mockData);

    // Mock cache update to fail
    mockFetch.mockRejectedValue(new Error('Cache update failed'));

    // Use a unique cache key to avoid interference
    const uniqueKey = `${CACHE_KEYS.DASHBOARD}-cache-fail-test` as typeof CACHE_KEYS.DASHBOARD;

    const { result } = renderHook(() =>
      useAdminCacheWithFallback({
        cacheKey: uniqueKey,
        fetcher: mockFetcher,
      })
    );

    // Should still return data despite cache update failure
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    // Should not have an error (cache failure is silent)
    expect(result.current.error).toBeUndefined();
  });
});
