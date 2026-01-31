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

// APIError class for error handling tests
class MockAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
    static APIError = MockAPIError;
  }
  return {
    default: MockAnthropic,
    APIError: MockAPIError,
  };
});

// Mock system prompt
vi.mock('@/lib/generated/system-prompt', () => ({
  CHATBOT_SYSTEM_PROMPT: 'Mock chatbot system prompt',
}));

vi.mock('@/lib/system-prompt', () => ({
  getFullSystemPrompt: vi.fn().mockResolvedValue('Fallback prompt'),
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

describe('v1/chat API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/chat', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 400 for missing messages', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty messages array', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
      });
      const response = await POST(request);

      // Empty array is now properly validated and returns 400
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid message format', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'invalid', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('returns 400 for message content too long', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'x'.repeat(2001) }], // Over 2000 char limit
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('returns JSON response (not streaming)', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 0,
        },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);

      // Response should be JSON, not a stream
      expect(response.headers.get('content-type')).toContain('application/json');
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBeDefined();
    });

    it('returns assistant message in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I am Damilola, a technology executive.' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
        },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Who are you?' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.message.role).toBe('assistant');
      expect(data.data.message.content).toBe('I am Damilola, a technology executive.');
    });

    it('includes usage information in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 1000,
          output_tokens: 50,
          cache_read_input_tokens: 800,
          cache_creation_input_tokens: 100,
        },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.usage).toBeDefined();
      expect(data.data.usage.inputTokens).toBe(1000);
      expect(data.data.usage.outputTokens).toBe(50);
      expect(data.data.usage.cacheReadTokens).toBe(800);
    });

    it('includes model info in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.model).toBe('claude-sonnet-4-20250514');
    });

    it('supports multi-turn conversations', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I previously said hello!' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 200, output_tokens: 30 },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hello! How can I help?' },
            { role: 'user', content: 'What did you just say?' },
          ],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for too many messages', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const messages = Array.from({ length: 201 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('returns 400 for request body too large', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'content-length': '600000', // 600KB, over 500KB limit
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('too large');
    });

    it('returns 400 for invalid JSON', async () => {
      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: 'not valid json',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid JSON');
    });

    it('handles API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).toContain('Chat service error');

      consoleSpy.mockRestore();
    });

    it('returns 429 on rate limit errors', async () => {
      mockCreate.mockRejectedValue(new MockAPIError('Rate limited', 429));

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error.code).toBe('RATE_LIMITED');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('escapes XML in user messages for safety', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: '<script>alert("xss")</script>' }],
        }),
      });
      await POST(request);

      // Check that the message was escaped when sent to the API
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('&lt;script&gt;'),
            }),
          ]),
        })
      );
    });

    it('wraps user messages in XML tags', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello world' }],
        }),
      });
      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: '<user_message>Hello world</user_message>',
            }),
          ]),
        })
      );
    });

    it('logs api_chat audit event with correct parameters', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 50,
        },
      });

      const { POST } = await import('@/app/api/v1/chat/route');
      const request = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      await POST(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_chat',
        mockValidApiKey.apiKey,
        expect.objectContaining({
          sessionId: expect.stringMatching(/^chat-api-/),
          messageCount: 1,
          inputTokens: 100,
          outputTokens: 20,
          durationMs: expect.any(Number),
        }),
        '127.0.0.1'
      );
    });
  });
});
