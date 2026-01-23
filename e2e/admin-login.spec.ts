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

    // Wait for auth API response to complete before checking for error
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/admin/auth')),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);

    // Use filter to avoid matching Next.js route announcer which also has role="alert"
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid password' })).toBeVisible();
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

  test('login button shows loading state while submitting', async ({ page }) => {
    await page.goto('/admin/login');

    // Intercept auth request and delay response to ensure loading state is visible
    await page.route('**/api/admin/auth', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.getByLabel('Password').fill('any-password');

    const button = page.getByRole('button', { name: 'Sign In' });
    await button.click();

    // Button should show loading state during the delayed request
    await expect(button).toContainText('Signing in...');
    await expect(button).toBeDisabled();

    // Wait for response to complete - filter to avoid Next.js route announcer
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid password' })).toBeVisible({ timeout: 5000 });
  });
});
