import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
vi.mock('@/lib/admin-auth', () => ({
  verifyPassword: vi.fn(),
  signToken: vi.fn(),
  getAuthCookieOptions: vi.fn(),
  ADMIN_COOKIE_NAME: 'admin_session',
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  recordFailedAttempt: vi.fn(),
  clearRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn(),
  clearCsrfToken: vi.fn(),
  CSRF_HEADER: 'x-csrf-token',
}));

vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: vi.fn(),
}));

// Mock Next.js cookies
const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('admin auth API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieStore.set.mockClear();
    mockCookieStore.delete.mockClear();
  });

  describe('POST - login', () => {
    it('returns session token on valid password', async () => {
      const { verifyPassword, signToken, getAuthCookieOptions, ADMIN_COOKIE_NAME } = await import('@/lib/admin-auth');
      const { checkRateLimit, clearRateLimit, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken, clearCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(verifyPassword).mockReturnValue({ success: true });
      vi.mocked(signToken).mockResolvedValue('test-jwt-token');
      vi.mocked(getAuthCookieOptions).mockReturnValue({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 86400,
        path: '/',
      });
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify password was checked
      expect(verifyPassword).toHaveBeenCalledWith('correct-password');

      // Verify session token was created and stored in cookie
      expect(signToken).toHaveBeenCalled();
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        ADMIN_COOKIE_NAME,
        'test-jwt-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 86400,
          path: '/',
        }
      );

      // Verify rate limit was cleared
      expect(clearRateLimit).toHaveBeenCalledWith('192.168.1.1');

      // Verify CSRF token was cleared
      expect(clearCsrfToken).toHaveBeenCalled();

      // Verify success event was logged (fire-and-forget, so check it was called)
      expect(logAdminEvent).toHaveBeenCalledWith('admin_login_success', {}, '192.168.1.1');
    });

    it('returns 401 on invalid password', async () => {
      const { verifyPassword } = await import('@/lib/admin-auth');
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(verifyPassword).mockReturnValue({ success: false, reason: 'invalid_password' });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'wrong-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid password');

      // Verify failed attempt was recorded
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');

      // Verify failure event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'invalid_password' },
        '192.168.1.1'
      );
    });

    it('returns 429 when rate limited', async () => {
      const { checkRateLimit, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: true, retryAfter: 900 });
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'any-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many login attempts');
      expect(data.retryAfter).toBe(900);
      expect(response.headers.get('Retry-After')).toBe('900');

      // Verify rate_limited event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'rate_limited' },
        '192.168.1.1'
      );
    });

    it('returns 429 after recording failed attempt triggers lockout', async () => {
      const { verifyPassword } = await import('@/lib/admin-auth');
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      // First check passes
      vi.mocked(checkRateLimit)
        .mockResolvedValueOnce({ limited: false, remainingAttempts: 1 })
        // Second check (after recording failed attempt) shows lockout
        .mockResolvedValueOnce({ limited: true, retryAfter: 900 });
      vi.mocked(verifyPassword).mockReturnValue({ success: false, reason: 'invalid_password' });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'wrong-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many login attempts');
      expect(data.retryAfter).toBe(900);

      // Verify failed attempt was recorded
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');

      // Verify both checks were called
      expect(checkRateLimit).toHaveBeenCalledTimes(2);
    });

    it('returns 403 on invalid CSRF token', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { getClientIp } = await import('@/lib/rate-limit');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'invalid-csrf-token',
        },
        body: JSON.stringify({ password: 'any-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid request');

      // Verify CSRF validation was called
      expect(validateCsrfToken).toHaveBeenCalledWith('invalid-csrf-token');

      // Verify invalid_csrf event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'invalid_csrf' },
        '192.168.1.1'
      );
    });

    it('returns 403 on missing CSRF token', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { getClientIp } = await import('@/lib/rate-limit');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No CSRF header
        },
        body: JSON.stringify({ password: 'any-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid request');

      // Verify CSRF validation was called with null
      expect(validateCsrfToken).toHaveBeenCalledWith(null);
    });

    it('returns 400 on missing password', async () => {
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password is required');

      // Verify failed attempt was recorded (prevent rate limit bypass)
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');

      // Verify missing_password event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'missing_password' },
        '192.168.1.1'
      );
    });

    it('returns 400 on empty password', async () => {
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password is required');

      // Verify failed attempt was recorded
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');
    });

    it('returns 400 on invalid JSON body', async () => {
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');

      // Verify failed attempt was recorded (prevent rate limit bypass)
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');

      // Verify invalid_json event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'invalid_json' },
        '192.168.1.1'
      );
    });

    it('returns 429 when invalid JSON triggers lockout', async () => {
      const { checkRateLimit, recordFailedAttempt, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      // First check passes
      vi.mocked(checkRateLimit)
        .mockResolvedValueOnce({ limited: false, remainingAttempts: 1 })
        // Second check (after recording failed attempt) shows lockout
        .mockResolvedValueOnce({ limited: true, retryAfter: 900 });
      vi.mocked(recordFailedAttempt).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many login attempts');
      expect(data.retryAfter).toBe(900);

      // Verify failed attempt was recorded
      expect(recordFailedAttempt).toHaveBeenCalledWith('192.168.1.1');
    });

    it('returns 500 on internal error', async () => {
      const { validateCsrfToken } = await import('@/lib/csrf');
      const { checkRateLimit, getClientIp } = await import('@/lib/rate-limit');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockRejectedValue(new Error('Database connection failed'));
      vi.mocked(logAdminEvent).mockResolvedValue();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'any-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Login failed');

      // Verify internal_error event was logged
      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_login_failure',
        { reason: 'internal_error' },
        '192.168.1.1'
      );

      consoleSpy.mockRestore();
    });

    it('handles logAdminEvent fire-and-forget error on success', async () => {
      const { verifyPassword, signToken, getAuthCookieOptions } = await import('@/lib/admin-auth');
      const { checkRateLimit, clearRateLimit, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken, clearCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(verifyPassword).mockReturnValue({ success: true });
      vi.mocked(signToken).mockResolvedValue('test-jwt-token');
      vi.mocked(getAuthCookieOptions).mockReturnValue({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 86400,
        path: '/',
      });
      vi.mocked(clearCsrfToken).mockResolvedValue();
      vi.mocked(clearRateLimit).mockResolvedValue();
      // logAdminEvent fails but should not affect response
      vi.mocked(logAdminEvent).mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
        },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed despite logging error
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Wait for the fire-and-forget promise to settle
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify error was logged to console
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/auth] Failed to log success event:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('extracts IP from x-forwarded-for header', async () => {
      const { verifyPassword, signToken, getAuthCookieOptions } = await import('@/lib/admin-auth');
      const { checkRateLimit, clearRateLimit, getClientIp } = await import('@/lib/rate-limit');
      const { validateCsrfToken, clearCsrfToken } = await import('@/lib/csrf');
      const { logAdminEvent } = await import('@/lib/audit-server');

      // Mock getClientIp to return the forwarded IP
      vi.mocked(getClientIp).mockImplementation((req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
      });
      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(checkRateLimit).mockResolvedValue({ limited: false, remainingAttempts: 5 });
      vi.mocked(verifyPassword).mockReturnValue({ success: true });
      vi.mocked(signToken).mockResolvedValue('test-jwt-token');
      vi.mocked(getAuthCookieOptions).mockReturnValue({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 86400,
        path: '/',
      });
      vi.mocked(clearCsrfToken).mockResolvedValue();
      vi.mocked(clearRateLimit).mockResolvedValue();
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { POST } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'valid-csrf-token',
          'x-forwarded-for': '203.0.113.1, 192.168.1.1',
        },
        body: JSON.stringify({ password: 'correct-password' }),
      });

      await POST(request);

      // Verify clearRateLimit was called with the correct IP
      expect(clearRateLimit).toHaveBeenCalledWith('203.0.113.1');
    });
  });

  describe('DELETE - logout', () => {
    it('clears session cookie and returns success', async () => {
      const { ADMIN_COOKIE_NAME } = await import('@/lib/admin-auth');
      const { getClientIp } = await import('@/lib/rate-limit');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { DELETE } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify cookie was deleted
      expect(mockCookieStore.delete).toHaveBeenCalledWith(ADMIN_COOKIE_NAME);

      // Verify logout event was logged
      expect(logAdminEvent).toHaveBeenCalledWith('admin_logout', {}, '192.168.1.1');
    });

    it('returns 500 on logout error', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');
      const { cookies } = await import('next/headers');

      vi.mocked(getClientIp).mockReturnValue('192.168.1.1');
      // Make cookies() throw an error
      vi.mocked(cookies).mockRejectedValueOnce(new Error('Cookie store error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { DELETE } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Logout failed');

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/auth] Logout error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('extracts IP from request headers', async () => {
      const { getClientIp } = await import('@/lib/rate-limit');
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(getClientIp).mockImplementation((req) => {
        const forwarded = req.headers.get('x-forwarded-for');
        return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
      });
      vi.mocked(logAdminEvent).mockResolvedValue();

      const { DELETE } = await import('@/app/api/admin/auth/route');

      const request = new Request('http://localhost/api/admin/auth', {
        method: 'DELETE',
        headers: {
          'x-forwarded-for': '198.51.100.1',
        },
      });

      await DELETE(request);

      // Verify logout event was logged with correct IP
      expect(logAdminEvent).toHaveBeenCalledWith('admin_logout', {}, '198.51.100.1');
    });
  });
});
