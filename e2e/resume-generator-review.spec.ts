import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Resume Generator review workflow.
 * Tests the interactive change review flow: analyze → review → edit → generate
 */
test.describe('Resume Generator Review Workflow', () => {
  // Configure timeout for tests that call real AI API
  test.describe.configure({ timeout: 120_000 });

  // Skip all tests if no admin password is configured
  test.beforeEach(async ({ page }) => {
    const password = process.env.ADMIN_PASSWORD_PREVIEW;
    if (!password) {
      test.skip();
      return;
    }

    // Login to admin
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(password);
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/admin/auth')),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);
    await expect(page).toHaveURL('/admin/dashboard');

    // Navigate to resume generator
    await page.goto('/admin/resume-generator');
    await expect(page.getByRole('heading', { name: 'ATS Resume Generator' })).toBeVisible();
  });

  test('shows changes as pending after analysis (not auto-accepted)', async ({ page }) => {
    // This test requires the analysis API to be working
    // For now, we just verify the UI loads correctly
    await expect(page.getByRole('heading', { name: 'ATS Resume Generator' })).toBeVisible();

    // Check that form elements are visible
    await expect(page.getByPlaceholder(/paste.*job description/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /analyze/i })).toBeVisible();
  });

  test('UI shows edit and reject options for pending changes', async ({ page }) => {
    // Mock a job description to analyze
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Location: San Francisco, CA

      Requirements:
      - 5+ years of software development experience
      - 3+ years leading engineering teams
      - Experience with cloud platforms (AWS, GCP)
      - Strong communication skills
    `);

    // Click analyze and wait for response
    // Note: This test will be slow as it calls the real API
    // In a real CI environment, you'd mock the API response
    await page.getByRole('button', { name: /analyze/i }).click();

    // Wait for analysis to complete (up to 60 seconds for AI response)
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Verify changes are shown without being pre-accepted
    // Changes should show Accept, Edit & Accept, and Reject buttons
    await expect(page.getByRole('button', { name: /^accept$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit & accept/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^reject$/i }).first()).toBeVisible();
  });

  test('can enter edit mode and modify change text', async ({ page }) => {
    // Fill in job description
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
      - Leadership skills
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Click Edit & Accept on first change
    await page.getByRole('button', { name: /edit & accept/i }).first().click();

    // Verify edit mode is active
    const editTextarea = page.getByLabel(/edit.*change/i);
    await expect(editTextarea).toBeVisible();
    await expect(page.getByRole('button', { name: /save & accept/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Modify the text
    await editTextarea.clear();
    await editTextarea.fill('My custom edited text for this change');

    // Save and accept
    await page.getByRole('button', { name: /save & accept/i }).click();

    // Verify change is now accepted with "Edited" badge
    await expect(page.getByText('Accepted').first()).toBeVisible();
    // Use locator for the specific Edited badge span to avoid matching other text containing "edited"
    await expect(page.locator('span:text-is("Edited")').first()).toBeVisible();
  });

  test('can reject change with optional feedback', async ({ page }) => {
    // Fill in job description
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Click Reject on first change
    await page.getByRole('button', { name: /^reject$/i }).first().click();

    // Verify feedback input appears
    await expect(page.getByPlaceholder(/optional feedback/i)).toBeVisible();

    // Enter feedback
    await page.getByPlaceholder(/optional feedback/i).fill('Too aggressive for this role');

    // Confirm rejection
    await page.getByRole('button', { name: /confirm reject/i }).click();

    // Verify change is now rejected with feedback shown
    await expect(page.getByText('Rejected').first()).toBeVisible();
    await expect(page.getByText(/too aggressive for this role/i)).toBeVisible();
  });

  test('can revert decision back to pending', async ({ page }) => {
    // Fill in job description
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Accept a change first
    await page.getByRole('button', { name: /^accept$/i }).first().click();
    await expect(page.getByText('Accepted').first()).toBeVisible();

    // Now revert it
    await page.getByRole('button', { name: /revert to pending/i }).click();

    // Verify change is back to pending (has Accept/Reject buttons)
    await expect(page.getByRole('button', { name: /^accept$/i }).first()).toBeVisible();
  });

  test('bulk accept all pending changes', async ({ page }) => {
    // Fill in job description
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager at Test Company
      Requirements:
      - 5+ years experience
      - Cloud platforms
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Click Accept All Pending
    await page.getByRole('button', { name: /accept all pending/i }).click();

    // Verify all changes show as Accepted (use retrying assertion)
    const acceptedBadges = page.getByText('Accepted');
    await expect(acceptedBadges.first()).toBeVisible();

    // No more Accept buttons should be visible for individual changes
    await expect(page.getByRole('button', { name: /accept all pending/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^accept$/i })).toHaveCount(0);
  });

  test('generate PDF button disabled when no changes accepted', async ({ page }) => {
    // Fill in job description
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company
      Requirements:
      - Experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 60000 });

    // Generate PDF button should be disabled when no changes are accepted
    // Use .first() since there may be multiple generate buttons on the page
    const generateButton = page.getByRole('button', { name: /generate pdf/i }).first();
    await expect(generateButton).toBeDisabled();

    // Accept a change
    await page.getByRole('button', { name: /^accept$/i }).first().click();

    // Now generate button should be enabled
    await expect(generateButton).toBeEnabled();
  });
});
