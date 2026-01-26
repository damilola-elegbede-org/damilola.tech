import { describe, it, expect } from 'vitest';
import { generateJobId, extractDatePosted, normalizeUrl, normalizeCompanyAndTitle } from '@/lib/job-id';

describe('generateJobId', () => {
  describe('URL-based job ID', () => {
    it('should generate consistent ID from URL', () => {
      const id1 = generateJobId({ url: 'https://jobs.lever.co/company/12345' });
      const id2 = generateJobId({ url: 'https://jobs.lever.co/company/12345' });
      expect(id1.jobId).toBe(id2.jobId);
      expect(id1.source).toBe('url');
    });

    it('should generate 12-character hex string', () => {
      const result = generateJobId({ url: 'https://example.com/job/123' });
      expect(result.jobId).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should normalize URL - remove protocol', () => {
      const http = generateJobId({ url: 'http://example.com/job/123' });
      const https = generateJobId({ url: 'https://example.com/job/123' });
      expect(http.jobId).toBe(https.jobId);
    });

    it('should normalize URL - remove trailing slash', () => {
      const withSlash = generateJobId({ url: 'https://example.com/job/123/' });
      const withoutSlash = generateJobId({ url: 'https://example.com/job/123' });
      expect(withSlash.jobId).toBe(withoutSlash.jobId);
    });

    it('should normalize URL - lowercase', () => {
      const upper = generateJobId({ url: 'https://EXAMPLE.COM/Job/123' });
      const lower = generateJobId({ url: 'https://example.com/job/123' });
      expect(upper.jobId).toBe(lower.jobId);
    });

    it('should keep query params (different params = different job)', () => {
      const withParams = generateJobId({ url: 'https://example.com/job?id=123' });
      const differentParams = generateJobId({ url: 'https://example.com/job?id=456' });
      expect(withParams.jobId).not.toBe(differentParams.jobId);
    });

    it('should include original URL in result', () => {
      const url = 'https://jobs.lever.co/company/12345';
      const result = generateJobId({ url });
      expect(result.originalUrl).toBe(url);
    });
  });

  describe('title+company based job ID', () => {
    it('should generate consistent ID from title and company', () => {
      const id1 = generateJobId({ title: 'Software Engineer', company: 'Acme Inc' });
      const id2 = generateJobId({ title: 'Software Engineer', company: 'Acme Inc' });
      expect(id1.jobId).toBe(id2.jobId);
      expect(id1.source).toBe('title_company');
    });

    it('should normalize - case insensitive', () => {
      const upper = generateJobId({ title: 'SOFTWARE ENGINEER', company: 'ACME INC' });
      const lower = generateJobId({ title: 'software engineer', company: 'acme inc' });
      expect(upper.jobId).toBe(lower.jobId);
    });

    it('should normalize - trim whitespace', () => {
      const withSpaces = generateJobId({ title: '  Software Engineer  ', company: '  Acme Inc  ' });
      const trimmed = generateJobId({ title: 'Software Engineer', company: 'Acme Inc' });
      expect(withSpaces.jobId).toBe(trimmed.jobId);
    });

    it('should normalize - collapse internal whitespace', () => {
      const extraSpaces = generateJobId({ title: 'Software   Engineer', company: 'Acme   Inc' });
      const singleSpaces = generateJobId({ title: 'Software Engineer', company: 'Acme Inc' });
      expect(extraSpaces.jobId).toBe(singleSpaces.jobId);
    });

    it('should generate different IDs for same role at different companies', () => {
      const company1 = generateJobId({ title: 'Software Engineer', company: 'Acme Inc' });
      const company2 = generateJobId({ title: 'Software Engineer', company: 'Beta Corp' });
      expect(company1.jobId).not.toBe(company2.jobId);
    });

    it('should not include URL in title_company results', () => {
      const result = generateJobId({ title: 'Software Engineer', company: 'Acme' });
      expect(result.originalUrl).toBeUndefined();
    });
  });

  describe('URL preference over title+company', () => {
    it('should prefer URL when both are provided', () => {
      const urlOnly = generateJobId({ url: 'https://example.com/job/123' });
      const both = generateJobId({
        url: 'https://example.com/job/123',
        title: 'Software Engineer',
        company: 'Acme',
      });
      expect(urlOnly.jobId).toBe(both.jobId);
      expect(both.source).toBe('url');
    });
  });

  describe('error handling', () => {
    it('should throw when neither URL nor title+company provided', () => {
      expect(() => generateJobId({})).toThrow('Either url or both title and company are required');
    });

    it('should throw when only title provided', () => {
      expect(() => generateJobId({ title: 'Engineer' })).toThrow();
    });

    it('should throw when only company provided', () => {
      expect(() => generateJobId({ company: 'Acme' })).toThrow();
    });
  });
});

describe('extractDatePosted', () => {
  it('should extract ISO date format', () => {
    const jd = 'Posted: 2025-01-15. We are looking for...';
    expect(extractDatePosted(jd)).toBe('2025-01-15');
  });

  it('should extract "Posted X days ago" format with correct date arithmetic', () => {
    const jd = 'Posted 5 days ago. We are looking for...';
    const result = extractDatePosted(jd);
    // Verify actual date calculation using UTC
    const expected = new Date();
    expected.setUTCDate(expected.getUTCDate() - 5);
    expect(result).toBe(expected.toISOString().split('T')[0]);
  });

  it('should extract "Posted on Month Day, Year" format', () => {
    const jd = 'Posted on January 15, 2025. We are looking for...';
    expect(extractDatePosted(jd)).toBe('2025-01-15');
  });

  it('should extract "Date posted: Month Day, Year" format', () => {
    const jd = 'Date posted: December 3, 2024. Great opportunity...';
    expect(extractDatePosted(jd)).toBe('2024-12-03');
  });

  it('should return undefined when no date found', () => {
    const jd = 'We are looking for a talented engineer...';
    expect(extractDatePosted(jd)).toBeUndefined();
  });

  it('should handle "Posted today" format', () => {
    const jd = 'Posted today. Exciting opportunity...';
    const result = extractDatePosted(jd);
    // Should return today's date
    const today = new Date().toISOString().split('T')[0];
    expect(result).toBe(today);
  });

  it('should be case insensitive', () => {
    const jd = 'POSTED ON JANUARY 15, 2025. Great role...';
    expect(extractDatePosted(jd)).toBe('2025-01-15');
  });
});

describe('normalizeUrl', () => {
  it('should remove protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('example.com');
    expect(normalizeUrl('http://example.com')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(normalizeUrl('https://www.example.com')).toBe('example.com');
  });

  it('should lowercase', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Path')).toBe('example.com/path');
  });

  it('should remove trailing slash', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('example.com/path');
  });

  it('should keep query params', () => {
    expect(normalizeUrl('https://example.com/job?id=123')).toBe('example.com/job?id=123');
  });

  it('should remove hash fragments', () => {
    expect(normalizeUrl('https://example.com/job#apply')).toBe('example.com/job');
  });
});

describe('normalizeCompanyAndTitle', () => {
  it('should lowercase', () => {
    expect(normalizeCompanyAndTitle('ACME INC')).toBe('acme inc');
  });

  it('should trim', () => {
    expect(normalizeCompanyAndTitle('  Company  ')).toBe('company');
  });

  it('should collapse whitespace', () => {
    expect(normalizeCompanyAndTitle('Acme   Inc')).toBe('acme inc');
  });

  it('should handle tabs and newlines', () => {
    expect(normalizeCompanyAndTitle('Acme\t\nInc')).toBe('acme inc');
  });
});
