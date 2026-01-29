# Rate Limiting

Distributed rate limiting implementation for admin login and public API endpoints.

## Overview

The application implements a two-tier rate limiting system:

1. **Admin Login Protection** - Prevents brute force attacks on admin authentication
2. **Public Endpoint Protection** - Prevents API abuse on chat, fit assessment, and resume generation

## Architecture

### Storage Backends

**Production (Upstash Redis):**

- Distributed state across multiple instances
- Automatic TTL-based expiration
- High performance and reliability
- Circuit breaker for failure scenarios

**Development (In-Memory):**

- Local Map-based storage
- Periodic cleanup of expired entries
- No external dependencies
- Automatic fallback in production if Redis unavailable

### Circuit Breaker

Protects against Redis failures with graceful degradation:

- **Threshold:** 3 consecutive Redis errors
- **Open Duration:** 30 seconds
- **Behavior:** Automatically fail over to in-memory storage
- **Reset:** Successful Redis operation resets error count

## Admin Login Rate Limiting

### Configuration

```typescript
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
```

### Flow

1. **Check Rate Limit:** Before password verification
2. **Record Failure:** After invalid password
3. **Apply Lockout:** After 5 failed attempts
4. **Clear Limit:** After successful login

### Redis Keys

```text
ratelimit:admin:{ip}    # Attempt counter with TTL
lockout:admin:{ip}      # Lockout expiry timestamp
```

### Example Response (Locked Out)

```json
{
  "error": "Too many attempts. Please try again later.",
  "retryAfter": 900
}
```

### IP Extraction

```typescript
function getClientIp(req: Request): string {
  // Vercel forwards real IP in x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Fallback headers
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}
```

## Public Endpoint Rate Limiting

### Configuration

```typescript
export const RATE_LIMIT_CONFIGS = {
  chat: {
    key: 'chat',
    limit: 50,
    windowSeconds: 300  // 5 minutes
  },
  fitAssessment: {
    key: 'fit-assessment',
    limit: 10,
    windowSeconds: 3600  // 1 hour
  },
  resumeGenerator: {
    key: 'resume-generator',
    limit: 10,
    windowSeconds: 3600  // 1 hour
  },
};
```

### Pattern: Sliding Window Counter

Each request:

1. Increment counter for identifier (IP address)
2. Set TTL on first increment (fixed window)
3. Check if count exceeds limit
4. Return remaining requests or rate limit error

### Redis Keys

```text
ratelimit:chat:{ip}              # Chat request counter
ratelimit:fit-assessment:{ip}    # Fit assessment counter
ratelimit:resume-generator:{ip}  # Resume generation counter
```

### Rate Limit Response

**Status:** 429 Too Many Requests

**Headers:**

```http
Retry-After: 300
```

**Body:**

```json
{
  "error": "Too many requests. Please try again later."
}
```

### Usage in Endpoints

```typescript
import {
  checkGenericRateLimit,
  createRateLimitResponse,
  getClientIp,
  RATE_LIMIT_CONFIGS
} from '@/lib/rate-limit';

export async function POST(req: Request) {
  // Extract IP
  const ip = getClientIp(req);

  // Check rate limit
  const rateLimitResult = await checkGenericRateLimit(
    RATE_LIMIT_CONFIGS.chat,
    ip
  );

  // Reject if limited
  if (rateLimitResult.limited) {
    console.log(`[chat] Rate limited: ${ip}`);
    return createRateLimitResponse(rateLimitResult);
  }

  // Process request
  // ...
}
```

## Implementation Details

### Redis Implementation

**Admin Login:**

```typescript
async function checkRateLimitRedis(ip: string) {
  const lockoutKey = `lockout:admin:${ip}`;
  const attemptsKey = `ratelimit:admin:${ip}`;

  const client = getRedis();

  // Check if locked out
  const lockoutExpiry = await client.get<number>(lockoutKey);
  if (lockoutExpiry && Date.now() < lockoutExpiry) {
    const retryAfter = Math.ceil((lockoutExpiry - Date.now()) / 1000);
    return { limited: true, retryAfter };
  }

  // Get current attempts
  const attempts = await client.get<number>(attemptsKey) || 0;

  // Check if at limit
  if (attempts >= MAX_ATTEMPTS) {
    const lockoutExpiry = Date.now() + LOCKOUT_SECONDS * 1000;
    await client.set(lockoutKey, lockoutExpiry, { ex: LOCKOUT_SECONDS });
    return { limited: true, retryAfter: LOCKOUT_SECONDS };
  }

  return { limited: false, remainingAttempts: MAX_ATTEMPTS - attempts };
}
```

**Record Failed Attempt:**

```typescript
async function recordFailedAttemptRedis(ip: string) {
  const attemptsKey = `ratelimit:admin:${ip}`;
  const client = getRedis();

  // Increment attempts
  const attempts = await client.incr(attemptsKey);

  // Set TTL on first attempt
  if (attempts === 1) {
    await client.expire(attemptsKey, WINDOW_SECONDS);
  }

  // Apply lockout if limit reached
  if (attempts >= MAX_ATTEMPTS) {
    const lockoutKey = `lockout:admin:${ip}`;
    const lockoutExpiry = Date.now() + LOCKOUT_SECONDS * 1000;
    await client.set(lockoutKey, lockoutExpiry, { ex: LOCKOUT_SECONDS });
  }
}
```

**Generic Rate Limit:**

```typescript
async function checkGenericRateLimitRedis(
  config: RateLimitConfig,
  identifier: string
) {
  const key = `ratelimit:${config.key}:${identifier}`;
  const client = getRedis();

  // Increment counter
  const count = await client.incr(key);

  // Set TTL on first increment
  if (count === 1) {
    await client.expire(key, config.windowSeconds);
  }

  // Check limit
  if (count > config.limit) {
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
}
```

### In-Memory Implementation

**Data Structures:**

```typescript
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

interface GenericRateLimitEntry {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
const genericMemoryStore = new Map<string, GenericRateLimitEntry>();
```

**Cleanup:**

```typescript
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function startCleanup() {
  setInterval(() => {
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
      if (now - entry.windowStart > 3600 * 1000) {
        genericMemoryStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
```

## Security Considerations

### Timing Attacks

Password verification uses timing-safe comparison to prevent length-based timing attacks:

```typescript
import { timingSafeEqual, createHash } from 'crypto';

type VerifyResult =
  | { success: true }
  | { success: false; reason: 'invalid_password' | 'config_error' };

function verifyPassword(provided: string): VerifyResult {
  const expected = getAdminPassword().trim();
  const providedTrimmed = provided.trim();

  // Hash both values to ensure constant-time comparison
  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(providedTrimmed).digest();

  if (timingSafeEqual(expectedHash, providedHash)) {
    return { success: true };
  }
  return { success: false, reason: 'invalid_password' };
}
```

### IP Spoofing

The application trusts Vercel's `x-forwarded-for` header, which is controlled by Vercel's edge network and cannot be spoofed by clients.

### Redis Failure Handling

**Circuit Breaker prevents:**

- Cascading failures if Redis becomes unavailable
- Denial of service due to Redis errors
- Complete service outage

**Fail-Open Strategy:**

On Redis failure, the system fails open to in-memory rate limiting rather than blocking all requests. This prioritizes availability over strict rate limiting.

### Distributed State

Using Redis ensures rate limits work correctly across:

- Multiple Vercel serverless function instances
- Multiple data centers
- Horizontal scaling scenarios

## Monitoring

### Logs

Rate limit events are logged with context:

```typescript
console.warn(`[rate-limit] IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`);
console.log(`[chat] Rate limited: ${ip}`);
console.warn('[rate-limit] Circuit breaker open, using memory fallback');
console.error('[rate-limit] Redis error:', error);
```

### Metrics

Track these metrics in production:

- Rate limit rejections per endpoint
- Admin lockouts triggered
- Redis errors and circuit breaker activations
- Average requests per IP
- Peak request rates

## Configuration

### Environment Variables

```bash
# Required for distributed rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Admin authentication (required)
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD_PREVIEW=preview_password
ADMIN_PASSWORD_PRODUCTION=production_password
```

### Tuning Rate Limits

To adjust rate limits, modify `RATE_LIMIT_CONFIGS` in `src/lib/rate-limit.ts`:

```typescript
export const RATE_LIMIT_CONFIGS = {
  chat: {
    key: 'chat',
    limit: 100,        // Increase limit
    windowSeconds: 600  // Increase window
  },
  // ...
};
```

**Consider:**

- API cost implications (Anthropic charges per token)
- User experience (too restrictive = frustration)
- Abuse patterns (adjust based on logs)
- Resource constraints (serverless function limits)

## Testing

### Unit Tests

```typescript
import { checkGenericRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const result = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.chat,
      'test-ip'
    );

    expect(result.limited).toBe(false);
    expect(result.remaining).toBeLessThan(RATE_LIMIT_CONFIGS.chat.limit);
  });

  it('should block requests exceeding limit', async () => {
    // Make requests up to limit
    for (let i = 0; i < RATE_LIMIT_CONFIGS.chat.limit; i++) {
      await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, 'test-ip-2');
    }

    // Next request should be blocked
    const result = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.chat,
      'test-ip-2'
    );

    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```bash
# Test admin login rate limit
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/admin/auth \
    -H "Content-Type: application/json" \
    -d '{"password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# Should show 429 on 6th request
```

## Troubleshooting

### Rate Limit Not Working

1. **Check Redis Connection:**

```bash
# Verify environment variables
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

2. **Check Logs:**

```bash
# Look for Redis errors or circuit breaker messages
vercel logs
```

3. **Test In-Memory Fallback:**

- Remove Redis env vars temporarily
- Verify rate limiting still works locally

### False Positives

If legitimate users are being rate limited:

1. Check if IP extraction is correct (logs show IP)
2. Consider if multiple users share IP (corporate proxy)
3. Adjust limits for that endpoint
4. Add IP whitelist for known good actors

### Redis Performance

Monitor Redis metrics:

- Commands per second
- Memory usage
- Latency
- Connection errors

Upstash provides these metrics in their dashboard.

## Best Practices

1. **Always check rate limit before processing request**
2. **Use IP-based identification for public endpoints**
3. **Log all rate limit events for monitoring**
4. **Set appropriate retry-after headers**
5. **Test rate limits in development**
6. **Monitor Redis health and circuit breaker activations**
7. **Adjust limits based on usage patterns**
8. **Consider graduated rate limits (burst allowance)**
9. **Document rate limits in API documentation**
10. **Provide clear error messages to users**

## Future Enhancements

- [ ] User-based rate limiting (after authentication)
- [ ] Graduated rate limits (burst allowance)
- [ ] Rate limit exemptions for trusted IPs
- [ ] Real-time rate limit dashboard
- [ ] Automated rate limit adjustments based on load
- [ ] Geographic rate limit variations
- [ ] Machine learning for abuse detection

## Related Documentation

- [API Documentation](./api-documentation.md)
- [Admin Portal Documentation](./admin-portal.md)
- [Security Best Practices](./security.md)
