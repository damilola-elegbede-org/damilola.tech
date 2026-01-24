import { cookies } from 'next/headers';
import {
  verifyPassword,
  signToken,
  getAuthCookieOptions,
  ADMIN_COOKIE_NAME,
} from '@/lib/admin-auth';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIp,
} from '@/lib/rate-limit';
import { validateCsrfToken, clearCsrfToken, CSRF_HEADER } from '@/lib/csrf';
import { logAdminEvent } from '@/lib/audit-server';

export const runtime = 'nodejs';

interface LoginRequest {
  password: string;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    // Validate CSRF token first
    const csrfToken = req.headers.get(CSRF_HEADER);
    const validCsrf = await validateCsrfToken(csrfToken);
    if (!validCsrf) {
      await logAdminEvent('admin_login_failure', { reason: 'invalid_csrf' }, ip);
      return Response.json({ error: 'Invalid request' }, { status: 403 });
    }

    // Check rate limit before processing
    const rateLimit = await checkRateLimit(ip);
    if (rateLimit.limited) {
      await logAdminEvent('admin_login_failure', { reason: 'rate_limited' }, ip);
      return Response.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
          },
        }
      );
    }

    // Helper to record failed attempt and check for lockout
    const recordAndCheckLimit = async () => {
      await recordFailedAttempt(ip);
      const newLimit = await checkRateLimit(ip);
      if (newLimit.limited) {
        return Response.json(
          {
            error: 'Too many login attempts. Please try again later.',
            retryAfter: newLimit.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(newLimit.retryAfter),
            },
          }
        );
      }
      return null;
    };

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      // Record attempt for invalid JSON to prevent rate limit bypass
      await logAdminEvent('admin_login_failure', { reason: 'invalid_json' }, ip);
      const limitResponse = await recordAndCheckLimit();
      if (limitResponse) return limitResponse;
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { password } = body as LoginRequest;

    if (typeof password !== 'string' || !password) {
      // Record attempt for missing password to prevent rate limit bypass
      await logAdminEvent('admin_login_failure', { reason: 'missing_password' }, ip);
      const limitResponse = await recordAndCheckLimit();
      if (limitResponse) return limitResponse;
      return Response.json({ error: 'Password is required' }, { status: 400 });
    }

    const isValid = verifyPassword(password);
    if (!isValid) {
      // Record failed attempt and check for lockout
      await logAdminEvent('admin_login_failure', { reason: 'invalid_password' }, ip);
      const limitResponse = await recordAndCheckLimit();
      if (limitResponse) return limitResponse;

      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Clear rate limit on successful login
    await clearRateLimit(ip);

    // Clear CSRF token after successful login
    await clearCsrfToken();

    const token = await signToken();
    const cookieOptions = getAuthCookieOptions();

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, cookieOptions);

    await logAdminEvent('admin_login_success', {}, ip);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[admin/auth] Login error:', error);
    await logAdminEvent('admin_login_failure', { reason: 'internal_error' }, ip);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ip = getClientIp(req);

  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_COOKIE_NAME);

    await logAdminEvent('admin_logout', {}, ip);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[admin/auth] Logout error:', error);
    return Response.json({ error: 'Logout failed' }, { status: 500 });
  }
}
