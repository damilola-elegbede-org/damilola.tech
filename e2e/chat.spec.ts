import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open chat panel via FAB and display input', async ({ page }) => {
    // FAB should be visible
    await expect(page.getByLabel('Open chat')).toBeVisible();

    // Click FAB to open
    await page.getByLabel('Open chat').click();

    // Chat panel should be visible with header
    const chatPanel = page.getByRole('dialog', { name: /chat/i });
    await expect(chatPanel).toBeVisible();
    await expect(chatPanel.getByText('Ask About My Experience')).toBeVisible();

    // Input should be visible
    await expect(chatPanel.getByPlaceholder('Ask a question...')).toBeVisible();
  });

  test('should open chat panel when hero CTA is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /ask ai about me/i }).click();

    // Chat panel should be visible
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();
  });

  test('should display suggested questions and populate input on click', async ({ page }) => {
    await page.getByLabel('Open chat').click();

    const chatPanel = page.getByRole('dialog', { name: /chat/i });

    // Suggested questions should be visible
    await expect(chatPanel.getByRole('button', { name: 'Leadership Philosophy' })).toBeVisible();
    await expect(chatPanel.getByRole('button', { name: 'Developer Growth' })).toBeVisible();
    await expect(chatPanel.getByRole('button', { name: 'Scaling Teams' })).toBeVisible();

    // Click a suggestion and verify input is populated
    await chatPanel.getByRole('button', { name: 'Leadership Philosophy' }).click();
    const input = chatPanel.getByPlaceholder('Ask a question...');
    await expect(input).toHaveValue("What's your leadership philosophy?");
  });

  test('should close chat panel when close button is clicked', async ({ page }) => {
    await page.getByLabel('Open chat').click();
    await expect(page.getByRole('dialog', { name: /chat/i })).toBeVisible();

    // Use the FAB button to close (it becomes close button when panel is open)
    await page.getByRole('button', { name: 'Close chat' }).first().click();

    // FAB should be visible again (panel closed)
    await expect(page.getByLabel('Open chat')).toBeVisible();
  });

  test('should display appropriate panel size based on viewport', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByLabel('Open chat').click();

    const chatPanel = page.getByRole('dialog', { name: /chat/i });
    await expect(chatPanel).toBeVisible();

    // Mobile: panel should take full height
    let boundingBox = await chatPanel.boundingBox();
    expect(boundingBox?.height).toBeGreaterThan(600);

    // Close using the panel's close button (visible on mobile)
    await chatPanel.getByLabel('Close chat').click();

    // Resize to desktop and reopen
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByLabel('Open chat').click();

    await expect(chatPanel).toBeVisible();

    // Desktop: panel should have constrained dimensions (allow 1px for rounding)
    boundingBox = await chatPanel.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(401);
    expect(boundingBox?.height).toBeLessThanOrEqual(601);
  });
});
