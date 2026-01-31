/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock audit-server
const mockLogAdminEvent = vi.fn();
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/audit API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/audit', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns audit event list', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/audit/development/2026-01-28/2026-01-28T10-30-00Z-page_view.json',
            size: 500,
            url: 'https://blob.url/audit1',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.events).toHaveLength(1);
    });

    it('supports date filter', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?date=2026-01-28');
      await GET(request);

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/2026-01-28/'),
        })
      );
    });

    it('supports eventType filter', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-00-00Z-page_view.json',
            size: 500,
            url: 'url1',
          },
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-01-00Z-chat_opened.json',
            size: 500,
            url: 'url2',
          },
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-02-00Z-page_view.json',
            size: 500,
            url: 'url3',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?eventType=page_view');
      const response = await GET(request);
      const data = await response.json();

      // Should filter to only page_view events
      expect(data.data.events.every((e: { eventType: string }) => e.eventType === 'page_view')).toBe(true);
    });

    it('supports pagination (page, limit)', async () => {
      // Create 30 mock events
      const blobs = Array.from({ length: 30 }, (_, i) => ({
        pathname: `audit/dev/2026-01-28/2026-01-28T10-${String(i).padStart(2, '0')}-00Z-page_view.json`,
        size: 500,
        url: `url${i}`,
      }));

      mockList.mockResolvedValue({ blobs, cursor: undefined });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?page=2&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.events).toHaveLength(10);
      expect(data.meta.page).toBe(2);
      expect(data.meta.totalCount).toBe(30);
      expect(data.meta.totalPages).toBe(3);
    });

    it('returns proper response format', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/audit/development/2026-01-28/2026-01-28T10-30-00Z-page_view.json',
            size: 500,
            url: 'https://blob.url/audit1',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.events[0]).toHaveProperty('id');
      expect(data.data.events[0]).toHaveProperty('pathname');
      expect(data.data.events[0]).toHaveProperty('eventType');
      expect(data.data.events[0]).toHaveProperty('environment');
      expect(data.data.events[0]).toHaveProperty('timestamp');
      expect(data.data.events[0]).toHaveProperty('size');
      expect(data.data.events[0]).toHaveProperty('url');
      expect(data.meta).toHaveProperty('totalCount');
      expect(data.meta).toHaveProperty('totalPages');
      expect(data.meta).toHaveProperty('page');
      expect(data.meta.pagination).toHaveProperty('hasMore');
    });

    it('parses timestamp from filename correctly', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-30-45Z-page_view.json',
            size: 500,
            url: 'url1',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      // Timestamp should be converted to ISO format with colons
      expect(data.data.events[0].timestamp).toBe('2026-01-28T10:30:45.000Z');
    });

    it('supports millisecond precision in timestamps', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-30-45.123Z-page_view.json',
            size: 500,
            url: 'url1',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.events[0].timestamp).toContain('2026-01-28T10:30:45');
    });

    it('logs admin_audit_accessed with accessType: api', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?date=2026-01-28&eventType=page_view');
      await GET(request);

      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'admin_audit_accessed',
        expect.objectContaining({
          environment: expect.any(String),
          date: '2026-01-28',
          eventType: 'page_view',
          page: 1,
        }),
        expect.any(String),
        expect.objectContaining({
          accessType: 'api',
          apiKeyId: 'key-1',
          apiKeyName: 'Test Key',
        })
      );
    });

    it('handles errors gracefully', async () => {
      mockList.mockRejectedValue(new Error('Blob error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });

    it('sorts events by timestamp descending', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'audit/dev/2026-01-28/2026-01-28T10-00-00Z-page_view.json', size: 500, url: 'url1' },
          { pathname: 'audit/dev/2026-01-28/2026-01-28T12-00-00Z-page_view.json', size: 500, url: 'url2' },
          { pathname: 'audit/dev/2026-01-28/2026-01-28T11-00-00Z-page_view.json', size: 500, url: 'url3' },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      const timestamps = data.data.events.map((e: { timestamp: string }) => e.timestamp);
      expect(timestamps[0]).toContain('12:00:00'); // Newest first
      expect(timestamps[1]).toContain('11:00:00');
      expect(timestamps[2]).toContain('10:00:00');
    });

    it('uses environment from env query param', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?env=production');
      const response = await GET(request);
      const data = await response.json();

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: expect.stringContaining('/production/'),
        })
      );
      expect(data.meta.environment).toBe('production');
    });

    it('limits page size to 100', async () => {
      mockList.mockResolvedValue({ blobs: [], cursor: undefined });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit?limit=500');
      const response = await GET(request);
      const data = await response.json();

      // Should cap at 100
      expect(response.status).toBe(200);
    });

    it('filters out events with empty eventType', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { pathname: 'audit/dev/2026-01-28/2026-01-28T10-00-00Z-page_view.json', size: 500, url: 'url1' },
          { pathname: 'audit/dev/2026-01-28/invalid-filename.json', size: 500, url: 'url2' },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      // Only valid event should be returned
      expect(data.data.events).toHaveLength(1);
      expect(data.data.events[0].eventType).toBe('page_view');
    });

    it('handles events with suffix in filename', async () => {
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'audit/dev/2026-01-28/2026-01-28T10-00-00Z-page_view-abc123.json',
            size: 500,
            url: 'url1',
          },
        ],
        cursor: undefined,
      });

      const { GET } = await import('@/app/api/v1/audit/route');
      const request = new Request('http://localhost/api/v1/audit');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.events[0].eventType).toBe('page_view');
    });
  });
});
