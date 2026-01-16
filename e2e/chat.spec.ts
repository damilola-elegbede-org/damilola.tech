import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display chat FAB', async ({ page }) => {
    await expect(page.getByLabel('Open chat')).toBeVisible();
  });

  test('should open chat panel when FAB is clicked', async ({ page }) => {
    await page.getByLabel('Open chat').click();

    // Chat panel should be visible
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();
    await expect(page.getByText('Ask About My Experience')).toBeVisible();
  });

  test('should open chat panel when hero CTA is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /ask ai about my experience/i }).click();

    // Chat panel should be visible
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();
  });

  test('should display suggested questions', async ({ page }) => {
    await page.getByLabel('Open chat').click();

    await expect(page.getByRole('button', { name: 'Leadership Philosophy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Developer Growth' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scaling Teams' })).toBeVisible();
  });

  test('should populate input when suggested question is clicked', async ({ page }) => {
    await page.getByLabel('Open chat').click();

    await page.getByRole('button', { name: 'Leadership Philosophy' }).click();

    const input = page.getByPlaceholder('Ask a question...');
    await expect(input).toHaveValue("What's your leadership philosophy?");
  });

  test('should close chat panel when close button is clicked', async ({ page }) => {
    await page.getByLabel('Open chat').click();
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();

    // On mobile, there's a close button inside the panel
    // On desktop, clicking the FAB again closes it
    await page.getByLabel('Close chat').click();

    // The panel should no longer be visible (or at least off-screen)
    // Note: The panel animates off-screen, so we check for the Open chat button
    await expect(page.getByLabel('Open chat')).toBeVisible();
  });

  test('should show input and submit button', async ({ page }) => {
    await page.getByLabel('Open chat').click();

    await expect(page.getByPlaceholder('Ask a question...')).toBeVisible();
    await expect(page.getByRole('button', { name: '' }).filter({ has: page.locator('svg') })).toBeVisible();
  });
});

test.describe('Chat Panel Responsive Behavior', () => {
  test('should show full-screen panel on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.getByLabel('Open chat').click();

    const chatPanel = page.getByRole('dialog', { name: /chat/i });
    await expect(chatPanel).toBeVisible();

    // Check if the panel takes full height on mobile
    const boundingBox = await chatPanel.boundingBox();
    expect(boundingBox?.height).toBeGreaterThan(600);
  });

  test('should show slide-in panel on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.getByLabel('Open chat').click();

    const chatPanel = page.getByRole('dialog', { name: /chat/i });
    await expect(chatPanel).toBeVisible();

    // Check if the panel has constrained dimensions on desktop
    const boundingBox = await chatPanel.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(400);
    expect(boundingBox?.height).toBeLessThanOrEqual(600);
  });
});
