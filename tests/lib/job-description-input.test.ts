/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;

// Full JD HTML returned by the headless fallback (>500 chars, has JD keywords)
const FULL_JD_HTML = `<html><body>
  <h1>Senior Engineering Manager</h1>
  <p>Responsibilities include leading distributed systems teams across cloud infrastructure.</p>
  <p>Qualifications: 8+ years of experience in backend engineering, strong skills in TypeScript,
  Go, and Kubernetes. Requirements include proven experience with cross-functional stakeholder
  management. This position involves defining roadmap strategy, managing career growth,
  and driving operational excellence. Duties encompass hiring, mentorship, and technical leadership.
  About the role: you will own the platform reliability and scalability goals. Apply now.</p>
</body></html>`;

// Mock puppeteer-core browser/page
const mockPageContent = vi.fn().mockResolvedValue(FULL_JD_HTML);
const mockPageGoto = vi.fn().mockResolvedValue(null);
const mockPageSetUserAgent = vi.fn().mockResolvedValue(undefined);
const mockPageSetExtraHTTPHeaders = vi.fn().mockResolvedValue(undefined);
const mockBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockNewPage = vi.fn().mockResolvedValue({
  setUserAgent: mockPageSetUserAgent,
  setExtraHTTPHeaders: mockPageSetExtraHTTPHeaders,
  goto: mockPageGoto,
  content: mockPageContent,
});
const mockPuppeteerLaunch = vi.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockBrowserClose,
});

// Sparse HTML returned by plain fetch (SPA shell, <500 chars)
const SPARSE_HTML = '<html><body><div id="app"></div></body></html>';

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

  it('does not call the headless fallback when plain fetch returns sufficient content (>500 chars)', async () => {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));

    vi.doMock('puppeteer-core', () => ({
      launch: mockPuppeteerLaunch,
    }));

    vi.doMock('@sparticuz/chromium', () => ({
      default: {
        args: [],
        headless: true,
        defaultViewport: { width: 1280, height: 720 },
        executablePath: vi.fn().mockResolvedValue('/usr/bin/chromium'),
      },
    }));

    const richContent = 'Senior Engineering Manager. '.repeat(30) +
      ' Responsibilities include team leadership. Qualifications include cloud skills.';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(`<html><body><p>${richContent}</p></body></html>`) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');
    const result = await resolveJobDescriptionInput('https://jobs.example.com/roles/456', 'UnitTestBot/1.0');

    expect(result.inputType).toBe('url');
    // puppeteer should NOT have been invoked
    expect(mockPuppeteerLaunch).not.toHaveBeenCalled();
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

describe('job-description-input headless fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();

    // Reset puppeteer mock state between tests
    mockPuppeteerLaunch.mockClear();
    mockNewPage.mockClear();
    mockPageContent.mockClear();
    mockPageGoto.mockClear();
    mockPageSetUserAgent.mockClear();
    mockPageSetExtraHTTPHeaders.mockClear();
    mockBrowserClose.mockClear();

    // Restore defaults
    mockPageContent.mockResolvedValue(FULL_JD_HTML);
    mockPuppeteerLaunch.mockResolvedValue({
      newPage: mockNewPage,
      close: mockBrowserClose,
    });
    mockNewPage.mockResolvedValue({
      setUserAgent: mockPageSetUserAgent,
      setExtraHTTPHeaders: mockPageSetExtraHTTPHeaders,
      goto: mockPageGoto,
      content: mockPageContent,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  function mockDnsAndChromium() {
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
    }));
    vi.doMock('puppeteer-core', () => ({
      launch: mockPuppeteerLaunch,
    }));
    vi.doMock('@sparticuz/chromium', () => ({
      default: {
        args: [],
        headless: true,
        defaultViewport: { width: 1280, height: 720 },
        executablePath: vi.fn().mockResolvedValue('/usr/bin/chromium'),
      },
    }));
  }

  function mockSparseFetch() {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(SPARSE_HTML) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);
  }

  it('invokes the headless fallback when plain fetch returns <500 chars of extractable text', async () => {
    mockDnsAndChromium();
    mockSparseFetch();

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');
    const result = await resolveJobDescriptionInput(
      'https://jobs.example.com/workday/123',
      'UnitTestBot/1.0'
    );

    expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(1);
    expect(result.inputType).toBe('url');
    expect(result.text).toContain('Responsibilities');
  });

  it('headless fallback navigates to resolved IP and sets Host header to prevent DNS rebinding', async () => {
    mockDnsAndChromium();
    mockSparseFetch();

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');
    await resolveJobDescriptionInput('https://jobs.example.com/workday/ssrf', 'UnitTestBot/1.0');

    // page.goto must use the IP-pinned URL, not the original hostname
    expect(mockPageGoto).toHaveBeenCalledWith(
      'https://93.184.216.34/workday/ssrf',
      expect.objectContaining({ waitUntil: 'networkidle2' })
    );
    // Host header must preserve the original hostname for virtual hosting
    expect(mockPageSetExtraHTTPHeaders).toHaveBeenCalledWith({ Host: 'jobs.example.com' });
  });

  it('throws JobDescriptionInputError when both plain fetch and headless fallback return short content', async () => {
    mockDnsAndChromium();
    mockSparseFetch();

    // Headless also returns sparse content
    mockPageContent.mockResolvedValue(SPARSE_HTML);

    const { resolveJobDescriptionInput, JobDescriptionInputError } = await import('@/lib/job-description-input');

    await expect(
      resolveJobDescriptionInput('https://jobs.example.com/workday/456', 'UnitTestBot/1.0')
    ).rejects.toBeInstanceOf(JobDescriptionInputError);
  });

  it('does not call the headless fallback when plain fetch returns >500 chars with valid JD content', async () => {
    mockDnsAndChromium();

    const richHtml = `<html><body><p>${'Senior Engineering Manager. '.repeat(25)} Responsibilities include team leadership and project management. Qualifications include cloud skills.</p></body></html>`;
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(richHtml) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    const { resolveJobDescriptionInput } = await import('@/lib/job-description-input');
    const result = await resolveJobDescriptionInput(
      'https://jobs.example.com/standard/789',
      'UnitTestBot/1.0'
    );

    expect(result.inputType).toBe('url');
    expect(mockPuppeteerLaunch).not.toHaveBeenCalled();
  });
});
