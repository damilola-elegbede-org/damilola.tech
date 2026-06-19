import { test, expect } from '@playwright/test';

test.describe('Consulting Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/consulting');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Fractional VPE & Engineering Leadership/);
    await expect(page).toHaveTitle(/Damilola Elegbede/);
  });

  test('should display headline and availability badge', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Engineering leadership,'
    );
    await expect(page.getByText('fractionally.')).toBeVisible();
    await expect(page.getByText(/Taking on 1–2 clients/)).toBeVisible();
  });

  test('should display "Is this you?" section with check items', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Is this you?' })).toBeVisible();
    await expect(page.getByText(/Seed–Series B startup scaling past 5 engineers/)).toBeVisible();
    await expect(page.getByText(/Founder or CTO carrying the engineering org too long/)).toBeVisible();
    await expect(page.getByText(/DevEx or platform function/)).toBeVisible();
  });

  test('should display engagement model steps', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByText('Discovery', { exact: true })).toBeVisible();
    await expect(page.getByText('Findings', { exact: true })).toBeVisible();
    await expect(page.getByText('Engagement', { exact: true })).toBeVisible();
    await expect(page.getByText('90-min scoped session')).toBeVisible();
    await expect(page.getByText('Written report, yours to keep')).toBeVisible();
    await expect(page.getByText('Monthly retainer, cancel anytime')).toBeVisible();
  });

  test('should display all three service cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'What I offer' })).toBeVisible();

    // Advisory card
    await expect(page.getByRole('heading', { name: 'Strategic Engineering Guidance' })).toBeVisible();
    await expect(page.getByText('Roadmap').first()).toBeVisible();

    // Architecture Review card
    await expect(page.getByRole('heading', { name: 'System Design Assessment' })).toBeVisible();
    await expect(page.getByText('Cloud Infra')).toBeVisible();

    // Team Building card
    await expect(page.getByRole('heading', { name: 'Hiring & Org Design' })).toBeVisible();
    await expect(page.getByText('Leveling', { exact: true })).toBeVisible();
  });

  test('should display CTA section with correct mailto link', async ({ page }) => {
    await expect(page.getByRole('heading', { name: "Let's talk about your team" })).toBeVisible();

    const cta = page.getByRole('link', { name: /damilola.elegbede@gmail.com/i });
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toBe(
      'mailto:damilola.elegbede@gmail.com?subject=Fractional%20VPE%20Inquiry'
    );
  });

  test('should have working back navigation links', async ({ page }) => {
    // Top back link
    const topBackLink = page.getByRole('link', { name: /← Damilola Elegbede/i });
    await expect(topBackLink).toBeVisible();
    await expect(topBackLink).toHaveAttribute('href', '/');

    // Bottom back link
    const bottomBackLink = page.getByRole('link', { name: /← Back to main site/i });
    await expect(bottomBackLink).toBeVisible();
    await expect(bottomBackLink).toHaveAttribute('href', '/');
  });

  test('should navigate back to home when back link is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /← Back to main site/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('sitemap.xml should include /consulting entry', async ({ page }) => {
    await page.goto('/sitemap.xml');
    const content = await page.content();
    expect(content).toContain('/consulting');
  });
});
