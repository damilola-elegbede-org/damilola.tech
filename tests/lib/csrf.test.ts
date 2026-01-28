import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';

// Mock Next.js headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.get.mockClear();
    mockCookieStore.set.mockClear();
    mockCookieStore.delete.mockClear();
  });

  describe('validateCsrfToken', () => {
    it('returns true when header token matches cookie token', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      const token = 'test-csrf-token-12345';
      mockCookieStore.get.mockReturnValue({ value: token });

      const result = await validateCsrfToken(token);

      expect(result).toBe(true);
      expect(mockCookieStore.get).toHaveBeenCalledWith('csrf_token');
    });

    it('returns false when header token is null', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      const result = await validateCsrfToken(null);

      expect(result).toBe(false);
      // Should return early without checking cookie
      expect(mockCookieStore.get).not.toHaveBeenCalled();
    });

    it('returns false when header token is empty string', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      // Empty string is falsy
      const result = await validateCsrfToken('');

      expect(result).toBe(false);
    });

    it('returns false when cookie token is missing', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      mockCookieStore.get.mockReturnValue(undefined);

      const result = await validateCsrfToken('some-token');

      expect(result).toBe(false);
      expect(mockCookieStore.get).toHaveBeenCalledWith('csrf_token');
    });

    it('returns false when cookie has no value', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      mockCookieStore.get.mockReturnValue({});

      const result = await validateCsrfToken('some-token');

      expect(result).toBe(false);
    });

    it('returns false when tokens do not match', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      mockCookieStore.get.mockReturnValue({ value: 'cookie-token' });

      const result = await validateCsrfToken('different-token');

      expect(result).toBe(false);
    });

    it('returns false when token lengths differ', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      mockCookieStore.get.mockReturnValue({ value: 'short' });

      const result = await validateCsrfToken('much-longer-token');

      expect(result).toBe(false);
    });

    it('uses timing-safe comparison for matching tokens', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      // Generate realistic hex token
      const token = randomBytes(32).toString('hex');
      mockCookieStore.get.mockReturnValue({ value: token });

      const result = await validateCsrfToken(token);

      expect(result).toBe(true);
    });

    it('handles tokens with special characters', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      const token = 'token-with-special-chars!@#$%';
      mockCookieStore.get.mockReturnValue({ value: token });

      const result = await validateCsrfToken(token);

      expect(result).toBe(true);
    });

    it('is case-sensitive for token comparison', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      mockCookieStore.get.mockReturnValue({ value: 'TokenABC123' });

      const result = await validateCsrfToken('tokenabc123');

      expect(result).toBe(false);
    });

    it('returns false when timingSafeEqual throws error', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      // Create buffers that would cause timingSafeEqual to throw
      // by mocking with invalid encoding that might fail
      const token = 'valid-token';
      mockCookieStore.get.mockReturnValue({ value: token });

      // Spy on Buffer.from to make timingSafeEqual throw
      const originalBufferFrom = Buffer.from.bind(Buffer);
      let callCount = 0;
       
      vi.spyOn(Buffer, 'from').mockImplementation(((input: unknown, encoding?: BufferEncoding) => {
        callCount++;
        // First call succeeds (header buffer), second call throws (cookie buffer)
        if (callCount === 2) {
          throw new Error('Buffer creation failed');
        }
        return originalBufferFrom(input as string, encoding);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const result = await validateCsrfToken(token);

      expect(result).toBe(false);

      // Restore original implementation
      vi.restoreAllMocks();
    });
  });

  describe('clearCsrfToken', () => {
    it('deletes the csrf_token cookie', async () => {
      const { clearCsrfToken } = await import('@/lib/csrf');

      await clearCsrfToken();

      expect(mockCookieStore.delete).toHaveBeenCalledWith({
        name: 'csrf_token',
        path: '/',
      });
    });

    it('does not throw if cookie does not exist', async () => {
      const { clearCsrfToken } = await import('@/lib/csrf');

      // Mock delete to simulate no-op
      mockCookieStore.delete.mockReturnValue(undefined);

      await expect(clearCsrfToken()).resolves.not.toThrow();
    });
  });

  describe('generateCsrfToken', () => {
    it('generates a valid hex token', async () => {
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      const token = await generateCsrfToken();

      // Should be 64 chars (32 bytes * 2 hex chars per byte)
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('sets token in cookie with correct options', async () => {
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      await generateCsrfToken();

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'csrf_token',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60, // 1 hour
        }
      );
    });

    it('returns the same token that was set in cookie', async () => {
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      const token = await generateCsrfToken();

      // Verify the returned token matches what was stored
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'csrf_token',
        token,
        expect.any(Object)
      );
    });

    it('generates unique tokens on subsequent calls', async () => {
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      const token1 = await generateCsrfToken();
      const token2 = await generateCsrfToken();

      expect(token1).not.toBe(token2);
    });

    it('uses secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
       
      delete (process.env as Record<string, unknown>).NODE_ENV;
       
      (process.env as Record<string, unknown>).NODE_ENV = 'production';

      // Re-import to pick up new env
      vi.resetModules();
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      await generateCsrfToken();

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({
          secure: true,
        })
      );

       
      delete (process.env as Record<string, unknown>).NODE_ENV;
       
      if (originalEnv) (process.env as Record<string, unknown>).NODE_ENV = originalEnv;
    });

    it('does not use secure flag in development', async () => {
      const originalEnv = process.env.NODE_ENV;
       
      delete (process.env as Record<string, unknown>).NODE_ENV;
       
      (process.env as Record<string, unknown>).NODE_ENV = 'development';

      // Re-import to pick up new env
      vi.resetModules();
      const { generateCsrfToken } = await import('@/lib/csrf-actions');

      await generateCsrfToken();

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({
          secure: false,
        })
      );

       
      delete (process.env as Record<string, unknown>).NODE_ENV;
       
      if (originalEnv) (process.env as Record<string, unknown>).NODE_ENV = originalEnv;
    });
  });

  describe('Constants', () => {
    it('exports CSRF_HEADER constant', async () => {
      const { CSRF_HEADER } = await import('@/lib/csrf');

      expect(CSRF_HEADER).toBe('x-csrf-token');
    });

    it('exports CSRF_COOKIE constant', async () => {
      const { CSRF_COOKIE } = await import('@/lib/csrf');

      expect(CSRF_COOKIE).toBe('csrf_token');
    });
  });

  describe('Integration - Double Submit Cookie Pattern', () => {
    it('validates the complete flow: generate, validate, clear', async () => {
      // Step 1: Generate token
      const { generateCsrfToken } = await import('@/lib/csrf-actions');
      const token = await generateCsrfToken();

      // Verify token was stored in cookie
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'csrf_token',
        token,
        expect.any(Object)
      );

      // Step 2: Validate token (simulate form submission)
      const { validateCsrfToken } = await import('@/lib/csrf');
      mockCookieStore.get.mockReturnValue({ value: token });

      const isValid = await validateCsrfToken(token);
      expect(isValid).toBe(true);

      // Step 3: Clear token (after successful operation)
      const { clearCsrfToken } = await import('@/lib/csrf');
      await clearCsrfToken();

      expect(mockCookieStore.delete).toHaveBeenCalledWith({
        name: 'csrf_token',
        path: '/',
      });
    });

    it('prevents CSRF attack with mismatched tokens', async () => {
      const { generateCsrfToken } = await import('@/lib/csrf-actions');
      const { validateCsrfToken } = await import('@/lib/csrf');

      // Legitimate token generation
      const legitimateToken = await generateCsrfToken();

      // Attacker provides different token in header
      const attackerToken = randomBytes(32).toString('hex');

      // Cookie still has legitimate token
      mockCookieStore.get.mockReturnValue({ value: legitimateToken });

      // Validation should fail
      const isValid = await validateCsrfToken(attackerToken);
      expect(isValid).toBe(false);
    });

    it('prevents CSRF attack with missing cookie', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');

      // Attacker provides valid-looking token but no cookie
      const attackerToken = randomBytes(32).toString('hex');
      mockCookieStore.get.mockReturnValue(undefined);

      const isValid = await validateCsrfToken(attackerToken);
      expect(isValid).toBe(false);
    });
  });
});
