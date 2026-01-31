/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock api-audit
const mockLogApiAccess = vi.fn();
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/resume-generator API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLogApiAccess.mockResolvedValue(undefined);
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

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 with disabled API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key is disabled' } },
          { status: 403 }
        )
      );

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 with revoked API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key has been revoked' } },
          { status: 403 }
        )
      );

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/resume-generator', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 501 Not Implemented', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'Test job' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(501);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_IMPLEMENTED');
    });

    it('includes helpful error message', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.error.message).toContain('Resume generation via API is not yet supported');
      expect(data.error.message).toContain('/api/v1/resume-generations');
    });

    it('logs API access audit event with attempted flag', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      await POST(request);

      expect(mockLogApiAccess).toHaveBeenCalledWith(
        'api_resume_generator_attempted',
        mockValidApiKey.apiKey,
        {
          attempted: true,
          result: 'not_implemented',
        },
        '127.0.0.1'
      );
    });

    it('continues even if audit logging fails', async () => {
      mockLogApiAccess.mockRejectedValue(new Error('Audit logging failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      // Should still return 501 even if audit logging fails
      expect(response.status).toBe(501);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_IMPLEMENTED');

      consoleWarnSpy.mockRestore();
    });

    it('works with Authorization header', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer dk_live_testkey123',
        },
      });
      const response = await POST(request);

      expect(response.status).toBe(501);
      expect(mockRequireApiKey).toHaveBeenCalledWith(request);
    });

    it('works with x-api-key header', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: {
          'x-api-key': 'dk_live_testkey456',
        },
      });
      const response = await POST(request);

      expect(response.status).toBe(501);
      expect(mockRequireApiKey).toHaveBeenCalledWith(request);
    });

    it('handles empty request body', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBe(501);
    });

    it('handles request with body', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: 'Senior Software Engineer',
          company: 'Tech Corp',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(501);
    });

    it('returns proper error response format', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });

    it('uses correct content-type header', async () => {
      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const request = new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });
});
