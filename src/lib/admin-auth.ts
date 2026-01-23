import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'crypto';

// Constants
export const ADMIN_COOKIE_NAME = 'admin_session';
export const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 24 hours

// Get the secret key for JWT operations
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

// Get the appropriate admin password based on environment
function getAdminPassword(): string {
  const env = process.env.VERCEL_ENV || 'development';
  console.log('[admin-auth] Environment:', env);

  if (env === 'production') {
    const password = process.env.ADMIN_PASSWORD_PRODUCTION;
    if (!password) throw new Error('ADMIN_PASSWORD_PRODUCTION not configured');
    console.log('[admin-auth] Using production password, length:', password.length);
    return password;
  }

  // Preview and development use the preview password
  const password = process.env.ADMIN_PASSWORD_PREVIEW;
  if (!password) throw new Error('ADMIN_PASSWORD_PREVIEW not configured');
  console.log('[admin-auth] Using preview password, length:', password.length);
  return password;
}

// Timing-safe password verification
export function verifyPassword(provided: string): boolean {
  try {
    const expected = getAdminPassword().trim();
    const providedTrimmed = provided.trim();
    console.log('[admin-auth] Password lengths - provided:', providedTrimmed.length, 'expected:', expected.length);
    if (providedTrimmed.length !== expected.length) {
      console.log('[admin-auth] Length mismatch');
      return false;
    }
    const result = timingSafeEqual(Buffer.from(providedTrimmed), Buffer.from(expected));
    console.log('[admin-auth] Comparison result:', result);
    return result;
  } catch (error) {
    console.error('[admin-auth] Error in verifyPassword:', error);
    return false;
  }
}

// Create a signed JWT token
export async function signToken(): Promise<string> {
  const secret = getJwtSecret();

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Create cookie options for setting the auth cookie
export function getAuthCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  };
}
