/**
 * Simple in-memory rate limiter for login attempts.
 *
 * Note: In serverless environments, each instance has its own memory,
 * so this provides per-instance rate limiting. For distributed rate
 * limiting, use Vercel KV or Upstash Redis.
 *
 * This is adequate for a personal site - it catches most brute force
 * attempts and significantly raises the cost of attacks.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

// Configuration
const MAX_ATTEMPTS = 5; // Failed attempts before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes - attempt window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes - lockout duration
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - cleanup old entries

// In-memory store
const attempts = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts.entries()) {
      // Remove if window expired and not locked
      const windowExpired = now - entry.firstAttempt > WINDOW_MS;
      const lockExpired = !entry.lockedUntil || now > entry.lockedUntil;

      if (windowExpired && lockExpired) {
        attempts.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Check if an IP is rate limited.
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked.
 */
export function checkRateLimit(ip: string): {
  limited: boolean;
  retryAfter?: number;
  remainingAttempts?: number;
} {
  startCleanup();

  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    return { limited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { limited: true, retryAfter };
  }

  // Check if window expired (reset if so)
  if (now - entry.firstAttempt > WINDOW_MS) {
    attempts.delete(ip);
    return { limited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if at limit
  if (entry.attempts >= MAX_ATTEMPTS) {
    // Apply lockout
    entry.lockedUntil = now + LOCKOUT_MS;
    const retryAfter = Math.ceil(LOCKOUT_MS / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false, remainingAttempts: MAX_ATTEMPTS - entry.attempts };
}

/**
 * Record a failed login attempt for an IP.
 */
export function recordFailedAttempt(ip: string): void {
  startCleanup();

  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    attempts.set(ip, {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return;
  }

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(ip, {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return;
  }

  // Increment attempts
  entry.attempts++;

  // Apply lockout if limit reached
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    console.warn(`[rate-limit] IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`);
  }
}

/**
 * Clear rate limit for an IP (call on successful login).
 */
export function clearRateLimit(ip: string): void {
  attempts.delete(ip);
}

/**
 * Get client IP from request headers.
 * Handles Vercel's forwarded headers.
 */
export function getClientIp(req: Request): string {
  // Vercel provides the real IP in x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be comma-separated; first is the client
    return forwarded.split(',')[0].trim();
  }

  // Fallback headers
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Last resort fallback
  return 'unknown';
}
