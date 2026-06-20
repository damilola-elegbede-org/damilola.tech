import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge runtime is required for Vercel NFT tracing to generate middleware.js.nft.json
export const runtime = 'edge';

export const RATE_LIMIT = 100;  // max requests per window per IP
export const WINDOW_SEC = 60;   // fixed window size in seconds

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Deliberate fail-open: Redis unavailable → no rate limiting (availability over strictness)
  if (!redisUrl || !redisToken) {
    return NextResponse.next();
  }

  // Skip rate limiting on non-production deployments. Parallel CI E2E jobs (5 browser
  // projects) share a single GitHub Actions outbound IP; their combined request volume
  // exhausts the 100/60s cap and produces false 429s for tests that expect 400. Preview
  // deployments are ephemeral and don't need IP-based protection.
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.next();
  }

  // x-forwarded-for is set by Vercel's edge and is the canonical IP source in Next.js 15+
  // (NextRequest.ip was removed in Next.js 15). 'unknown' is a shared fallback bucket.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Time-bucketed key: one counter per IP per window period
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SEC);
  const key = `ratelimit:api:${ip}:${windowId}`;

  let count: number;
  try {
    const res = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, WINDOW_SEC * 2],  // 2-window TTL ensures cleanup
      ]),
    });

    if (!res.ok) {
      return NextResponse.next();  // fail open on Redis error
    }

    const [{ result: incr }] = (await res.json()) as [{ result: number }, { result: number }];
    count = incr;
  } catch {
    return NextResponse.next();  // fail open on network error
  }

  if (count > RATE_LIMIT) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(WINDOW_SEC),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/v1/:path*',
};
