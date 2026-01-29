import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual, createHash } from 'crypto';

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

  if (env === 'production') {
    const password = process.env.ADMIN_PASSWORD_PRODUCTION;
    if (!password) throw new Error('ADMIN_PASSWORD_PRODUCTION not configured');
    return password;
  }

  // Preview and development use the preview password
  const password = process.env.ADMIN_PASSWORD_PREVIEW;
  if (!password) throw new Error('ADMIN_PASSWORD_PREVIEW not configured');
  return password;
}

// Hash a string for constant-time comparison (avoids length-based timing leaks)
function hashForComparison(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Result type for password verification with failure reason
export type VerifyResult =
  | { success: true }
  | { success: false; reason: 'invalid_password' | 'config_error' };

// Timing-safe password verification using hash comparison
// This ensures constant-time comparison regardless of password length
export function verifyPassword(provided: string): VerifyResult {
  try {
    const expected = getAdminPassword().trim();
    const providedTrimmed = provided.trim();
    // Compare hashes to ensure constant-time behavior regardless of length
    const expectedHash = hashForComparison(expected);
    const providedHash = hashForComparison(providedTrimmed);
    if (timingSafeEqual(expectedHash, providedHash)) {
      return { success: true };
    }
    return { success: false, reason: 'invalid_password' };
  } catch {
    // Env var missing or other config error
    return { success: false, reason: 'config_error' };
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
    sameSite: 'strict',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  };
}
