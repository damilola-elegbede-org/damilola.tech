import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

vi.mock('@/lib/rate-limit', () => ({
  checkGenericRateLimit: vi.fn().mockResolvedValue({ limited: false, remaining: 4 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: 'Alice Tester',
  email: 'alice@example.com',
  company: 'Acme Inc',
  message: 'Hello, I would like to discuss a fractional engagement.',
  website: '',
};

describe('POST /api/v1/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns 201 for a valid submission', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.data.confirmation).toBe('string');
    expect(json.data.confirmation.length).toBeGreaterThan(0);
  });

  it('logs a contact_submission event for a valid submission', async () => {
    await POST(makeRequest(validBody));
    expect(console.log).toHaveBeenCalledOnce();
    const logged = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(logged.event).toBe('contact_submission');
    expect(logged.name).toBe('Alice Tester');
    expect(logged.email).toBe('alice@example.com');
    expect(logged.company).toBe('Acme Inc');
    expect(typeof logged.ts).toBe('string');
  });

  it('does not log when validation fails', async () => {
    await POST(makeRequest({ ...validBody, name: '' }));
    expect(console.log).not.toHaveBeenCalled();
  });

  it('returns 201 without exposing submission contents', async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(json.data).not.toHaveProperty('name');
    expect(json.data).not.toHaveProperty('email');
    expect(json.data).not.toHaveProperty('message');
    expect(json.data).not.toHaveProperty('company');
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ ...validBody, name: '' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is absent', async () => {
    const { name: _name, ...noName } = validBody;
    const res = await POST(makeRequest(noName));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(makeRequest({ ...validBody, name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for email missing domain', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'alice@' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 400 when message is empty', async () => {
    const res = await POST(makeRequest({ ...validBody, message: '' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 400 when message exceeds 10000 characters', async () => {
    const res = await POST(makeRequest({ ...validBody, message: 'a'.repeat(10001) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when honeypot field is filled', async () => {
    const res = await POST(makeRequest({ ...validBody, website: 'http://spam.example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('accepts submission without optional company field', async () => {
    const { company: _company, ...noCompany } = validBody;
    const res = await POST(makeRequest(noCompany));
    expect(res.status).toBe(201);
  });

  it('returns 429 when rate limited', async () => {
    const { checkGenericRateLimit } = await import('@/lib/rate-limit');
    vi.mocked(checkGenericRateLimit).mockResolvedValueOnce({ limited: true, remaining: 0, retryAfter: 300 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });
});
