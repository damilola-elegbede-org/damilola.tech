import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display hero section with CTA and correct title', async ({ page }) => {
    // Page title
    await expect(page).toHaveTitle(/Damilola Elegbede/);

    // Hero content - use locator scoped to hero section
    const hero = page.locator('#hero');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Damilola Elegbede');
    await expect(hero.getByText('Sr. Engineering Manager', { exact: true })).toBeVisible();
    await expect(
      hero.getByText('I build engineering organizations that deliver results, retain top talent, and develop leaders')
    ).toBeVisible();

    // CTA button
    await expect(page.getByRole('button', { name: /ask ai about me/i })).toBeVisible();
  });

  test('should display all main sections', async ({ page }) => {
    // Hero
    await expect(page.locator('#hero')).toBeVisible();

    // Experience
    await expect(page.locator('#experience')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Experience', exact: true })).toBeVisible();

    // Skills Assessment
    await expect(page.locator('#skills-assessment')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills Assessment' })).toBeVisible();

    // Fit Assessment
    await expect(page.locator('#fit-assessment')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fit Assessment' })).toBeVisible();

    // Education
    await expect(page.locator('#education')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Education' })).toBeVisible();

    // Contact (footer)
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('should display experience section content', async ({ page }) => {
    // Experience entries
    await expect(page.getByText('Verily Life Sciences')).toBeVisible();
    await expect(page.getByText('Qualcomm Technologies').first()).toBeVisible();

    // Experience highlights
    await expect(page.getByText(/enterprise-wide GCP cloud transformation/i)).toBeVisible();

    // Expand button for experiences with many bullets
    await expect(page.getByRole('button', { name: /show 3 more/i }).first()).toBeVisible();
  });

  test('should display skills assessment cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Expert' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Proficient' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Familiar' })).toBeVisible();
  });

  test('should display education entries', async ({ page }) => {
    const educationSection = page.locator('#education');
    await expect(educationSection.getByText('MBA')).toBeVisible();
    await expect(educationSection.getByText('MS Computer Science')).toBeVisible();
  });

  test('should display contact links in footer', async ({ page }) => {
    const footer = page.locator('#contact');
    await expect(footer.getByRole('link', { name: /linkedin/i })).toBeVisible();
    await expect(footer.getByText('Boulder, CO', { exact: true })).toBeVisible();
  });

  test('should display navigation with correct links', async ({ page, isMobile }) => {
    // Skip on mobile - navigation is hidden behind hamburger menu
    test.skip(isMobile, 'Navigation links are hidden on mobile');

    // Navigation links visible on desktop
    await expect(page.getByRole('link', { name: /experience/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /skills/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /fit assessment/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /education/i }).first()).toBeVisible();

    // At least 4 nav links expected (Contact not in nav)
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('should include JSON-LD structured data with Person and WebSite schema', async ({ page }) => {
    const jsonLdScript = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScript).toBeAttached();

    const content = await jsonLdScript.textContent();
    const data = JSON.parse(content!);

    // Verify @graph contains both Person and WebSite entries
    expect(data['@context']).toBe('https://schema.org');
    expect(Array.isArray(data['@graph'])).toBe(true);

    const person = data['@graph'].find((node: { '@type': string }) => node['@type'] === 'Person');
    expect(person).toBeDefined();
    expect(person.name).toBe('Damilola Elegbede');
    expect(person.jobTitle).toBe('Distinguished Engineer');
    expect(person.url).toBe('https://damilola.tech');
    expect(person.sameAs).toContain('https://linkedin.com/in/damilola-elegbede');
    expect(person.sameAs).toContain('https://github.com/damilola-elegbede');

    const website = data['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebSite');
    expect(website).toBeDefined();
    expect(website.name).toBe('Damilola Elegbede');
    expect(website.url).toBe('https://damilola.tech');
  });
});
