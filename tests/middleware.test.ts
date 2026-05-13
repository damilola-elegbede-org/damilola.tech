/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeRequest(path = '/api/v1/score-job', ip?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (ip) headers['x-forwarded-for'] = ip;
  return new NextRequest(`https://damilola.tech${path}`, { method: 'POST', headers });
}

function stubRedisCount(count: number): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [{ result: count }, { result: 1 }],
  });
}

describe('api/v1 rate limiting middleware', () => {
  const origUrl = process.env.UPSTASH_REDIS_REST_URL;
  const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = origUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
  });

  it('passes requests under the limit (200)', async () => {
    const { middleware } = await import('../middleware');
    stubRedisCount(50);

    const res = await middleware(makeRequest('/api/v1/score-job', '1.2.3.4'));
    expect(res.status).toBe(200);
  });

  it('returns 429 with JSON body when limit is exceeded', async () => {
    const { middleware, RATE_LIMIT } = await import('../middleware');
    stubRedisCount(RATE_LIMIT + 1);

    const res = await middleware(makeRequest('/api/v1/score-job', '1.2.3.4'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Retry-After')).toBeDefined();

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('returns 429 at exactly RATE_LIMIT + 1 requests', async () => {
    const { middleware, RATE_LIMIT } = await import('../middleware');
    stubRedisCount(RATE_LIMIT + 1);

    const res = await middleware(makeRequest('/api/v1/log-application', '10.0.0.1'));
    expect(res.status).toBe(429);
  });

  it('passes through when Redis is not configured (fail open)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { middleware } = await import('../middleware');
    const res = await middleware(makeRequest('/api/v1/score-job'));
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails open when Redis pipeline returns non-ok response', async () => {
    const { middleware } = await import('../middleware');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const res = await middleware(makeRequest('/api/v1/score-job', '5.5.5.5'));
    expect(res.status).toBe(200);
  });

  it('fails open when fetch throws a network error', async () => {
    const { middleware } = await import('../middleware');
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const res = await middleware(makeRequest('/api/v1/score-job', '6.6.6.6'));
    expect(res.status).toBe(200);
  });

  it('extracts IP from x-forwarded-for with multiple proxies', async () => {
    const { middleware } = await import('../middleware');
    stubRedisCount(1);

    const req = new NextRequest('https://damilola.tech/api/v1/score-job', {
      method: 'GET',
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' },
    });
    await middleware(req);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    // Key should use the first (client) IP from the chain
    expect(body[0][1]).toContain('203.0.113.1');
  });

  it('allows exactly RATE_LIMIT requests (boundary: count === limit → 200)', async () => {
    const { middleware, RATE_LIMIT } = await import('../middleware');
    stubRedisCount(RATE_LIMIT);

    const res = await middleware(makeRequest('/api/v1/score-job', '7.7.7.7'));
    expect(res.status).toBe(200);
  });

  it('extracts IP from x-real-ip when x-forwarded-for is absent', async () => {
    const { middleware } = await import('../middleware');
    stubRedisCount(1);

    const req = new NextRequest('https://damilola.tech/api/v1/score-job', {
      method: 'GET',
      headers: { 'x-real-ip': '9.9.9.9' },
    });
    await middleware(req);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body[0][1]).toContain('9.9.9.9');
  });

  it('prefers x-forwarded-for over x-real-ip when both are set', async () => {
    const { middleware } = await import('../middleware');
    stubRedisCount(1);

    const req = new NextRequest('https://damilola.tech/api/v1/score-job', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '8.8.8.8',
        'x-real-ip': '1.2.3.4',
      },
    });
    await middleware(req);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body[0][1]).toContain('8.8.8.8');
    expect(body[0][1]).not.toContain('1.2.3.4');
  });
});
