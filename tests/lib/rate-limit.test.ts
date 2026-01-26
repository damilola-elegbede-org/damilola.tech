import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('rate-limit module', () => {
  describe('checkGenericRateLimit', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows requests within limit', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');

      const result = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, 'user-123');

      expect(result.limited).toBe(false);
      expect(result.remaining).toBe(49); // 50 - 1
    });

    it('blocks requests exceeding limit', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-456';

      // Make 50 requests (the limit)
      for (let i = 0; i < 50; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      }

      // 51st request should be blocked
      const result = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      expect(result.limited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('returns correct remaining count', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-789';

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      }

      const result = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      expect(result.remaining).toBe(39); // 50 - 11
    });

    it('returns Retry-After when blocked', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-blocked';

      // Exhaust the limit
      for (let i = 0; i < 50; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      }

      const result = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      expect(result.limited).toBe(true);
      // Should return retry-after close to 5 minutes (300 seconds)
      expect(result.retryAfter).toBeLessThanOrEqual(300);
      expect(result.retryAfter).toBeGreaterThan(290);
    });

    it('resets after window expires', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-reset';

      // Make some requests
      for (let i = 0; i < 10; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      }

      // Advance time past window (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Should have full limit again
      const result = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      expect(result.limited).toBe(false);
      expect(result.remaining).toBe(49); // 50 - 1 (this request)
    });

    it('handles different endpoint configs independently', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-multi';

      // Exhaust chat limit (50 requests)
      for (let i = 0; i < 50; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      }

      // Chat should be blocked
      const chatResult = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, identifier);
      expect(chatResult.limited).toBe(true);

      // But fit-assessment should still be allowed (different endpoint)
      const fitResult = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.fitAssessment, identifier);
      expect(fitResult.limited).toBe(false);
      expect(fitResult.remaining).toBe(9); // 10 - 1
    });

    it('uses hourly window for fit-assessment', async () => {
      const { checkGenericRateLimit, RATE_LIMIT_CONFIGS } = await import('@/lib/rate-limit');
      const identifier = 'user-fit';

      // Make 10 requests (the limit for fit-assessment)
      for (let i = 0; i < 10; i++) {
        await checkGenericRateLimit(RATE_LIMIT_CONFIGS.fitAssessment, identifier);
      }

      // Should be blocked
      const blocked = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.fitAssessment, identifier);
      expect(blocked.limited).toBe(true);

      // Retry-after should be close to 1 hour (3600 seconds)
      expect(blocked.retryAfter).toBeLessThanOrEqual(3600);
      expect(blocked.retryAfter).toBeGreaterThan(3590);
    });
  });

  describe('createRateLimitResponse', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('creates 429 response with Retry-After header', async () => {
      const { createRateLimitResponse } = await import('@/lib/rate-limit');

      const result = { limited: true, retryAfter: 120, remaining: 0 };
      const response = createRateLimitResponse(result);

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('120');
    });

    it('includes error message in body', async () => {
      const { createRateLimitResponse } = await import('@/lib/rate-limit');

      const result = { limited: true, retryAfter: 60, remaining: 0 };
      const response = createRateLimitResponse(result);

      const body = await response.json();
      expect(body.error).toContain('Too many requests');
    });
  });

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
