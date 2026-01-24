/**
 * CSRF Server Actions - callable from client components.
 */

'use server';

import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'csrf_token';

/**
 * Generate a new CSRF token and set it in a cookie.
 * Returns the token to be embedded in the page/form.
 *
 * This is a Server Action - can be called from client components.
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  return token;
}
