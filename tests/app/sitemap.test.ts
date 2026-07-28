import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';

// ENG-1216: sitemap.xml must list every canonical (non-admin, non-API) live
// route so Google can index them. This test is the regression guard against
// the drift class that motivated the issue — new public routes shipping
// without a matching sitemap entry.
describe('sitemap', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  const EXPECTED_ROUTES = [
    '',
    '/consulting',
    '/case-studies',
    '/case-studies/alcbf',
    '/case-studies/scf-dance',
    '/portfolio',
    '/projects/bareclaude/case-study',
    '/projects/bareclaude/activity',
    '/projects/alcbf/case-study',
    '/projects/rate-limiting',
    '/docs',
    '/docs/about',
    '/docs/ai-assistant',
    '/docs/privacy',
  ];

  it('includes every canonical live route', () => {
    for (const route of EXPECTED_ROUTES) {
      expect(urls).toContain(`https://www.damilola.tech${route}`);
    }
  });

  it('has no duplicate entries', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('never lists admin or API routes', () => {
    for (const url of urls) {
      expect(url).not.toMatch(/\/admin\//);
      expect(url).not.toMatch(/\/api\//);
    }
  });

  it('every entry has priority and changeFrequency set', () => {
    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
      expect(entry.changeFrequency).toBeTruthy();
    }
  });
});
