import { test, expect } from '@playwright/test';

const VALID_PAYLOAD = {
  name: 'Alice Remy',
  email: 'alice@example.com',
  company: 'Acme Corp',
  message: 'I would like to discuss a fractional engagement for my engineering team.',
};

// Rate-limit context for this suite — two limiters apply to POST /api/v1/contact:
//
// 1. Global middleware (middleware.ts): 100 req / 60 s per IP, incremented before the
//    route handler runs. This suite sends at most 17 requests total; this limit is not
//    exhausted.
//
// 2. Contact-specific limit (implemented in #177): 5 req / 300 s per IP, applied at the
//    route-handler level before body parsing and validation. This matches the existing
//    pattern in src/app/api/v1/score-resume/route.ts where checkGenericRateLimit is called
//    before req.json(). Every request — including those that return 400 — counts toward
//    the quota.
//
//    Impact: only the first 5 tests in file order can receive their expected status codes
//    in a production-like environment with the contact-specific rate limit active. Tests 6+
//    will receive 429 once the quota is spent. The two 201-path tests are ordered first
//    (slots 1 and 2) so the happy paths are verified before quota exhaustion.
//
//    CI assumption: this suite starts from a fresh 300 s window. Do not re-run within the
//    same 5-minute window from the same IP.
test.describe('POST /api/v1/contact', () => {
  test('valid payload returns 201 with confirmation message', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: VALID_PAYLOAD,
    });

    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { confirmation: string } };
    expect(body.success).toBe(true);
    expect(typeof body.data.confirmation).toBe('string');
    expect(body.data.confirmation.length).toBeGreaterThan(0);
    // Response must not echo back PII
    expect(body.data).not.toHaveProperty('name');
    expect(body.data).not.toHaveProperty('email');
  });

  // Slot 2: second 201 path — placed before the 400 tests so both happy paths are
  // verified within the first 5 requests (before the contact-specific quota is spent).
  test('optional company field can be omitted', async ({ request }) => {
    const { company: _company, ...noCompany } = VALID_PAYLOAD;
    const response = await request.post('/api/v1/contact', {
      data: noCompany,
    });

    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { confirmation: string } };
    expect(body.success).toBe(true);
  });

  test('missing name field returns 400 VALIDATION_ERROR', async ({ request }) => {
    const { name: _name, ...noName } = VALID_PAYLOAD;
    const response = await request.post('/api/v1/contact', {
      data: noName,
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('missing message field returns 400 VALIDATION_ERROR', async ({ request }) => {
    const { message: _message, ...noMessage } = VALID_PAYLOAD;
    const response = await request.post('/api/v1/contact', {
      data: noMessage,
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('invalid email format (no @) returns 400 VALIDATION_ERROR', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, email: 'not-an-email' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('email missing TLD returns 400 VALIDATION_ERROR', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, email: 'alice@nodomain' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('missing email field returns 400 VALIDATION_ERROR', async ({ request }) => {
    const { email: _email, ...noEmail } = VALID_PAYLOAD;
    const response = await request.post('/api/v1/contact', { data: noEmail });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // Honeypot: the spec treats a filled website field as a validation failure.
  // VALIDATION_ERROR is the expected code (consistent with all other 400 paths).
  test('honeypot website field filled returns 400 VALIDATION_ERROR', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, website: 'http://spam.example.com' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('invalid JSON body returns 400', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not json at all',
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // Email header injection: a CRLF-embedded email value must not pass validation.
  // Without sanitizing newline characters the email field becomes an injection vector
  // for Bcc/Cc header smuggling in any downstream mailer.
  test('CRLF-embedded email returns 400 VALIDATION_ERROR', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, email: 'alice@example.com\r\nBcc:victim@example.com' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // Oversized payload: an excessively large message field must be rejected.
  // Without a length cap the endpoint is open to payload-flooding.
  test('oversized message field returns 400', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, message: 'A'.repeat(10_001) },
    });

    expect([400, 413]).toContain(response.status());
    // 413 responses from Next.js body-size limits or nginx carry plain-text bodies, not JSON.
    // Only assert the JSON shape when the route handler itself rejects with 400.
    if (response.status() === 400) {
      const body = await response.json() as { success: boolean };
      expect(body.success).toBe(false);
    }
  });

  // Rate limiting: endpoint enforces 5 req / 300 s per IP (contact-specific limit, #177).
  // Placed last. By this point the quota is already spent by the prior tests (the rate
  // limiter counts all requests before validation), so the first request here will return
  // 429 immediately. test.skip on retry prevents the spent quota from also poisoning a
  // retry run of the earlier tests.
  test('repeated rapid submissions trigger 429 RATE_LIMITED', async ({ request }, testInfo) => {
    test.skip(testInfo.retry > 0, 'Rate-limit quota is spent; cannot retry within the 5-minute window');
    const OVER_LIMIT = 6;
    let rateLimited = false;
    for (let i = 0; i < OVER_LIMIT; i++) {
      const response = await request.post('/api/v1/contact', { data: VALID_PAYLOAD });
      if (response.status() === 429) {
        rateLimited = true;
        const body = await response.json() as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});
