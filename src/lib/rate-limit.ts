/**
 * Distributed rate limiter for admin login attempts and public endpoints.
 *
 * Uses Upstash Redis for distributed state in production.
 * Falls back to in-memory storage when Redis is not configured.
 */

import { Redis } from '@upstash/redis';

// Admin login configuration
const MAX_ATTEMPTS = 5; // Failed attempts before lockout
const WINDOW_SECONDS = 15 * 60; // 15 minutes - attempt window
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes - lockout duration
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - cleanup old entries (in-memory only)

// Generic rate limit configuration
export interface RateLimitConfig {
  key: string;              // 'chat', 'fit-assessment', 'resume-generator'
  limit: number;            // max requests
  windowSeconds: number;    // time window
}

// Predefined configs for public endpoints
export const RATE_LIMIT_CONFIGS = {
  chat: { key: 'chat', limit: 50, windowSeconds: 300 },               // 50 per 5 min
  fitAssessment: { key: 'fit-assessment', limit: 10, windowSeconds: 3600 },  // 10 per hour
  resumeGenerator: { key: 'resume-generator', limit: 10, windowSeconds: 3600 }, // 10 per hour
} as const;

export interface GenericRateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfter?: number;
}

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

// In-memory store for generic rate limits (sliding window counter)
interface GenericRateLimitEntry {
  count: number;
  windowStart: number;
}
const genericMemoryStore = new Map<string, GenericRateLimitEntry>();

// Circuit breaker for Redis errors - fail open after consecutive failures
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 30000; // 30 seconds
let redisErrorCount = 0;
let circuitBreakerOpenUntil = 0;

// Max window for generic rate limits (1 hour) - used for cleanup threshold
const GENERIC_CLEANUP_THRESHOLD_MS = 3600 * 1000;

function startCleanup() {
  if (cleanupInterval || useRedis) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();

    // Cleanup admin login entries
    for (const [key, entry] of memoryStore.entries()) {
      const windowExpired = now - entry.firstAttempt > WINDOW_SECONDS * 1000;
      const lockExpired = !entry.lockedUntil || now > entry.lockedUntil;

      if (windowExpired && lockExpired) {
        memoryStore.delete(key);
      }
    }

    // Cleanup generic rate limit entries
    for (const [key, entry] of genericMemoryStore.entries()) {
      if (now - entry.windowStart > GENERIC_CLEANUP_THRESHOLD_MS) {
        genericMemoryStore.delete(key);
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

/**
 * Generic rate limiter for public endpoints.
 * Uses sliding window counter pattern.
 * Increments counter on each call (check + consume in one operation).
 */
export async function checkGenericRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<GenericRateLimitResult> {
  if (useRedis) {
    return checkGenericRateLimitRedis(config, identifier);
  }
  return checkGenericRateLimitMemory(config, identifier);
}

async function checkGenericRateLimitRedis(
  config: RateLimitConfig,
  identifier: string
): Promise<GenericRateLimitResult> {
  const key = `ratelimit:${config.key}:${identifier}`;
  const now = Date.now();

  // Circuit breaker: if open, fall back to memory-based rate limiting
  if (now < circuitBreakerOpenUntil) {
    console.warn('[rate-limit] Circuit breaker open, using memory fallback');
    return checkGenericRateLimitMemory(config, identifier);
  }

  try {
    const client = getRedis();

    // Use pipeline for atomic INCR + EXPIRE to prevent race condition
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, config.windowSeconds);
    const results = await pipeline.exec();

    // Reset circuit breaker on success
    redisErrorCount = 0;

    const count = results[0] as number;

    if (count > config.limit) {
      // Get TTL for retry-after
      const ttl = await client.ttl(key);
      return {
        limited: true,
        remaining: 0,
        retryAfter: ttl > 0 ? ttl : config.windowSeconds,
      };
    }

    return {
      limited: false,
      remaining: config.limit - count,
    };
  } catch (error) {
    console.error('[rate-limit] Redis error in generic rate limit:', error);

    // Circuit breaker: track consecutive errors
    redisErrorCount++;
    if (redisErrorCount >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreakerOpenUntil = now + CIRCUIT_BREAKER_RESET_MS;
      console.warn(`[rate-limit] Circuit breaker opened after ${redisErrorCount} Redis errors`);
    }

    // Fail open to memory-based limiting instead of blocking all requests
    return checkGenericRateLimitMemory(config, identifier);
  }
}

function checkGenericRateLimitMemory(
  config: RateLimitConfig,
  identifier: string
): GenericRateLimitResult {
  startCleanup();

  const key = `${config.key}:${identifier}`;
  const now = Date.now();
  const entry = genericMemoryStore.get(key);

  if (!entry || now - entry.windowStart > config.windowSeconds * 1000) {
    // New window
    genericMemoryStore.set(key, { count: 1, windowStart: now });
    return { limited: false, remaining: config.limit - 1 };
  }

  // Increment counter
  entry.count++;

  if (entry.count > config.limit) {
    // Calculate retry-after (time until window resets)
    const windowEnd = entry.windowStart + config.windowSeconds * 1000;
    const retryAfter = Math.ceil((windowEnd - now) / 1000);
    return {
      limited: true,
      remaining: 0,
      retryAfter: retryAfter > 0 ? retryAfter : config.windowSeconds,
    };
  }

  return {
    limited: false,
    remaining: config.limit - entry.count,
  };
}

/**
 * Create a 429 Too Many Requests response with Retry-After header.
 */
export function createRateLimitResponse(result: GenericRateLimitResult): Response {
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter || 60),
      },
    }
  );
}
