/**
 * Distributed rate limiter for admin login attempts.
 *
 * Uses Upstash Redis for distributed state in production.
 * Falls back to in-memory storage when Redis is not configured.
 */

import { Redis } from '@upstash/redis';

// Configuration
const MAX_ATTEMPTS = 5; // Failed attempts before lockout
const WINDOW_SECONDS = 15 * 60; // 15 minutes - attempt window
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes - lockout duration
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - cleanup old entries (in-memory only)

// Check if Redis is configured
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Lazy-init Redis client
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// In-memory fallback for local development
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const memoryStore = new Map<string, RateLimitEntry>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval || useRedis) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      const windowExpired = now - entry.firstAttempt > WINDOW_SECONDS * 1000;
      const lockExpired = !entry.lockedUntil || now > entry.lockedUntil;

      if (windowExpired && lockExpired) {
        memoryStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Check if an IP is rate limited.
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked.
 */
export async function checkRateLimit(ip: string): Promise<{
  limited: boolean;
  retryAfter?: number;
  remainingAttempts?: number;
}> {
  if (useRedis) {
    return checkRateLimitRedis(ip);
  }
  return checkRateLimitMemory(ip);
}

async function checkRateLimitRedis(ip: string): Promise<{
  limited: boolean;
  retryAfter?: number;
  remainingAttempts?: number;
}> {
  const lockoutKey = `lockout:admin:${ip}`;
  const attemptsKey = `ratelimit:admin:${ip}`;

  try {
    const client = getRedis();

    // Check if locked out
    const lockoutExpiry = await client.get<number>(lockoutKey);
    if (lockoutExpiry) {
      const now = Date.now();
      if (now < lockoutExpiry) {
        const retryAfter = Math.ceil((lockoutExpiry - now) / 1000);
        return { limited: true, retryAfter };
      }
      // Lockout expired, clean up
      await client.del(lockoutKey);
    }

    // Get current attempts
    const attempts = (await client.get<number>(attemptsKey)) || 0;

    if (attempts >= MAX_ATTEMPTS) {
      // Apply lockout
      const lockoutExpiry = Date.now() + LOCKOUT_SECONDS * 1000;
      await client.set(lockoutKey, lockoutExpiry, { ex: LOCKOUT_SECONDS });
      return { limited: true, retryAfter: LOCKOUT_SECONDS };
    }

    return { limited: false, remainingAttempts: MAX_ATTEMPTS - attempts };
  } catch (error) {
    console.error('[rate-limit] Redis error:', error);
    // On Redis error, fail closed to prevent bypass attacks
    return { limited: true, retryAfter: 60 };
  }
}

function checkRateLimitMemory(ip: string): {
  limited: boolean;
  retryAfter?: number;
  remainingAttempts?: number;
} {
  startCleanup();

  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry) {
    return { limited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { limited: true, retryAfter };
  }

  // Check if window expired (reset if so)
  if (now - entry.firstAttempt > WINDOW_SECONDS * 1000) {
    memoryStore.delete(ip);
    return { limited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if at limit
  if (entry.attempts >= MAX_ATTEMPTS) {
    // Apply lockout
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    const retryAfter = Math.ceil(LOCKOUT_SECONDS);
    return { limited: true, retryAfter };
  }

  return { limited: false, remainingAttempts: MAX_ATTEMPTS - entry.attempts };
}

/**
 * Record a failed login attempt for an IP.
 */
export async function recordFailedAttempt(ip: string): Promise<void> {
  if (useRedis) {
    await recordFailedAttemptRedis(ip);
  } else {
    recordFailedAttemptMemory(ip);
  }
}

async function recordFailedAttemptRedis(ip: string): Promise<void> {
  const attemptsKey = `ratelimit:admin:${ip}`;
  const lockoutKey = `lockout:admin:${ip}`;

  try {
    const client = getRedis();

    // Increment attempts counter
    const attempts = await client.incr(attemptsKey);

    // Set expiry on first attempt
    if (attempts === 1) {
      await client.expire(attemptsKey, WINDOW_SECONDS);
    }

    // Apply lockout if limit reached
    if (attempts >= MAX_ATTEMPTS) {
      const lockoutExpiry = Date.now() + LOCKOUT_SECONDS * 1000;
      await client.set(lockoutKey, lockoutExpiry, { ex: LOCKOUT_SECONDS });
      console.warn(`[rate-limit] IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`);
    }
  } catch (error) {
    console.error('[rate-limit] Redis error recording attempt:', error);
  }
}

function recordFailedAttemptMemory(ip: string): void {
  startCleanup();

  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry) {
    memoryStore.set(ip, {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return;
  }

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_SECONDS * 1000) {
    memoryStore.set(ip, {
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
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    console.warn(`[rate-limit] IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`);
  }
}

/**
 * Clear rate limit for an IP (call on successful login).
 */
export async function clearRateLimit(ip: string): Promise<void> {
  if (useRedis) {
    try {
      const client = getRedis();
      const attemptsKey = `ratelimit:admin:${ip}`;
      const lockoutKey = `lockout:admin:${ip}`;
      await Promise.all([client.del(attemptsKey), client.del(lockoutKey)]);
    } catch (error) {
      console.error('[rate-limit] Redis error clearing limit:', error);
    }
  } else {
    memoryStore.delete(ip);
  }
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
