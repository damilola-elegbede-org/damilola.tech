import { test, expect } from '@playwright/test';

test.describe('Cortex Case Study Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/cortex/case-study');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Cortex Agent Fleet/);
  });

  test('should display h1 with correct text', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cortex Agent Fleet');
  });

  test('should display breadcrumb link back to projects', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: '← Back to Projects' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveAttribute('href', '/#projects');
  });

  test('should display "Case Study" badge', async ({ page }) => {
    await expect(page.getByText('Case Study', { exact: true })).toBeVisible();
  });

  test('should display metric card with value "73+"', async ({ page }) => {
    await expect(page.getByText('73+', { exact: true })).toBeVisible();
  });

  test('should display metric card with value "20+"', async ({ page }) => {
    await expect(page.getByText('20+', { exact: true })).toBeVisible();
  });

  test('should display metric card with value "5"', async ({ page }) => {
    await expect(page.getByText('5', { exact: true })).toBeVisible();
  });

  test('should display metric card with value "14.5M"', async ({ page }) => {
    await expect(page.getByText('14.5M', { exact: true })).toBeVisible();
  });

  test('should display intro paragraph mentioning production multi-agent AI system', async ({ page }) => {
    await expect(
      page.getByText(/production multi-agent AI system/i)
    ).toBeVisible();
  });
});
