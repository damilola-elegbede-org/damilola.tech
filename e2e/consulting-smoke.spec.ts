import { test, expect } from '@playwright/test';

// Set CONSULTING_SMOKE_FULL=1 to run post-merge acceptance checks.
// Until ENG-447 / ENG-210 / ENG-495 / ENG-500 all merge to main,
// only the baseline describe block runs.
const FULL = process.env.CONSULTING_SMOKE_FULL === '1';

test.describe('/consulting page – smoke test (ENG-502)', () => {

  // ── Baseline: always runs ─────────────────────────────────────────────────

  test('page returns 200', async ({ page }) => {
    const res = await page.goto('/consulting');
    expect(res?.status()).toBe(200);
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page).toHaveTitle('Fractional Engineering Leadership | Damilola Elegbede');
  });

  test('hero h1 is visible', async ({ page }) => {
    await page.goto('/consulting');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Engineering leadership');
    await expect(h1).toContainText('fractionally');
  });

  test('availability badge is visible', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByText(/Taking on 1/)).toBeVisible();
  });

  test('"Is this you?" section is present', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('heading', { name: 'Is this you?' })).toBeVisible();
  });

  test('engagement model shows Discovery / Findings / Engagement steps', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByText('Discovery', { exact: true })).toBeVisible();
    await expect(page.getByText('Findings', { exact: true })).toBeVisible();
    await expect(page.getByText('Engagement', { exact: true })).toBeVisible();
  });

  test('three service cards are visible', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('heading', { name: 'Strategic Engineering Guidance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System Design Assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hiring & Org Design' })).toBeVisible();
  });

  test('CTA section is visible', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('region', { name: 'Contact' })).toBeVisible();
    await expect(page.getByText("Let's talk about your team")).toBeVisible();
  });

  test('back navigation link to home is present', async ({ page }) => {
    await page.goto('/consulting');
    const links = page.getByRole('link').filter({ hasText: /← Damilola Elegbede|← Back to main site/ });
    await expect(links.first()).toBeVisible();
  });

  test('/consulting appears in sitemap.xml', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('/consulting');
  });

  test('og:title meta tag is present', async ({ page }) => {
    await page.goto('/consulting');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Fractional Engineering/);
  });

  test('twitter:card meta tag is set to summary_large_image', async ({ page }) => {
    await page.goto('/consulting');
    const twCard = page.locator('meta[name="twitter:card"]');
    await expect(twCard).toHaveAttribute('content', 'summary_large_image');
  });

  // ── Post-merge: ENG-210 – Contact form + /api/v1/contact ─────────────────
  //
  // Precondition: PR #177 (eng-210-contact-form-endpoint) merged to main.

  test.describe('ENG-210: contact form renders', () => {
    test.skip(!FULL, 'Set CONSULTING_SMOKE_FULL=1 after ENG-210 merges');

    test('contact form renders with all required fields', async ({ page }) => {
      await page.goto('/consulting');
      await expect(page.locator('#contact-name')).toBeVisible();
      await expect(page.locator('#contact-email')).toBeVisible();
      await expect(page.locator('#contact-company')).toBeVisible();
      await expect(page.locator('#contact-message')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
    });

    test('submit button is disabled while submitting', async ({ page }) => {
      await page.goto('/consulting');
      await page.fill('#contact-name', 'Remy Smoke');
      await page.fill('#contact-email', 'remy+smoke-eng502@test.invalid');
      await page.fill('#contact-message', '[ENG-502 smoke test — ignore]');
      const btn = page.getByRole('button', { name: 'Send message' });
      await btn.click();
      await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    });

    test('form shows success state after valid submission', async ({ page }) => {
      await page.goto('/consulting');
      await page.fill('#contact-name', 'Remy Smoke');
      await page.fill('#contact-email', 'remy+smoke-eng502@test.invalid');
      await page.fill('#contact-message', '[ENG-502 smoke test — ignore]');
      await page.click('button[type="submit"]');
      await expect(page.getByText('Thank you for reaching out')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('ENG-210: POST /api/v1/contact contract', () => {
    test.skip(!FULL, 'Set CONSULTING_SMOKE_FULL=1 after ENG-210 merges');

    test('returns 201 with valid payload', async ({ request }) => {
      const res = await request.post('/api/v1/contact', {
        data: {
          name: 'Remy Smoke Test',
          email: 'remy+smoke-eng502@test.invalid',
          message: '[ENG-502 smoke test — ignore]',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(typeof body.data.confirmation).toBe('string');
      // No submission contents in response
      expect(body.data).not.toHaveProperty('name');
      expect(body.data).not.toHaveProperty('email');
      expect(body.data).not.toHaveProperty('message');
    });

    test('returns 400 when name is missing', async ({ request }) => {
      const res = await request.post('/api/v1/contact', {
        data: { name: '', email: 'valid@test.com', message: 'Hello' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('returns 400 with invalid email', async ({ request }) => {
      const res = await request.post('/api/v1/contact', {
        data: { name: 'Test', email: 'not-an-email', message: 'Hello' },
      });
      expect(res.status()).toBe(400);
    });

    test('returns 400 when message is missing', async ({ request }) => {
      const res = await request.post('/api/v1/contact', {
        data: { name: 'Test', email: 'test@test.com', message: '' },
      });
      expect(res.status()).toBe(400);
    });

    test('returns 400 when honeypot website field is filled', async ({ request }) => {
      const res = await request.post('/api/v1/contact', {
        data: {
          name: 'Bot',
          email: 'bot@spam.com',
          message: 'spam',
          website: 'http://spam.com',
        },
      });
      expect(res.status()).toBe(400);
    });
  });

  // ── Post-merge: ENG-447 – Hero update + OG image ─────────────────────────
  //
  // Precondition: PR #171 (eng-447-consulting-hero) merged to main.

  test.describe('ENG-447: hero updates + OG image', () => {
    test.skip(!FULL, 'Set CONSULTING_SMOKE_FULL=1 after ENG-447 merges');

    test('OG image route is accessible', async ({ request }) => {
      const res = await request.get('/consulting/opengraph-image');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toMatch(/image/);
    });

    test('og:url meta tag points to /consulting canonical URL', async ({ page }) => {
      await page.goto('/consulting');
      const ogUrl = page.locator('meta[property="og:url"]');
      await expect(ogUrl).toHaveAttribute('content', /\/consulting/);
    });

    test('"Work with me" CTA links to #contact', async ({ page }) => {
      await page.goto('/consulting');
      const cta = page.getByRole('link', { name: /Work with me/i });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', '#contact');
    });

    test('contact section has id="contact" for anchor navigation', async ({ page }) => {
      await page.goto('/consulting');
      await expect(page.locator('#contact')).toBeVisible();
    });
  });

  // ── Post-merge: ENG-495 – Rate-limiting case study ───────────────────────
  //
  // Precondition: PR #176 (eng-498-rate-limiting-case-study) merged to main.

  test.describe('ENG-495: rate-limiting case study', () => {
    test.skip(!FULL, 'Set CONSULTING_SMOKE_FULL=1 after ENG-495 merges');

    test('/projects/rate-limiting page returns 200', async ({ request }) => {
      const res = await request.get('/projects/rate-limiting');
      expect(res.status()).toBe(200);
    });

    test('rate-limiting case study renders an h1', async ({ page }) => {
      await page.goto('/projects/rate-limiting');
      await expect(page).not.toHaveTitle(/404|Not Found/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  // ── Post-merge: ENG-500 – SEO ─────────────────────────────────────────────
  //
  // Precondition: ENG-500 SEO work merged to main.

  test.describe('ENG-500: SEO', () => {
    test.skip(!FULL, 'Set CONSULTING_SMOKE_FULL=1 after ENG-500 merges');

    test('og:url points to canonical damilola.tech/consulting', async ({ page }) => {
      await page.goto('/consulting');
      const ogUrl = page.locator('meta[property="og:url"]');
      await expect(ogUrl).toHaveAttribute('content', 'https://damilola.tech/consulting');
    });

    test('/consulting is not blocked by robots.txt', async ({ request }) => {
      const res = await request.get('/robots.txt');
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body).not.toMatch(/Disallow:\s+\/consulting/);
    });
  });

});
