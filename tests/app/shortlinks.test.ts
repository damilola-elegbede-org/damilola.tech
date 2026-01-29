import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getShortlink, SHORTLINKS } from '@/lib/shortlinks';

// Test the shortlinks configuration module
describe('shortlinks configuration', () => {
  describe('SHORTLINKS', () => {
    it('contains all 23 shortlinks', () => {
      expect(SHORTLINKS).toHaveLength(23);
    });

    it('has unique slugs', () => {
      const slugs = SHORTLINKS.map((link) => link.slug);
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it('all entries have required fields', () => {
      SHORTLINKS.forEach((link) => {
        expect(link.slug).toBeTruthy();
        expect(link.utm_source).toBeTruthy();
        expect(link.utm_medium).toBeTruthy();
        expect(link.description).toBeTruthy();
      });
    });
  });

  describe('getShortlink', () => {
    it('returns config for valid slug', () => {
      const result = getShortlink('recruiter');
      expect(result).toEqual({
        slug: 'recruiter',
        utm_source: 'recruiter',
        utm_medium: 'verbal',
        description: 'Shared with external recruiters',
      });
    });

    it('returns undefined for unknown slug', () => {
      const result = getShortlink('nonexistent');
      expect(result).toBeUndefined();
    });

    it('is case-insensitive', () => {
      const lower = getShortlink('recruiter');
      const upper = getShortlink('RECRUITER');
      const mixed = getShortlink('Recruiter');

      expect(lower).toBeDefined();
      expect(upper).toEqual(lower);
      expect(mixed).toEqual(lower);
    });

    it('returns correct UTM params for linkedin shortlink', () => {
      const result = getShortlink('linkedin');
      expect(result).toEqual({
        slug: 'linkedin',
        utm_source: 'linkedin',
        utm_medium: 'bio',
        description: 'LinkedIn profile bio/website field',
      });
    });

    it('returns correct UTM params for li-post shortlink', () => {
      const result = getShortlink('li-post');
      expect(result).toEqual({
        slug: 'li-post',
        utm_source: 'linkedin',
        utm_medium: 'post',
        description: 'Shared in LinkedIn posts',
      });
    });
  });
});

// Test the route handler
describe('shortlinks route handler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('redirects valid shortlink with UTM params', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/recruiter');
    const response = await GET(request, { params: Promise.resolve({ slug: 'recruiter' }) });

    expect(response.status).toBe(307);
    const location = response.headers.get('Location');
    expect(location).toContain('utm_source=recruiter');
    expect(location).toContain('utm_medium=verbal');
  });

  it('returns 404 for unknown slug', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/unknown-slug');
    const response = await GET(request, { params: Promise.resolve({ slug: 'unknown-slug' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Shortlink not found');
  });

  it('handles case-insensitive slugs', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/RECRUITER');
    const response = await GET(request, { params: Promise.resolve({ slug: 'RECRUITER' }) });

    expect(response.status).toBe(307);
    const location = response.headers.get('Location');
    expect(location).toContain('utm_source=recruiter');
    expect(location).toContain('utm_medium=verbal');
  });

  it('redirects linkedin shortlink correctly', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/linkedin');
    const response = await GET(request, { params: Promise.resolve({ slug: 'linkedin' }) });

    expect(response.status).toBe(307);
    const location = response.headers.get('Location');
    expect(location).toContain('utm_source=linkedin');
    expect(location).toContain('utm_medium=bio');
  });

  it('redirects li-post shortlink correctly', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/li-post');
    const response = await GET(request, { params: Promise.resolve({ slug: 'li-post' }) });

    expect(response.status).toBe(307);
    const location = response.headers.get('Location');
    expect(location).toContain('utm_source=linkedin');
    expect(location).toContain('utm_medium=post');
  });

  it('redirects hiringmgr shortlink correctly', async () => {
    const { GET } = await import('@/app/(shortlinks)/[slug]/route');

    const request = new Request('http://localhost/hiringmgr');
    const response = await GET(request, { params: Promise.resolve({ slug: 'hiringmgr' }) });

    expect(response.status).toBe(307);
    const location = response.headers.get('Location');
    expect(location).toContain('utm_source=hiring_manager');
    expect(location).toContain('utm_medium=verbal');
  });
});
