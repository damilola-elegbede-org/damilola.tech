import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = global.fetch;

// Mock admin-auth
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: vi.fn(),
  ADMIN_COOKIE_NAME: 'admin_session',
}));

// Mock audit-server
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: vi.fn(),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('admin fit-assessment detail API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET - authentication', () => {
    it('returns 401 when no auth token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const request = new Request('http://localhost/api/admin/fit-assessments/test-id');
      const params = Promise.resolve({ id: 'test-id' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 401 when token verification fails', async () => {
      const { verifyToken } = await import('@/lib/admin-auth');

      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      vi.mocked(verifyToken).mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const request = new Request('http://localhost/api/admin/fit-assessments/test-id');
      const params = Promise.resolve({ id: 'test-id' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET - URL validation', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('returns 400 for invalid blob URL (non-HTTPS)', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const invalidUrl = encodeURIComponent('http://blob.vercel-storage.com/file.json');
      const request = new Request(`http://localhost/api/admin/fit-assessments/${invalidUrl}`);
      const params = Promise.resolve({ id: invalidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid blob URL (wrong domain)', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const invalidUrl = encodeURIComponent('https://evil.com/file.json');
      const request = new Request(`http://localhost/api/admin/fit-assessments/${invalidUrl}`);
      const params = Promise.resolve({ id: invalidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid blob URL (wrong path)', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const invalidUrl = encodeURIComponent(
        'https://abc123.blob.vercel-storage.com/wrong-path/file.json'
      );
      const request = new Request(`http://localhost/api/admin/fit-assessments/${invalidUrl}`);
      const params = Promise.resolve({ id: invalidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed URL', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const invalidUrl = encodeURIComponent('not-a-url');
      const request = new Request(`http://localhost/api/admin/fit-assessments/${invalidUrl}`);
      const params = Promise.resolve({ id: invalidUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('accepts valid blob URL', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const validUrl =
        'https://abc123.blob.vercel-storage.com/damilola.tech/fit-assessments/production/test.json';
      const encodedUrl = encodeURIComponent(validUrl);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'test-assessment' }),
      } as unknown as Response);

      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(validUrl);
    });
  });

  describe('GET - assessment fetching', () => {
    const validBlobUrl =
      'https://abc123.blob.vercel-storage.com/damilola.tech/fit-assessments/production/test-assessment.json';

    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('returns assessment data with valid auth and URL', async () => {
      const assessmentData = {
        id: 'test-assessment-123',
        roleTitle: 'Senior Software Engineer',
        companyName: 'Tech Corp',
        overallFit: 'strong',
        timestamp: '2026-01-28T10:00:00.000Z',
        analysis: {
          technical: { score: 9, evidence: 'Strong backend experience' },
          cultural: { score: 8, evidence: 'Good team fit' },
        },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => assessmentData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(assessmentData);
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
    });

    it('returns 404 when assessment not found', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Assessment not found');
    });

    it('returns 404 when blob fetch fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Assessment not found');
    });

    it('handles URL-encoded blob URL correctly', async () => {
      const assessmentData = { id: 'test', roleTitle: 'Engineer' };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => assessmentData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      // Double-encoded URL (simulating Next.js routing)
      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      // Should decode URL before fetching
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
    });
  });

  describe('GET - audit logging', () => {
    const validBlobUrl =
      'https://abc123.blob.vercel-storage.com/damilola.tech/fit-assessments/production/test-assessment.json';

    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('logs admin assessment view event', async () => {
      const { logAdminEvent } = await import('@/lib/audit-server');
      const { getClientIp } = await import('@/lib/rate-limit');

      const assessmentData = { id: 'test-assessment', roleTitle: 'Engineer' };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => assessmentData,
      } as unknown as Response);

      vi.mocked(getClientIp).mockReturnValue('192.168.1.100');

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      await GET(request, { params });

      expect(logAdminEvent).toHaveBeenCalledWith(
        'admin_assessment_viewed',
        { assessmentUrl: validBlobUrl },
        '192.168.1.100'
      );
    });

    it('does not log event when assessment not found', async () => {
      const { logAdminEvent } = await import('@/lib/audit-server');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });
      await GET(request, { params });

      expect(logAdminEvent).not.toHaveBeenCalled();
    });
  });

  describe('GET - error handling', () => {
    const validBlobUrl =
      'https://abc123.blob.vercel-storage.com/damilola.tech/fit-assessments/production/test-assessment.json';

    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('returns 500 when fetch throws error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch assessment');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/fit-assessments/[id]] Error fetching assessment:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when JSON parsing fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const encodedUrl = encodeURIComponent(validBlobUrl);
      const request = new Request(`http://localhost/api/admin/fit-assessments/${encodedUrl}`);
      const params = Promise.resolve({ id: encodedUrl });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch assessment');

      consoleSpy.mockRestore();
    });

    it('returns 500 when params promise rejects', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const request = new Request('http://localhost/api/admin/fit-assessments/test-id');
      const params = Promise.reject(new Error('Params error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch assessment');

      consoleSpy.mockRestore();
    });
  });

  describe('GET - SSRF protection', () => {
    beforeEach(async () => {
      const { verifyToken } = await import('@/lib/admin-auth');
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      vi.mocked(verifyToken).mockResolvedValue(true);
    });

    it('blocks localhost URLs', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const maliciousUrl = encodeURIComponent('https://localhost/etc/passwd');
      const request = new Request(`http://localhost/api/admin/fit-assessments/${maliciousUrl}`);
      const params = Promise.resolve({ id: maliciousUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('blocks internal IP addresses', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const maliciousUrl = encodeURIComponent('https://192.168.1.1/secret');
      const request = new Request(`http://localhost/api/admin/fit-assessments/${maliciousUrl}`);
      const params = Promise.resolve({ id: maliciousUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('blocks URLs with wrong path prefix', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const maliciousUrl = encodeURIComponent(
        'https://abc123.blob.vercel-storage.com/other-app/data.json'
      );
      const request = new Request(`http://localhost/api/admin/fit-assessments/${maliciousUrl}`);
      const params = Promise.resolve({ id: maliciousUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('only allows Vercel Blob storage domain', async () => {
      const { GET } = await import('@/app/api/admin/fit-assessments/[id]/route');

      const maliciousUrl = encodeURIComponent(
        'https://blob.vercel-storage.com.evil.com/damilola.tech/fit-assessments/test.json'
      );
      const request = new Request(`http://localhost/api/admin/fit-assessments/${maliciousUrl}`);
      const params = Promise.resolve({ id: maliciousUrl });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid assessment URL');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
