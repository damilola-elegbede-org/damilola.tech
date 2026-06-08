import { test, expect } from '@playwright/test';

const VALID_PAYLOAD = {
  name: 'Alice Remy',
  email: 'alice@example.com',
  company: 'Acme Corp',
  message: 'I would like to discuss a fractional engagement for my engineering team.',
};

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

  test('optional company field can be omitted', async ({ request }) => {
    const { company: _company, ...noCompany } = VALID_PAYLOAD;
    const response = await request.post('/api/v1/contact', {
      data: noCompany,
    });

    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data: { confirmation: string } };
    expect(body.success).toBe(true);
  });

  test('honeypot website field filled returns 400', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      data: { ...VALID_PAYLOAD, website: 'http://spam.example.com' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  test('invalid JSON body returns 400', async ({ request }) => {
    const response = await request.post('/api/v1/contact', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not json at all',
    });

    expect(response.status()).toBe(400);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
