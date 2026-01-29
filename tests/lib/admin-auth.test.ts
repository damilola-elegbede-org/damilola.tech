/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('admin-auth module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  describe('verifyPassword', () => {
    it('returns success for correct production password', async () => {
      process.env.VERCEL_ENV = 'production';
      process.env.ADMIN_PASSWORD_PRODUCTION = 'secret123';

      const { verifyPassword } = await import('@/lib/admin-auth');
      expect(verifyPassword('secret123')).toEqual({ success: true });
    });

    it('returns invalid_password for incorrect password', async () => {
      process.env.VERCEL_ENV = 'production';
      process.env.ADMIN_PASSWORD_PRODUCTION = 'secret123';

      const { verifyPassword } = await import('@/lib/admin-auth');
      expect(verifyPassword('wrong')).toEqual({ success: false, reason: 'invalid_password' });
    });

    it('returns invalid_password when password length differs', async () => {
      process.env.VERCEL_ENV = 'production';
      process.env.ADMIN_PASSWORD_PRODUCTION = 'secret123';

      const { verifyPassword } = await import('@/lib/admin-auth');
      expect(verifyPassword('short')).toEqual({ success: false, reason: 'invalid_password' });
    });

    it('uses preview password for preview environment', async () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.ADMIN_PASSWORD_PREVIEW = 'preview123';

      const { verifyPassword } = await import('@/lib/admin-auth');
      expect(verifyPassword('preview123')).toEqual({ success: true });
    });

    it('returns config_error when password not configured', async () => {
      process.env.VERCEL_ENV = 'production';
      delete process.env.ADMIN_PASSWORD_PRODUCTION;

      const { verifyPassword } = await import('@/lib/admin-auth');
      expect(verifyPassword('anything')).toEqual({ success: false, reason: 'config_error' });
    });
  });

  describe('signToken and verifyToken', () => {
    it('creates a valid token that can be verified', async () => {
      process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum';

      const { signToken, verifyToken } = await import('@/lib/admin-auth');

      const token = await signToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const isValid = await verifyToken(token);
      expect(isValid).toBe(true);
    });

    it('returns false for invalid token', async () => {
      process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum';

      const { verifyToken } = await import('@/lib/admin-auth');

      const isValid = await verifyToken('invalid-token');
      expect(isValid).toBe(false);
    });

    it('returns false for tampered token', async () => {
      process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum';

      const { signToken, verifyToken } = await import('@/lib/admin-auth');

      const token = await signToken();
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      const isValid = await verifyToken(tamperedToken);
      expect(isValid).toBe(false);
    });

    it('throws when JWT_SECRET not configured for signing', async () => {
      delete process.env.JWT_SECRET;

      const { signToken } = await import('@/lib/admin-auth');

      await expect(signToken()).rejects.toThrow('JWT_SECRET not configured');
    });
  });

  describe('getAuthCookieOptions', () => {
    it('returns secure options in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const { getAuthCookieOptions } = await import('@/lib/admin-auth');
      const options = getAuthCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.maxAge).toBe(24 * 60 * 60);
      expect(options.path).toBe('/');
    });

    it('returns non-secure options in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const { getAuthCookieOptions } = await import('@/lib/admin-auth');
      const options = getAuthCookieOptions();

      expect(options.secure).toBe(false);
    });
  });
});
