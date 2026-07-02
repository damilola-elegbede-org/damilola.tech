/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;

describe('JobDescriptionInputError failure modes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  it('assigns fetch_timeout when fetch throws a TimeoutError', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    const timeoutErr = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    vi.mocked(global.fetch).mockRejectedValue(timeoutErr);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('fetch_timeout');
  });

  it('assigns fetch_timeout when fetch throws an AbortError', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(global.fetch).mockRejectedValue(abortErr);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('fetch_timeout');
  });

  it('assigns posting_404 when fetch returns HTTP 404', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('posting_404');
  });

  it('assigns posting_404 when fetch returns HTTP 410', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 410,
      headers: new Headers(),
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('posting_404');
  });

  it('assigns ua_blocked when fetch returns HTTP 403', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('ua_blocked');
  });

  it('assigns ua_blocked when fetch returns HTTP 429', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('ua_blocked');
  });

  it('assigns empty_body_spa when fetched content is too short after extraction', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('<html><body></body></html>') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('empty_body_spa');
  });

  it('assigns invalid_url when URL validation fails (blocked host)', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '169.254.169.254', family: 4 }]),
    }));

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://internal.corp/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('invalid_url');
  });

  it('assigns network_error when fetch throws ENOTFOUND', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    const networkErr = Object.assign(new Error('getaddrinfo ENOTFOUND jobs.example.com'), { code: 'ENOTFOUND' });
    vi.mocked(global.fetch).mockRejectedValue(networkErr);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('network_error');
  });

  it('assigns not_jd_content when content is long enough but not a job description', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    const longNonJdContent = 'This is a general article about cooking recipes and kitchen tips. '.repeat(5);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(`<html><body><p>${longNonJdContent}</p></body></html>`) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    const err = await resolveJobDescriptionInput('https://jobs.example.com/job', 'Bot/1.0').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobDescriptionInputError);
    expect((err as InstanceType<typeof JobDescriptionInputError>).failureMode).toBe('not_jd_content');
  });
});

describe('job-description-input SSRF handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  it('binds fetches to the resolved IPv4 address and preserves the original host header', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('<html><body><h1>Senior Engineering Manager</h1><p>Responsibilities include team leadership and qualifications include cloud skills.</p></body></html>') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');

    const result = await resolveJobDescriptionInput(
      'https://jobs.example.com/roles/123',
      'UnitTestBot/1.0'
    );

    expect(result.inputType).toBe('url');
    expect(result.extractedUrl).toBe('https://jobs.example.com/roles/123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://93.184.216.34/roles/123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Host: 'jobs.example.com',
          'User-Agent': 'UnitTestBot/1.0',
        }),
      })
    );
  });

  it('rejects DNS answers that resolve to private IP space', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '169.254.169.254', family: 4 }]),
    }));

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    await expect(
      resolveJobDescriptionInput('https://rebind.example.com/job', 'UnitTestBot/1.0')
    ).rejects.toEqual(
      expect.objectContaining<{ message: string }>({
        message: expect.stringContaining('not allowed'),
      })
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('re-validates redirects and fetches the redirect target via its resolved IP', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn(async (hostname: string, options?: { all?: boolean }) => {
        const records = hostname === 'jobs.example.com'
          ? [{ address: '93.184.216.34', family: 4 }]
          : [{ address: '93.184.216.35', family: 4 }];
        return options?.all ? records : records[0];
      }),
    }));

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'https://redirect.example.com/job' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('<html><body><p>Job description with responsibilities and requirements for the role. This posting requires deep experience leading engineering teams, cloud migration programs, cross-functional execution, stakeholder management, and strong communication across product, platform, and operations.</p></body></html>') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as Response);

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');

    await resolveJobDescriptionInput('https://jobs.example.com/job', 'UnitTestBot/1.0');

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://93.184.216.34/job',
      expect.objectContaining({ headers: expect.objectContaining({ Host: 'jobs.example.com' }) })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://93.184.216.35/job',
      expect.objectContaining({ headers: expect.objectContaining({ Host: 'redirect.example.com' }) })
    );
  });
});
