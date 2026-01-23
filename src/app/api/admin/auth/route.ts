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

export const runtime = 'nodejs';

interface LoginRequest {
  password: string;
}

export async function POST(req: Request) {
  try {
    // Get client IP for rate limiting
    const ip = getClientIp(req);

    // Check rate limit before processing
    const rateLimit = checkRateLimit(ip);
    if (rateLimit.limited) {
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
    const recordAndCheckLimit = () => {
      recordFailedAttempt(ip);
      const newLimit = checkRateLimit(ip);
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
      const limitResponse = recordAndCheckLimit();
      if (limitResponse) return limitResponse;
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { password } = body as LoginRequest;

    if (typeof password !== 'string' || !password) {
      // Record attempt for missing password to prevent rate limit bypass
      const limitResponse = recordAndCheckLimit();
      if (limitResponse) return limitResponse;
      return Response.json({ error: 'Password is required' }, { status: 400 });
    }

    const isValid = verifyPassword(password);
    if (!isValid) {
      // Record failed attempt and check for lockout
      const limitResponse = recordAndCheckLimit();
      if (limitResponse) return limitResponse;

      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Clear rate limit on successful login
    clearRateLimit(ip);

    const token = await signToken();
    const cookieOptions = getAuthCookieOptions();

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, cookieOptions);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[admin/auth] Login error:', error);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_COOKIE_NAME);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[admin/auth] Logout error:', error);
    return Response.json({ error: 'Logout failed' }, { status: 500 });
  }
}
