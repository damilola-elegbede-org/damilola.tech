/**
 * CSRF protection for admin login.
 *
 * Uses double-submit cookie pattern:
 * 1. Server generates a random token and sets it in an httpOnly cookie
 * 2. Server also returns the token to be embedded in the form
 * 3. On submit, client sends token in header
 * 4. Server compares header token with cookie token
 */

import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a new CSRF token and set it in a cookie.
 * Returns the token to be embedded in the page/form.
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 60 * 60, // 1 hour
  });

  return token;
}

/**
 * Validate that the header token matches the cookie token.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function validateCsrfToken(headerToken: string | null): Promise<boolean> {
  if (!headerToken) return false;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;

  if (!cookieToken) return false;

  try {
    const headerBuffer = Buffer.from(headerToken, 'utf-8');
    const cookieBuffer = Buffer.from(cookieToken, 'utf-8');

    // Buffers must be same length for timingSafeEqual
    if (headerBuffer.length !== cookieBuffer.length) return false;

    return timingSafeEqual(headerBuffer, cookieBuffer);
  } catch {
    return false;
  }
}

/**
 * Clear the CSRF token cookie (call after successful login).
 */
export async function clearCsrfToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE);
}
