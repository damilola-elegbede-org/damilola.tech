import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the hero section', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Damilola Elegbede');
    await expect(page.getByText('Engineering Manager')).toBeVisible();
    await expect(
      page.getByText('Building high-performance organizations that deliver enterprise-scale solutions')
    ).toBeVisible();
  });

  test('should display the CTA button in hero', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ask ai about my experience/i })).toBeVisible();
  });

  test('should display all main sections', async ({ page }) => {
    // Hero
    await expect(page.locator('#hero')).toBeVisible();

    // About
    await expect(page.locator('#about')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();

    // Experience
    await expect(page.locator('#experience')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();

    // Skills
    await expect(page.locator('#skills')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();

    // Education
    await expect(page.locator('#education')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Education' })).toBeVisible();

    // Contact
    await expect(page.locator('#contact')).toBeVisible();
    await expect(page.getByRole('heading', { name: "Let's Connect" })).toBeVisible();
  });

  test('should display experience entries', async ({ page }) => {
    await expect(page.getByText('Verily Life Sciences')).toBeVisible();
    await expect(page.getByText('Qualcomm Technologies').first()).toBeVisible();
  });

  test('should display skill badges', async ({ page }) => {
    await expect(page.getByText('GCP')).toBeVisible();
    await expect(page.getByText('AWS')).toBeVisible();
    await expect(page.getByText('Kubernetes/GKE')).toBeVisible();
  });

  test('should display education entries', async ({ page }) => {
    await expect(page.getByText('MBA')).toBeVisible();
    await expect(page.getByText('MS Computer Science')).toBeVisible();
  });

  test('should display contact information', async ({ page }) => {
    await expect(page.getByRole('link', { name: /damilola.elegbede@gmail.com/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /linkedin/i })).toBeVisible();
    await expect(page.getByText('Boulder, CO')).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Damilola Elegbede/);
  });
});

test.describe('Experience Section Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should expand and collapse experience entries', async ({ page }) => {
    // First experience should be expanded by default
    const firstExperience = page.locator('#experience button').first();
    await expect(firstExperience).toHaveAttribute('aria-expanded', 'true');

    // Check that highlights are visible
    await expect(page.getByText(/enterprise-wide GCP transformation/i)).toBeVisible();

    // Click to collapse
    await firstExperience.click();
    await expect(firstExperience).toHaveAttribute('aria-expanded', 'false');

    // Click to expand again
    await firstExperience.click();
    await expect(firstExperience).toHaveAttribute('aria-expanded', 'true');
  });
});
