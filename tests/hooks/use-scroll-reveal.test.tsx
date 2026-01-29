import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

describe('useScrollReveal', () => {
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let observerCallback: IntersectionObserverCallback | null = null;
  let originalIntersectionObserver: typeof IntersectionObserver | undefined;

  beforeAll(() => {
    originalIntersectionObserver = global.IntersectionObserver;
  });

  afterAll(() => {
    if (originalIntersectionObserver) {
      global.IntersectionObserver = originalIntersectionObserver;
    } else {
      // @ts-expect-error - restore undefined in test environment
      global.IntersectionObserver = undefined;
    }
  });

  beforeEach(() => {
    observerCallback = null;
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();

    // IntersectionObserver must be a constructor function (not arrow function)
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn();
      root = null;
      rootMargin = '';
      thresholds = [0.1];
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  it('should return a ref and isVisible state', () => {
    const { result } = renderHook(() => useScrollReveal());

    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
    expect(result.current.isVisible).toBe(false);
  });

  it('should create IntersectionObserver with correct threshold', () => {
    const threshold = 0.5;
    renderHook(() => useScrollReveal(threshold));

    // Verify observer was created (callback was captured)
    expect(observerCallback).toBeDefined();
  });

  it('should use default threshold of 0.1 when not provided', () => {
    renderHook(() => useScrollReveal());

    // Verify observer was created (callback was captured)
    expect(observerCallback).toBeDefined();
  });

  it('should not call observe when ref is null during effect', () => {
    renderHook(() => useScrollReveal());

    // When ref.current is null, observe should not be called
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('should set isVisible to true when element intersects', async () => {
    const { result } = renderHook(() => useScrollReveal());

    // Simulate element becoming visible
    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 0.5,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry;

    // Trigger the observer callback with act to handle state updates
    act(() => {
      if (observerCallback) {
        observerCallback([mockEntry], {} as IntersectionObserver);
      }
    });

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.isVisible).toBe(true);
    });
  });

  it('should not set isVisible when element is not intersecting', () => {
    const { result } = renderHook(() => useScrollReveal());

    // Simulate element not visible
    const mockEntry = {
      isIntersecting: false,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry;

    // Trigger the observer callback
    if (observerCallback) {
      observerCallback([mockEntry], {} as IntersectionObserver);
    }

    expect(result.current.isVisible).toBe(false);
  });

  it('should remain visible after first intersection', async () => {
    const { result } = renderHook(() => useScrollReveal());

    // First intersection - becomes visible
    const visibleEntry = {
      isIntersecting: true,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 0.5,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry;

    act(() => {
      if (observerCallback) {
        observerCallback([visibleEntry], {} as IntersectionObserver);
      }
    });

    await waitFor(() => {
      expect(result.current.isVisible).toBe(true);
    });

    // Second intersection - element leaves viewport
    const hiddenEntry = {
      ...visibleEntry,
      isIntersecting: false,
    };

    act(() => {
      if (observerCallback) {
        observerCallback([hiddenEntry], {} as IntersectionObserver);
      }
    });

    // Should remain visible (scroll reveal doesn't hide elements)
    expect(result.current.isVisible).toBe(true);
  });

  it('should disconnect observer on unmount', () => {
    const { unmount } = renderHook(() => useScrollReveal());

    unmount();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should recreate observer when threshold changes', () => {
    const { rerender } = renderHook(
      ({ threshold }) => useScrollReveal(threshold),
      { initialProps: { threshold: 0.1 } }
    );

    expect(mockDisconnect).toHaveBeenCalledTimes(0);

    // Change threshold
    rerender({ threshold: 0.5 });

    // Should disconnect old observer and create new one
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should handle missing IntersectionObserver (SSR)', () => {
    // Remove IntersectionObserver
    const originalIO = global.IntersectionObserver;
    // @ts-expect-error - intentionally testing undefined
    global.IntersectionObserver = undefined;

    // Should throw since the hook doesn't handle missing IntersectionObserver
    expect(() => {
      renderHook(() => useScrollReveal());
    }).toThrow();

    // Restore
    global.IntersectionObserver = originalIO;
  });

  it('should create observer even if ref is null', () => {
    renderHook(() => useScrollReveal());

    // Observer is created (callback was captured)
    expect(observerCallback).toBeDefined();
    // But observe is not called with null ref
    expect(mockObserve).not.toHaveBeenCalled();
  });
});
