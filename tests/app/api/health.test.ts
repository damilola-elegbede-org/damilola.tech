import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('health API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'));
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns website health status for uptime checks', async () => {
    process.env.VERCEL_ENV = 'production';

    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'ok',
      website: 'up',
      timestamp: '2026-03-11T12:00:00.000Z',
      environment: 'production',
      checks: {
        app: 'ok',
      },
    });
  });

  it('disables caching for real-time health checks', async () => {
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(response.headers.get('X-Health-Endpoint')).toBe('/api/health');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('uses nodejs runtime', async () => {
    const routeModule = await import('@/app/api/health/route');

    expect(routeModule.runtime).toBe('nodejs');
  });
});
