import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}));

// Mock next/headers cookies
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock admin-auth module
const mockVerifyToken = vi.fn();
vi.mock('@/lib/admin-auth', () => ({
  verifyToken: mockVerifyToken,
  ADMIN_COOKIE_NAME: 'admin_token',
}));

// Mock audit-server module
const mockLogAdminEvent = vi.fn();
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: mockLogAdminEvent,
}));

// Mock rate-limit module
const mockGetClientIp = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: mockGetClientIp,
}));

describe('resume-generator/upload-pdf API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };

    // Default mocks
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    });
    mockVerifyToken.mockResolvedValue(true);
    mockLogAdminEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Helper to create a valid PDF file
  function createPdfFile(size: number = 1024, isValid: boolean = true): File {
    // Create buffer with PDF magic bytes or invalid content
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);

    if (isValid) {
      // PDF files start with %PDF
      view[0] = 0x25; // %
      view[1] = 0x50; // P
      view[2] = 0x44; // D
      view[3] = 0x46; // F
    } else {
      // Invalid magic bytes
      view[0] = 0x00;
      view[1] = 0x00;
      view[2] = 0x00;
      view[3] = 0x00;
    }

    const file = new File([buffer], 'resume.pdf', { type: 'application/pdf' });

    // Mock arrayBuffer method for JSDOM environment
    file.arrayBuffer = async () => buffer;

    // Store size for validation
    Object.defineProperty(file, 'size', { value: size, writable: false });

    return file;
  }

  // Helper to create a mock request with formData
  function createMockRequest(overrides: {
    pdf?: File | null;
    companyName?: string | null;
    roleTitle?: string | null;
  } = {}): Request {
    const formData = new Map<string, File | string | null>();

    if (overrides.pdf !== undefined && overrides.pdf !== null) {
      formData.set('pdf', overrides.pdf);
    } else if (overrides.pdf === undefined) {
      formData.set('pdf', createPdfFile());
    }

    if (overrides.companyName !== undefined && overrides.companyName !== null) {
      formData.set('companyName', overrides.companyName);
    } else if (overrides.companyName === undefined) {
      formData.set('companyName', 'Test Company');
    }

    if (overrides.roleTitle !== undefined && overrides.roleTitle !== null) {
      formData.set('roleTitle', overrides.roleTitle);
    } else if (overrides.roleTitle === undefined) {
      formData.set('roleTitle', 'Senior Engineer');
    }

    const mockRequest = new Request('http://localhost/api/resume-generator/upload-pdf', {
      method: 'POST',
    });

    // Mock the formData() method
    mockRequest.formData = vi.fn().mockResolvedValue({
      get: (key: string) => formData.get(key),
      has: (key: string) => formData.has(key),
      getAll: (key: string) => {
        const value = formData.get(key);
        return value !== undefined ? [value] : [];
      },
    });

    return mockRequest;
  }

  describe('authentication', () => {
    it('returns 401 when no admin token is provided', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 401 when admin token is invalid', async () => {
      mockVerifyToken.mockResolvedValue(false);

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('valid uploads', () => {
    it('uploads valid PDF successfully', async () => {
      process.env.VERCEL = 'true';
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/resume.pdf',
        pathname: 'damilola.tech/resume/generated/production/test-company-senior-engineer-2026-01-28-1738094400000.pdf',
      });

      // Force reimport to pick up new environment
      vi.resetModules();
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.url).toBe('https://blob.vercel-storage.com/resume.pdf');
      expect(data.filename).toMatch(/^test-company-senior-engineer-\d{4}-\d{2}-\d{2}-\d+\.pdf$/);

      // Verify blob put was called correctly
      expect(mockPut).toHaveBeenCalledTimes(1);
      const [blobPath, buffer, options] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/^damilola\.tech\/resume\/generated\/production\/test-company-senior-engineer-\d{4}-\d{2}-\d{2}-\d+\.pdf$/);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(options).toEqual({
        access: 'public',
        contentType: 'application/pdf',
      });

      // Verify audit log was created
      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'resume_generation_completed',
        expect.objectContaining({
          companyName: 'Test Company',
          roleTitle: 'Senior Engineer',
          filename: expect.stringMatching(/^test-company-senior-engineer-\d{4}-\d{2}-\d{2}-\d+\.pdf$/),
          fileSize: expect.any(Number),
        }),
        '127.0.0.1'
      );
    });

    it('sanitizes company name and role title in filename', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/resume.pdf',
        pathname: 'test',
      });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({
        companyName: 'Test @ Company!! (Inc.)',
        roleTitle: 'Senior/Staff Engineer & Tech Lead',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filename).toMatch(/^test-company-inc-seniorstaf/);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toMatch(/test-company-inc-seniorstaf/);
    });

    it('truncates long company/role names to 30 characters', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/resume.pdf',
        pathname: 'test',
      });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({
        companyName: 'This is a very long company name that should be truncated',
        roleTitle: 'This is a very long role title that should also be truncated',
      });

      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(200);

      const [blobPath] = mockPut.mock.calls[0];
      const pathParts = blobPath.split('/');
      const filename = pathParts[pathParts.length - 1];
      // Filename format: {company}-{role}-{date}-{timestamp}.pdf
      // Split by '-' and validate the company and role slugs (first two segments)
      const segments = filename.replace('.pdf', '').split('-');
      const companySlug = segments[0];
      // Role slug is the second segment
      const roleSlug = segments[1];

      // Each component should be truncated to 30 chars
      expect(companySlug.length).toBeLessThanOrEqual(30);
      expect(roleSlug.length).toBeLessThanOrEqual(30);
      // Verify they are properly sanitized slugs (lowercase, no special chars)
      expect(companySlug).toMatch(/^[a-z0-9]+$/);
      expect(roleSlug).toMatch(/^[a-z0-9]+$/);
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toContain('/resume/generated/preview/');
    });

    it('uses preview environment when not on Vercel and NODE_ENV is not production', async () => {
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toContain('/resume/generated/preview/');
    });

    it('uses production environment when NODE_ENV is production and VERCEL is not set', async () => {
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      await POST(request);

      const [blobPath] = mockPut.mock.calls[0];
      expect(blobPath).toContain('/resume/generated/production/');
    });
  });

  describe('validation errors', () => {
    it('returns 400 when no PDF file is provided', async () => {
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({ pdf: null });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No PDF file provided');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 400 when company name is missing', async () => {
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({ companyName: null });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Company name and role title are required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 400 when role title is missing', async () => {
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({ roleTitle: null });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Company name and role title are required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 400 when PDF magic bytes are invalid', async () => {
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const invalidPdf = createPdfFile(1024, false);
      const request = createMockRequest({ pdf: invalidPdf });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid PDF file');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('returns 413 when file is too large', async () => {
      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      // Create a file larger than 10MB
      const largeFile = createPdfFile(11 * 1024 * 1024);
      const request = createMockRequest({ pdf: largeFile });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('File too large');
      expect(data.error).toContain('10MB');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 500 when blob put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to upload PDF');

      consoleSpy.mockRestore();
    });

    it('returns 500 when audit logging fails', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });
      mockLogAdminEvent.mockRejectedValue(new Error('Audit logging failed'));

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to upload PDF');

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles empty string company name with fallback', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({
        companyName: '!!!',  // Will sanitize to empty string
        roleTitle: 'Engineer',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [blobPath] = mockPut.mock.calls[0];
      // Should use 'company' as fallback
      expect(blobPath).toMatch(/\/company-engineer-/);
    });

    it('handles empty string role title with fallback', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest({
        companyName: 'Company',
        roleTitle: '!!!',  // Will sanitize to empty string
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [blobPath] = mockPut.mock.calls[0];
      // Should use 'role' as fallback
      expect(blobPath).toMatch(/\/company-role-/);
    });

    it('includes timestamp to prevent filename collisions', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request1 = createMockRequest();
      const request2 = createMockRequest();

      await POST(request1);
      await POST(request2);

      expect(mockPut).toHaveBeenCalledTimes(2);

      const [path1] = mockPut.mock.calls[0];
      const [path2] = mockPut.mock.calls[1];

      // Both should have timestamps, making them unique
      expect(path1).toMatch(/-\d{13}\.pdf$/);
      expect(path2).toMatch(/-\d{13}\.pdf$/);
    });

    it('extracts client IP correctly', async () => {
      mockGetClientIp.mockReturnValue('192.168.1.100');
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const request = createMockRequest();

      await POST(request);

      expect(mockGetClientIp).toHaveBeenCalledWith(request);
      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'resume_generation_completed',
        expect.any(Object),
        '192.168.1.100'
      );
    });

    it('handles minimum size PDF (just magic bytes)', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/resume-generator/upload-pdf/route');

      const minimalPdf = createPdfFile(4); // Just the magic bytes
      const request = createMockRequest({ pdf: minimalPdf });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});
