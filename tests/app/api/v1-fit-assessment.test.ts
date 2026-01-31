/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock system prompt
vi.mock('@/lib/generated/system-prompt', () => ({
  FIT_ASSESSMENT_PROMPT: 'Mock fit assessment system prompt',
}));

vi.mock('@/lib/system-prompt', () => ({
  getFitAssessmentPrompt: vi.fn().mockResolvedValue('Fallback prompt'),
}));

// Mock usage logger
vi.mock('@/lib/usage-logger', () => ({
  logUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock api-audit
const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/fit-assessment API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description text' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/fit-assessment', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 400 for missing input', async () => {
      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('required');
    });

    it('returns 400 for empty input', async () => {
      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: '' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('runs assessment with valid text input', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '## Fit Assessment\n\nStrong match...' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 800,
          cache_creation_input_tokens: 0,
        },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({
          input: 'Senior Software Engineer at Tech Corp. Requirements: 5+ years experience...',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.assessment).toContain('Fit Assessment');
    });

    it('returns JSON (not streaming)', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Assessment result' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description...' }),
      });
      const response = await POST(request);

      // Response should be JSON, not a stream
      expect(response.headers.get('content-type')).toContain('application/json');
      const data = await response.json();
      expect(data.data.assessment).toBeDefined();
    });

    it('includes usage information in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Assessment' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 800,
          cache_creation_input_tokens: 100,
        },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description...' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.usage).toBeDefined();
      expect(data.data.usage.inputTokens).toBe(1000);
      expect(data.data.usage.outputTokens).toBe(500);
      expect(data.data.usage.cacheReadTokens).toBe(800);
    });

    it('includes model info in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Assessment' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description...' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.model).toBe('claude-sonnet-4-20250514');
    });

    it('accepts "prompt" field as alternative to "input"', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Assessment' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 1000, output_tokens: 500 },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Job description...' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for URL that cannot be fetched', async () => {
      // Mock fetch to fail after DNS lookup passes
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'https://8.8.8.8/posting/123' }), // Valid public IP to pass SSRF check
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Could not fetch');
    });

    it('returns 400 for blocked localhost URLs (SSRF protection)', async () => {
      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'http://localhost:3000/admin' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('not allowed');
    });

    it('returns 400 for private IP URLs (SSRF protection)', async () => {
      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'http://192.168.1.1/internal' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('returns 400 for request body too large', async () => {
      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        headers: {
          'content-length': '60000', // 60KB, over 50KB limit
        },
        body: JSON.stringify({ input: 'x'.repeat(55000) }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('too large');
    });

    it('handles API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description...' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).toContain('AI service error');

      consoleSpy.mockRestore();
    });

    it('returns 400 when URL content is too short', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('<html><body>Short</body></html>') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as Response);

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'https://example.com/short-page' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Content too short');
    });

    it('logs api_fit_assessment audit event with correct parameters', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Assessment result' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 800,
        },
      });

      const { POST } = await import('@/app/api/v1/fit-assessment/route');
      const request = new Request('http://localhost/api/v1/fit-assessment', {
        method: 'POST',
        body: JSON.stringify({ input: 'Job description text...' }),
      });
      await POST(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_fit_assessment',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          sessionId: expect.stringMatching(/^fit-assessment-api-/),
          inputTokens: 1000,
          outputTokens: 500,
          durationMs: expect.any(Number),
        }),
        '127.0.0.1'
      );
    });
  });
});
