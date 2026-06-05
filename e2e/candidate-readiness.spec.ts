import { test, expect } from '@playwright/test';

// Candidate-readiness smoke test (ENG-480)
//
// Verifies the critical paths a recruiter or candidate takes after the
// In Review queue (ENG-124, ENG-126, ENG-496, ENG-502, ENG-565) clears to main.
// Each test covers exactly one observable guarantee — fast, no chained flows.

test.describe('candidate-readiness smoke (ENG-480)', () => {

  // ── Infrastructure ──────────────────────────────────────────────────────

  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json() as { status: string; website: string };
    expect(body.status).toBe('ok');
    expect(body.website).toBe('up');
  });

  // ── SEO & crawlability ──────────────────────────────────────────────────

  test('robots.txt is accessible and allows /', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('Allow: /');
  });

  test('robots.txt disallows /admin/ and /api/', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('Disallow: /admin/');
    expect(text).toContain('Disallow: /api/');
  });

  test('sitemap.xml is accessible and includes key pages', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('damilola.tech</loc>');
    expect(body).toContain('/consulting');
    expect(body).toContain('/projects/cortex/case-study');
  });

  // ── Home page ───────────────────────────────────────────────────────────

  test('home page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Damilola Elegbede/);
  });

  test('home page hero section is visible with name and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Damilola Elegbede');
    await expect(page.getByRole('button', { name: /ask ai about me/i })).toBeVisible();
  });

  test('home page displays all candidate-facing sections', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#experience', '#skills-assessment', '#fit-assessment', '#education', '#contact']) {
      await expect(page.locator(id)).toBeVisible();
    }
  });

  // ── Chat (AI assistant) ─────────────────────────────────────────────────

  test('chat FAB opens panel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Chat FAB interaction differs on mobile');
    await page.goto('/');
    await page.getByLabel('Open chat').click();
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();
  });

  test('chat panel shows suggested questions', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Chat FAB interaction differs on mobile');
    await page.goto('/');
    await page.getByLabel('Open chat').click();
    const panel = page.getByRole('dialog', { name: /chat/i });
    const suggestions = panel.getByRole('button').filter({ hasText: /./u });
    await expect(suggestions.first()).toBeVisible();
    expect(await suggestions.count()).toBeGreaterThan(0);
  });

  // ── Fit Assessment ──────────────────────────────────────────────────────

  test('fit assessment section has strong and weak fit example buttons', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#fit-assessment');
    await expect(section).toBeVisible();
    await expect(section.getByRole('button', { name: /strong fit example/i })).toBeVisible({ timeout: 15000 });
    await expect(section.getByRole('button', { name: /weak fit example/i })).toBeVisible({ timeout: 15000 });
  });

  test('fit assessment analyze button starts disabled', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#fit-assessment');
    await expect(section.getByRole('button', { name: /analyze fit/i })).toBeDisabled({ timeout: 15000 });
  });

  // ── /consulting ─────────────────────────────────────────────────────────

  test('/consulting returns 200', async ({ page }) => {
    const res = await page.goto('/consulting');
    expect(res?.status()).toBe(200);
  });

  test('/consulting has correct title', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page).toHaveTitle('Fractional VPE & Engineering Leadership | Damilola Elegbede');
  });

  test('/consulting hero h1 is visible', async ({ page }) => {
    await page.goto('/consulting');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Engineering leadership');
    await expect(h1).toContainText('fractionally');
  });

  test('/consulting availability badge is visible', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByText(/Taking on \d/)).toBeVisible();
  });

  test('/consulting displays all three service cards', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('heading', { name: 'Strategic Engineering Guidance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System Design Assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hiring & Org Design' })).toBeVisible();
  });

  test('/consulting CTA section is present', async ({ page }) => {
    await page.goto('/consulting');
    await expect(page.getByRole('region', { name: 'Contact' })).toBeVisible();
  });

  // ── /projects/cortex/case-study ─────────────────────────────────────────

  test('/projects/cortex/case-study returns 200', async ({ page }) => {
    const res = await page.goto('/projects/cortex/case-study');
    expect(res?.status()).toBe(200);
  });

  test('/projects/cortex/case-study has correct title', async ({ page }) => {
    await page.goto('/projects/cortex/case-study');
    await expect(page).toHaveTitle(/Cortex Agent Fleet/);
  });

  test('/projects/cortex/case-study h1 is visible', async ({ page }) => {
    await page.goto('/projects/cortex/case-study');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cortex Agent Fleet');
  });

  // ── Public API endpoints ─────────────────────────────────────────────────

  test('GET /api/v1/resume.pdf returns a PDF', async ({ request }) => {
    const res = await request.get('/api/v1/resume.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
  });

  test('GET /api/v1/resume-data returns 401 without API key', async ({ request }) => {
    const res = await request.get('/api/v1/resume-data');
    expect(res.status()).toBe(401);
  });

});
