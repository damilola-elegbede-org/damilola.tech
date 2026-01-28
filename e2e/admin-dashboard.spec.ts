import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if no password configured
    const password = process.env.ADMIN_PASSWORD_PREVIEW;
    if (!password) {
      test.skip();
      return;
    }

    // Login first
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/admin/dashboard');

    // Wait for dashboard to finish loading (spinner disappears, heading appears)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  });

  test('displays dashboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows stats cards', async ({ page }) => {
    // Wait for stats to load (they load asynchronously)
    // Use main region to avoid matching nav links
    const main = page.getByRole('main');
    await expect(main.getByText('Chat Sessions')).toBeVisible({ timeout: 10000 });
    await expect(main.getByText('Fit Assessments')).toBeVisible();
    await expect(main.getByText('Audit Events')).toBeVisible();
  });

  test('has navigation links', async ({ page }) => {
    // Use nav element to target sidebar navigation specifically
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Chats' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Fit Assessments' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Audit Log' })).toBeVisible();
  });

  test('can navigate to chats page', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('link', { name: 'Chats' }).click();
    await expect(page).toHaveURL('/admin/chats');
  });

  test('can navigate to fit assessments page', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('link', { name: 'Fit Assessments' }).click();
    await expect(page).toHaveURL('/admin/fit-assessments');
  });

  test('can navigate to audit log page', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('link', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL('/admin/audit');
  });

  test('logout works', async ({ page }) => {
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL('/admin/login');

    // Verify can't access dashboard anymore
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL('/admin/login');
  });
});
