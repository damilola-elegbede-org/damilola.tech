import { test, expect } from '@playwright/test';

test.describe('Cortex Case Study Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/cortex/case-study');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle('Cortex Agent Fleet — Case Study | Damilola Elegbede');
  });

  test('should display header with correct content', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cortex Agent Fleet');
    await expect(page.getByText('Case Study', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/production multi-agent AI system/i)
    ).toBeVisible();
  });

  test('should display all four impact metrics', async ({ page }) => {
    const metricsGrid = page.locator('.grid').first();

    await expect(metricsGrid.getByText('73+', { exact: true })).toBeVisible();
    await expect(metricsGrid.getByText('Tasks completed autonomously')).toBeVisible();

    await expect(metricsGrid.getByText('20+', { exact: true })).toBeVisible();
    await expect(metricsGrid.getByText(/PRs in D's review queue/i)).toBeVisible();

    await expect(metricsGrid.getByText('5', { exact: true })).toBeVisible();
    await expect(metricsGrid.getByText('Repos actively maintained')).toBeVisible();

    await expect(metricsGrid.getByText('14.5M', { exact: true })).toBeVisible();
    await expect(metricsGrid.getByText('Tokens/week (post-efficiency trim)', { exact: true })).toBeVisible();
  });

  test('should display all content sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'The Problem' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Solution' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Key Engineering Decisions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tech Stack' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What I Learned' })).toBeVisible();
  });

  test('should display breadcrumb back link', async ({ page }) => {
    const backLink = page.getByRole('link', { name: '← Back to Projects' });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/#projects');
  });

  test('breadcrumb back link navigates to /#projects', async ({ page }) => {
    await page.getByRole('link', { name: /back to projects/i }).click();
    await expect(page).toHaveURL(/#projects$/);
  });

  test('should display footer links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'GitHub →' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Weekly Activity →' })).toBeVisible();
    await expect(page.getByRole('link', { name: '← All Projects' })).toBeVisible();
  });

  test('Weekly Activity link navigates to /projects/cortex/activity', async ({ page }) => {
    await page.getByRole('link', { name: 'Weekly Activity →' }).click();
    await expect(page).toHaveURL(/\/projects\/cortex\/activity/);
  });

  test('All Projects footer link navigates to /#projects', async ({ page }) => {
    await page.getByRole('link', { name: '← All Projects' }).click();
    await expect(page).toHaveURL(/#projects$/);
  });

  test('should display tech stack items', async ({ page }) => {
    await expect(page.getByText('TypeScript / Next.js 15')).toBeVisible();
    await expect(page.getByText('Anthropic Claude API')).toBeVisible();
    await expect(page.getByText('GitHub Apps (10 identities)')).toBeVisible();
  });

  test('should display solution sub-sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Fleet Architecture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Autonomous Scheduling' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PR Quality Gates' })).toBeVisible();
  });
});
