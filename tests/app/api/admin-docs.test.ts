import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock dependencies before importing the route
const mockCookieStore = {
  get: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock fs/promises for file reading
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
  readFile: mockReadFile,
}));

describe('admin docs [slug] API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieStore.get.mockClear();
    mockReadFile.mockClear();
  });

  describe('GET - authenticated requests', () => {
    it('returns doc content for valid slug with valid auth', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# README\n\nThis is the readme content.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('readme');
      expect(data.fileName).toBe('README.md');
      expect(data.content).toBe('# README\n\nThis is the readme content.');

      // Verify file was read from correct path
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        'utf-8'
      );
    });

    it('returns claude-md doc content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# CLAUDE.md\n\nProject instructions.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/claude-md');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'claude-md' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('claude-md');
      expect(data.fileName).toBe('CLAUDE.md');
      expect(data.content).toBe('# CLAUDE.md\n\nProject instructions.');
    });

    it('returns docs-index content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# Documentation Index\n\nOverview of docs.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/docs-index');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'docs-index' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('docs-index');
      expect(data.fileName).toBe('docs/README.md');
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('docs/README.md'),
        'utf-8'
      );
    });

    it('returns admin-portal doc content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# Admin Portal\n\nAdministration guide.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/admin-portal');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'admin-portal' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('admin-portal');
      expect(data.fileName).toBe('docs/admin-portal.md');
    });

    it('returns api-documentation content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# API Documentation\n\nAPI reference.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/api-documentation');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'api-documentation' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('api-documentation');
      expect(data.fileName).toBe('docs/api-documentation.md');
    });

    it('returns rate-limiting doc content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# Rate Limiting\n\nRate limit guide.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/rate-limiting');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'rate-limiting' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('rate-limiting');
      expect(data.fileName).toBe('docs/rate-limiting.md');
    });

    it('returns deployment doc content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# Deployment\n\nDeployment procedures.');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/deployment');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'deployment' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('deployment');
      expect(data.fileName).toBe('docs/deployment.md');
    });

    it('handles doc with special characters in content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('# Special\n\n`code` **bold** *italic* [link](url)');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toContain('`code`');
      expect(data.content).toContain('**bold**');
      expect(data.content).toContain('[link](url)');
    });

    it('handles empty doc content', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('');
    });
  });

  describe('GET - invalid slug', () => {
    it('returns 404 for non-existent slug', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/invalid-slug');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'invalid-slug' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 404 for empty slug', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: '' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('returns 404 for slug with path traversal attempt', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/../secret');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: '../secret' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe('GET - unauthorized requests', () => {
    it('returns 401 when session cookie is missing', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 401 when session cookie has no value', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 401 when session cookie is null', async () => {
      mockCookieStore.get.mockReturnValue(null);

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe('GET - file read errors', () => {
    it('returns 500 when file read fails', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/readme');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'readme' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read document');

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read README.md:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when file read throws permission error', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      const request = new Request('http://localhost/api/admin/docs/claude-md');
      const response = await GET(request as unknown as NextRequest, { params: Promise.resolve({ slug: 'claude-md' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read document');

      consoleSpy.mockRestore();
    });
  });

  describe('GET - edge cases', () => {
    it('constructs correct file path for root docs', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('content');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      await GET(
        new Request('http://localhost/api/admin/docs/readme') as unknown as NextRequest,
        { params: Promise.resolve({ slug: 'readme' }) }
      );

      const callPath = mockReadFile.mock.calls[0][0];
      expect(callPath).toContain('README.md');
      expect(callPath).not.toContain('docs/README.md');
    });

    it('constructs correct file path for docs folder', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('content');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      await GET(
        new Request('http://localhost/api/admin/docs/admin-portal') as unknown as NextRequest,
        { params: Promise.resolve({ slug: 'admin-portal' }) }
      );

      const callPath = mockReadFile.mock.calls[0][0];
      expect(callPath).toContain('docs/admin-portal.md');
    });

    it('awaits params promise correctly', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
      mockReadFile.mockResolvedValue('test content');

      const { GET } = await import('@/app/api/admin/docs/[slug]/route');

      // Pass params as a Promise (as Next.js does)
      const paramsPromise = Promise.resolve({ slug: 'readme' });
      const response = await GET(
        new Request('http://localhost/api/admin/docs/readme') as unknown as NextRequest,
        { params: paramsPromise }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('readme');
    });
  });
});
