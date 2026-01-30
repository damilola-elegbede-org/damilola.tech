import { test, expect } from '@playwright/test';

test.describe('Traffic Source Tracking', () => {
  // Each test uses a fresh browser context to ensure clean localStorage
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should capture UTM parameters in localStorage', async ({ browser }) => {
    // Create a fresh context for this test
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate with UTM parameters as first visit
    await page.goto('/?utm_source=test&utm_medium=e2e&utm_campaign=playwright');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Check localStorage for traffic source
    const trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(trafficSource).not.toBeNull();
    expect(trafficSource.source).toBe('test');
    expect(trafficSource.medium).toBe('e2e');
    expect(trafficSource.campaign).toBe('playwright');
    expect(trafficSource.landingPage).toBe('/');
    expect(trafficSource.capturedAt).toBeDefined();

    await context.close();
  });

  test('should override cached traffic source when UTM params present', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // First visit: direct (no UTM)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    let trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });
    expect(trafficSource.source).toBe('direct');

    // Second visit: with UTM params (should override)
    await page.goto('/?utm_source=newsletter&utm_medium=email');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });
    expect(trafficSource.source).toBe('newsletter');
    expect(trafficSource.medium).toBe('email');

    await context.close();
  });

  test('should preserve cached source when no UTM params on subsequent visit', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // First visit with UTM params
    await page.goto('/?utm_source=first&utm_medium=test');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const firstSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });
    expect(firstSource.source).toBe('first');

    // Second visit without UTM params (should keep cached)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const afterSecondVisit = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(afterSecondVisit.source).toBe('first');
    expect(afterSecondVisit.capturedAt).toBe(firstSource.capturedAt);

    await context.close();
  });

  test('should classify direct traffic when no UTM params', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate without UTM parameters
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(trafficSource).not.toBeNull();
    expect(trafficSource.source).toBe('direct');
    expect(trafficSource.medium).toBe('none');

    await context.close();
  });

  test('should capture all UTM parameters including optional ones', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(
      '/?utm_source=google&utm_medium=cpc&utm_campaign=spring2024&utm_term=engineering+manager&utm_content=headline1'
    );
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(trafficSource).not.toBeNull();
    expect(trafficSource.source).toBe('google');
    expect(trafficSource.medium).toBe('cpc');
    expect(trafficSource.campaign).toBe('spring2024');
    expect(trafficSource.term).toBe('engineering manager');
    expect(trafficSource.content).toBe('headline1');

    await context.close();
  });

  test('should capture landing page path', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a specific page with UTM params
    await page.goto('/?utm_source=test&utm_medium=e2e#experience');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(trafficSource).not.toBeNull();
    expect(trafficSource.landingPage).toBe('/');

    await context.close();
  });

  test('should capture UTM parameters from shortlink redirect', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to shortlink - Playwright follows 307 redirects
    await page.goto('/test');
    await page.waitForLoadState('domcontentloaded');

    // Verify final URL contains UTM parameters
    expect(page.url()).toContain('utm_source=test');
    expect(page.url()).toContain('utm_medium=e2e');

    await page.waitForTimeout(500);

    // Verify localStorage has correct traffic source
    const trafficSource = await page.evaluate(() => {
      const stored = localStorage.getItem('audit_traffic_source');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    });

    expect(trafficSource).not.toBeNull();
    expect(trafficSource.source).toBe('test');
    expect(trafficSource.medium).toBe('e2e');

    await context.close();
  });
});
