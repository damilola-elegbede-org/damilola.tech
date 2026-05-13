/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = 'test-secret-32-chars-minimum-abc';

function makeRequest(pathname: string, cookieValue?: string): NextRequest {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url);
  if (cookieValue) {
    req.cookies.set('admin_session', cookieValue);
  }
  return req;
}

async function mintToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

describe('admin proxy (middleware)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, JWT_SECRET };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('passes /admin/login through without auth', async () => {
    const proxy = (await import('@/proxy')).default;
    const res = await proxy(makeRequest('/admin/login'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects /admin/resume-generator to /admin/login with no cookie', async () => {
    const proxy = (await import('@/proxy')).default;
    const res = await proxy(makeRequest('/admin/resume-generator'));
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('redirects /admin/resume-generator to /admin/login with invalid token', async () => {
    const proxy = (await import('@/proxy')).default;
    const res = await proxy(makeRequest('/admin/resume-generator', 'not-a-valid-jwt'));
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('passes through /admin/resume-generator with valid token', async () => {
    const proxy = (await import('@/proxy')).default;
    const token = await mintToken();
    const res = await proxy(makeRequest('/admin/resume-generator', token));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects /admin/dashboard to /admin/login with no cookie', async () => {
    const proxy = (await import('@/proxy')).default;
    const res = await proxy(makeRequest('/admin/dashboard'));
    expect(res.headers.get('location')).toContain('/admin/login');
  });
});
