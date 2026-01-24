import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('rate-limit module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('allows first attempt', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');

      const result = await checkRateLimit('192.168.1.1');

      expect(result.limited).toBe(false);
      expect(result.remainingAttempts).toBe(5);
    });

    it('allows attempts up to the limit', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.2';

      // Record 4 failed attempts (limit is 5)
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(ip);
      }

      const result = await checkRateLimit(ip);
      expect(result.limited).toBe(false);
      expect(result.remainingAttempts).toBe(1);
    });

    it('blocks after exceeding limit', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.3';

      // Record 5 failed attempts (hits the limit)
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(ip);
      }

      const result = await checkRateLimit(ip);
      expect(result.limited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('returns correct retry-after time', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.4';

      // Hit the limit
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(ip);
      }

      const result = await checkRateLimit(ip);
      // Should be close to 15 minutes (900 seconds)
      expect(result.retryAfter).toBeLessThanOrEqual(900);
      expect(result.retryAfter).toBeGreaterThan(890);
    });

    it('unlocks after lockout period', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.5';

      // Hit the limit
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(ip);
      }

      expect((await checkRateLimit(ip)).limited).toBe(true);

      // Advance time past lockout (15 minutes)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      const result = await checkRateLimit(ip);
      expect(result.limited).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('increments attempt count', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.6';

      expect((await checkRateLimit(ip)).remainingAttempts).toBe(5);

      await recordFailedAttempt(ip);
      expect((await checkRateLimit(ip)).remainingAttempts).toBe(4);

      await recordFailedAttempt(ip);
      expect((await checkRateLimit(ip)).remainingAttempts).toBe(3);
    });

    it('resets after window expires', async () => {
      const { checkRateLimit, recordFailedAttempt } = await import('@/lib/rate-limit');
      const ip = '192.168.1.7';

      // Record some attempts
      await recordFailedAttempt(ip);
      await recordFailedAttempt(ip);
      expect((await checkRateLimit(ip)).remainingAttempts).toBe(3);

      // Advance time past window (15 minutes)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      // Should reset
      const result = await checkRateLimit(ip);
      expect(result.remainingAttempts).toBe(5);
    });
  });

  describe('clearRateLimit', () => {
    it('clears rate limit for IP', async () => {
      const { checkRateLimit, recordFailedAttempt, clearRateLimit } = await import('@/lib/rate-limit');
      const ip = '192.168.1.8';

      // Record some attempts
      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(ip);
      }
      expect((await checkRateLimit(ip)).remainingAttempts).toBe(2);

      // Clear (simulating successful login)
      await clearRateLimit(ip);

      // Should be fresh
      expect((await checkRateLimit(ip)).remainingAttempts).toBe(5);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');

      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      });

      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts IP from x-real-ip header', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');

      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '203.0.113.195' },
      });

      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('returns unknown when no headers present', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');

      const req = new Request('http://localhost');

      expect(getClientIp(req)).toBe('unknown');
    });

    it('prefers x-forwarded-for over x-real-ip', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');

      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '203.0.113.195',
          'x-real-ip': '10.0.0.1',
        },
      });

      expect(getClientIp(req)).toBe('203.0.113.195');
    });
  });
});
