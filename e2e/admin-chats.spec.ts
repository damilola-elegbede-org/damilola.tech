import { test, expect } from '@playwright/test';

test.describe('Admin Chats', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.goto('/admin/chats');
  });

  test('displays chats heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Chat Sessions' })).toBeVisible();
  });

  test('shows table or empty state after loading', async ({ page }) => {
    // Wait for loading to complete - either table headers or empty state will appear
    await expect(
      page.getByText('Session ID').or(page.getByText('No data found'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to chat detail if data exists', async ({ page }) => {
    // Wait for loading to complete
    await expect(
      page.getByText('Session ID').or(page.getByText('No data found'))
    ).toBeVisible({ timeout: 10000 });

    const firstRow = page.locator('tbody tr').first();
    const hasChats = await firstRow.count();

    if (hasChats > 0) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/chats\/.+/);
    }
  });
});
