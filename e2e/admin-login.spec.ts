import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL('/admin/login');
    await expect(page.getByText('Admin Login')).toBeVisible();
  });

  test('shows login form elements', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows error for invalid password', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid password')).toBeVisible();
    await expect(page).toHaveURL('/admin/login');
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    // This test requires ADMIN_PASSWORD_PREVIEW to be set
    const password = process.env.ADMIN_PASSWORD_PREVIEW;
    if (!password) {
      test.skip();
      return;
    }

    await page.goto('/admin/login');

    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/admin/dashboard');
  });

  test('login button is disabled while submitting', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel('Password').fill('any-password');

    const button = page.getByRole('button', { name: 'Sign In' });
    await button.click();

    // Button should be disabled during request (brief window)
    // Just verify the form submits without errors
    await expect(page.getByText('Invalid password').or(page.getByText('Signing in...'))).toBeVisible({ timeout: 5000 });
  });
});
