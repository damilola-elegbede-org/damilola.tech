import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the system prompt modules first
vi.mock('@/lib/generated/system-prompt', () => ({
  FIT_ASSESSMENT_PROMPT: 'Test system prompt',
}));

vi.mock('@/lib/system-prompt', () => ({
  getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
      };
    },
  };

  return {
    default: class MockAnthropic {
      messages = {
        stream: vi.fn().mockReturnValue(mockStream),
      };
    },
  };
});

// Store original fetch
const originalFetch = global.fetch;

describe('fit-assessment API route', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module cache to get fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('URL detection', () => {
    it('should detect HTTP URLs', async () => {
      // Re-mock after resetModules
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      // Mock fetch for URL
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><body><h1>Job Title</h1><p>This is a job description with enough content to be valid. '.repeat(
              10
            ) + '</p></body></html>'
          ),
      });
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'http://example.com/job' }),
      });

      await POST(request);

      // Should have tried to fetch the URL
      expect(fetchMock).toHaveBeenCalledWith(
        'http://example.com/job',
        expect.objectContaining({
          headers: expect.objectContaining({ 'User-Agent': expect.any(String) }),
        })
      );
    });

    it('should detect HTTPS URLs', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><body><h1>Job Title</h1><p>This is a job description with enough content to be valid. '.repeat(
              10
            ) + '</p></body></html>'
          ),
      });
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://greenhouse.io/jobs/12345' }),
      });

      await POST(request);

      expect(fetchMock).toHaveBeenCalledWith('https://greenhouse.io/jobs/12345', expect.any(Object));
    });

    it('should treat non-URL text as job description', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Engineering Manager at a tech company' }),
      });

      await POST(request);

      // Should NOT have tried to fetch (text is not a URL)
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('URL fetch error handling', () => {
    it('should return error when URL returns HTTP 403', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://blocked-site.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not access the job posting');
      expect(data.error).toContain('403');
      expect(data.error).toContain('copy and paste');
    });

    it('should return error when URL returns HTTP 404', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://example.com/deleted-job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not access the job posting');
      expect(data.error).toContain('404');
    });

    it('should return error when network request fails', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://unreachable-site.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not fetch the job posting');
      expect(data.error).toContain('copy and paste');
    });

    it('should return error when extracted content is too short', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body><p>Short</p></body></html>'),
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://login-wall-site.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not extract job description');
      expect(data.error).toContain('may require login');
    });
  });

  describe('HTML text extraction', () => {
    it('should extract text from HTML and strip tags', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(`
            <html>
              <head><title>Job Posting</title></head>
              <body>
                <h1>Senior Software Engineer</h1>
                <p>We are looking for an experienced engineer to join our team.</p>
                <ul>
                  <li>5+ years experience</li>
                  <li>Strong TypeScript skills</li>
                </ul>
              </body>
            </html>
          `),
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://jobs.example.com/123' }),
      });

      const response = await POST(request);

      // The response should be streaming, meaning the fetch succeeded and proceeded to Claude
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    it('should handle HTML entities', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><body><p>This role requires &amp; demands excellence. Salary range: $100k&ndash;$150k. This is a great opportunity for growth and development in our company.</p></body></html>'
          ),
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'https://jobs.example.com/456' }),
      });

      const response = await POST(request);

      // Should succeed (streaming response)
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });
  });

  describe('existing functionality preserved', () => {
    it('should still handle direct text job descriptions', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      // Don't mock fetch for this test - it should not be called
      global.fetch = originalFetch;

      const { POST } = await import('@/app/api/fit-assessment/route');

      const jobDescription =
        'We are looking for an Engineering Manager to lead our platform team. 5+ years experience required.';

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: jobDescription }),
      });

      const response = await POST(request);

      // Should return streaming response (success)
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    it('should reject empty job descriptions', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should reject overly long job descriptions', async () => {
      vi.doMock('@/lib/generated/system-prompt', () => ({
        FIT_ASSESSMENT_PROMPT: 'Test system prompt',
      }));
      vi.doMock('@/lib/system-prompt', () => ({
        getFitAssessmentPrompt: vi.fn().mockResolvedValue('Test system prompt'),
      }));
      vi.doMock('@anthropic-ai/sdk', () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: '# Fit Assessment: Test Role' },
            };
          },
        };
        return {
          default: class MockAnthropic {
            messages = { stream: vi.fn().mockReturnValue(mockStream) };
          },
        };
      });

      const { POST } = await import('@/app/api/fit-assessment/route');

      const longDescription = 'x'.repeat(15000);

      const request = new Request('http://localhost/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: longDescription }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('too long');
    });
  });
});
