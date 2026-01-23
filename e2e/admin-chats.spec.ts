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
    await page.goto('/admin/chats');
  });

  test('displays chats heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Chat Sessions' })).toBeVisible();
  });

  test('shows table headers', async ({ page }) => {
    await expect(page.getByText('Session ID')).toBeVisible();
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Size')).toBeVisible();
  });

  test('shows empty state when no chats', async ({ page }) => {
    // If no chats exist, should show empty message
    const hasChats = await page.locator('tbody tr').count();
    if (hasChats === 0) {
      await expect(page.getByText('No data found')).toBeVisible();
    }
  });

  test('can click on chat row to view detail', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first();
    const hasChats = await firstRow.count();

    if (hasChats > 0) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/chats\/.+/);
      await expect(page.getByRole('heading', { name: 'Chat Session' })).toBeVisible();
    }
  });
});
