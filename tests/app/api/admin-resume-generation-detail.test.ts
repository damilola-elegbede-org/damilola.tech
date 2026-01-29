import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}));

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock admin auth
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_session',
}));

describe('admin resume-generation detail API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    mockCookieStore.get.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validBlobUrl = 'https://abc123.public.blob.vercel-storage.com/damilola.tech/resume-generations/production/job1.json';
  const encodedBlobUrl = encodeURIComponent(validBlobUrl);

  const mockV2LogData = {
    version: 2,
    jobId: 'job-abc123',
    jobIdentifier: { type: 'url' as const, url: 'https://example.com/job' },
    environment: 'production',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-20T14:30:00Z',
    inputType: 'url' as const,
    extractedUrl: 'https://example.com/job',
    companyName: 'Acme Corp',
    roleTitle: 'Senior Software Engineer',
    jobDescriptionFull: 'We are looking for...',
    estimatedCompatibility: {
      before: 65,
      after: 85,
      breakdown: {
        keywordRelevance: 32,
        skillsQuality: 20,
        experienceAlignment: 18,
        formatParseability: 15,
      },
    },
    changesAccepted: [],
    changesRejected: [],
    gapsIdentified: [],
    generationId: 'gen-xyz789',
    pdfUrl: 'https://blob.vercel-storage.com/resume.pdf',
    optimizedResumeJson: {},
    generationHistory: [],
    applicationStatus: 'draft' as const,
  };

  describe('GET - authentication', () => {
    it('returns 401 when no admin token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 401 when admin token is invalid', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET - URL validation (SSRF protection)', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('accepts valid public blob URL', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
    });

    it('accepts valid blob.vercel-storage.com URL', async () => {
      const blobUrl = 'https://xyz456.blob.vercel-storage.com/damilola.tech/resume-generations/production/job2.json';
      const encodedUrl = encodeURIComponent(blobUrl);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedUrl }) });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(blobUrl);
    });

    it('rejects non-HTTPS URL', async () => {
      const invalidUrl = 'http://abc123.public.blob.vercel-storage.com/data.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid blob URL');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] Invalid blob URL rejected:',
        invalidUrl
      );

      consoleSpy.mockRestore();
    });

    it('rejects URL from unauthorized domain', async () => {
      const invalidUrl = 'https://malicious.com/data.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid blob URL');
      expect(global.fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('rejects malformed URL', async () => {
      const invalidUrl = 'not-a-valid-url';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid blob URL');
      expect(global.fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('GET - success cases', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns generation detail with valid URL-encoded blob ID', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockV2LogData);
      expect(global.fetch).toHaveBeenCalledWith(validBlobUrl);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] GET request for:',
        validBlobUrl
      );

      consoleSpy.mockRestore();
    });

    it('handles V1 log format', async () => {
      const v1LogData = {
        version: 1,
        generationId: 'gen-old123',
        environment: 'production',
        createdAt: '2026-01-10T08:00:00Z',
        inputType: 'text' as const,
        companyName: 'Tech Inc',
        roleTitle: 'Product Manager',
        jobDescriptionFull: 'Looking for a PM...',
        estimatedCompatibility: {
          before: 70,
          after: 88,
          breakdown: {
            keywordRelevance: 35,
            skillsQuality: 22,
            experienceAlignment: 16,
            formatParseability: 15,
          },
        },
        changesAccepted: [],
        changesRejected: [],
        gapsIdentified: [],
        pdfUrl: 'https://blob.vercel-storage.com/resume2.pdf',
        optimizedResumeJson: {},
        applicationStatus: 'draft' as const,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => v1LogData,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(v1LogData);
    });
  });

  describe('GET - error cases', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns 404 when blob does not exist', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Generation not found');
    });

    it('returns 500 when blob fetch fails', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch generation');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] Error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when blob JSON parsing fails', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch generation');

      consoleSpy.mockRestore();
    });
  });

  describe('PATCH - authentication', () => {
    it('returns 401 when no admin token provided', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 401 when admin token is invalid', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(false);

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('PATCH - URL validation', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('rejects invalid blob URL', async () => {
      const invalidUrl = 'https://malicious.com/data.json';
      const encodedUrl = encodeURIComponent(invalidUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid blob URL');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('PATCH - validation', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('rejects invalid application status', async () => {
      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'invalid-status' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid application status');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects invalid appliedDate format', async () => {
      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ appliedDate: 'not-a-date' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid applied date');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rejects non-string appliedDate', async () => {
      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ appliedDate: 12345 }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid applied date');
    });

    it('rejects non-string notes', async () => {
      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 12345 }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid notes');
    });
  });

  describe('PATCH - success cases', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('updates applicationStatus', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      const updatedBlobUrl = 'https://abc123.public.blob.vercel-storage.com/updated.json';
      mockPut.mockResolvedValueOnce({ url: updatedBlobUrl });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.url).toBe(updatedBlobUrl);
      expect(data.data.applicationStatus).toBe('applied');

      expect(mockPut).toHaveBeenCalledWith(
        'damilola.tech/resume-generations/production/job1.json',
        expect.stringContaining('"applicationStatus": "applied"'),
        {
          access: 'public',
          contentType: 'application/json',
          allowOverwrite: true,
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] Saving updated data to:',
        'damilola.tech/resume-generations/production/job1.json'
      );

      consoleSpy.mockRestore();
    });

    it('updates appliedDate', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockResolvedValueOnce({ url: validBlobUrl });

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const appliedDate = '2026-01-25T10:00:00Z';
      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ appliedDate }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.appliedDate).toBe(appliedDate);

      const putCall = mockPut.mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);
      expect(savedData.appliedDate).toBe(appliedDate);
    });

    it('updates notes', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockResolvedValueOnce({ url: validBlobUrl });

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const notes = 'Great company culture';
      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.notes).toBe(notes);

      const putCall = mockPut.mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);
      expect(savedData.notes).toBe(notes);
    });

    it('updates multiple fields simultaneously', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockResolvedValueOnce({ url: validBlobUrl });

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const updates = {
        applicationStatus: 'interview' as const,
        appliedDate: '2026-01-25T10:00:00Z',
        notes: 'Phone screening scheduled',
      };

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.applicationStatus).toBe('interview');
      expect(data.data.appliedDate).toBe('2026-01-25T10:00:00Z');
      expect(data.data.notes).toBe('Phone screening scheduled');

      const putCall = mockPut.mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);
      expect(savedData.applicationStatus).toBe('interview');
      expect(savedData.appliedDate).toBe('2026-01-25T10:00:00Z');
      expect(savedData.notes).toBe('Phone screening scheduled');
    });

    it('preserves other fields when updating', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockResolvedValueOnce({ url: validBlobUrl });

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.jobId).toBe(mockV2LogData.jobId);
      expect(data.data.companyName).toBe(mockV2LogData.companyName);
      expect(data.data.roleTitle).toBe(mockV2LogData.roleTitle);
      expect(data.data.version).toBe(2);
    });

    it('accepts all valid application statuses', async () => {
      const statuses: Array<'draft' | 'applied' | 'interview' | 'offer' | 'rejected'> = [
        'draft',
        'applied',
        'interview',
        'offer',
        'rejected',
      ];

      for (const status of statuses) {
        vi.mocked(global.fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockV2LogData,
        } as unknown as Response);

        mockPut.mockResolvedValueOnce({ url: validBlobUrl });

        const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

        const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
          method: 'PATCH',
          body: JSON.stringify({ applicationStatus: status }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.applicationStatus).toBe(status);

        vi.clearAllMocks();
        vi.resetModules();
      }
    });

    it('formats JSON output with proper indentation', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockResolvedValueOnce({ url: validBlobUrl });

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Test' }),
      });
      await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });

      const putCall = mockPut.mock.calls[0];
      const savedJson = putCall[1] as string;

      // Verify it's formatted with 2-space indentation
      expect(savedJson).toContain('\n');
      expect(savedJson).toMatch(/^{\n  "version"/);
    });
  });

  describe('PATCH - blob path validation', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('rejects blob path that does not start with expected prefix', async () => {
      const invalidPathUrl = 'https://abc123.public.blob.vercel-storage.com/malicious/path/data.json';
      const encodedUrl = encodeURIComponent(invalidPathUrl);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedUrl }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid blob path');
      expect(mockPut).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] Invalid blob path rejected:',
        'malicious/path/data.json'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('PATCH - error cases', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(true);
    });

    it('returns 404 when blob does not exist', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Generation not found');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 500 when blob fetch fails', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update generation');
      expect(mockPut).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[admin/resume-generations/[id]] Error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when blob upload fails', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockV2LogData,
      } as unknown as Response);

      mockPut.mockRejectedValueOnce(new Error('Upload failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { PATCH } = await import('@/app/api/admin/resume-generations/[id]/route');

      const request = new Request(`http://localhost/api/admin/resume-generations/${encodedBlobUrl}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus: 'applied' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: encodedBlobUrl }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update generation');

      consoleSpy.mockRestore();
    });
  });
});
