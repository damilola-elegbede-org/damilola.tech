import { test, expect } from '@playwright/test';

// PR-blocking gate for /consulting (ENG-922). Deliberately separate from
// consulting-smoke.spec.ts / api/contact.spec.ts, which are designed for the
// post-deploy Preview/Production run (deployment_status trigger in e2e.yml)
// where VERCEL_AUTOMATION_BYPASS_SECRET exempts CI traffic from the contact
// endpoint's rate limiter. In a plain `next start` PR-gate run there is no
// such bypass, and the contact route currently checks the 5-req/300s quota
// BEFORE payload validation (see ENG-1540) — so this file is written to stay
// within a known, fixed request budget (6 total: 1 invalid + 5 valid) rather
// than reusing the existing specs' full test counts, which exceed the quota
// and produce false 429s independent of any real regression.

test.describe('/consulting PR gate (ENG-922)', () => {
  test('page returns 200', async ({ page }) => {
    const res = await page.goto('/consulting');
    expect(res?.status()).toBe(200);
  });

  test('contact form renders with required fields', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#contact-message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });

  // Single test, strict request budget: 1 invalid + up to 5 valid = 6 max,
  // matching the route's limit=5/300s exactly so the 429 fires by design on
  // the last iteration rather than by accident.
  test('contact API: validates, accepts, then rate-limits', async ({ request }) => {
    const invalid = await request.post('/api/v1/contact', {
      data: { name: '', email: 'not-an-email', message: '' },
    });
    expect(invalid.status()).toBe(400);
    const invalidBody = await invalid.json() as { success: boolean };
    expect(invalidBody.success).toBe(false);

    const valid = await request.post('/api/v1/contact', {
      data: {
        name: 'PR Gate Smoke',
        email: 'pr-gate-smoke+eng922@test.invalid',
        message: '[ENG-922 PR gate — ignore]',
      },
    });
    expect(valid.status()).toBe(201);
    const validBody = await valid.json() as { success: boolean; data: { confirmation: string } };
    expect(validBody.success).toBe(true);
    expect(typeof validBody.data.confirmation).toBe('string');

    let rateLimited = false;
    for (let i = 0; i < 4; i++) {
      const res = await request.post('/api/v1/contact', {
        data: {
          name: 'PR Gate Smoke',
          email: 'pr-gate-smoke+eng922@test.invalid',
          message: '[ENG-922 PR gate — ignore]',
        },
      });
      if (res.status() === 429) {
        rateLimited = true;
        const body = await res.json() as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});
