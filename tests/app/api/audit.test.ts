import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the route
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}));

describe('audit API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validEvent = {
    eventType: 'page_view',
    path: '/home',
    metadata: { source: 'test' },
  };

  describe('valid requests', () => {
    it('stores single event successfully', async () => {
      process.env.VERCEL_ENV = 'production';
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(mockPut).toHaveBeenCalledTimes(1);

      // Verify the blob path format
      const [pathname, content, options] = mockPut.mock.calls[0];
      expect(pathname).toMatch(/^damilola\.tech\/audit\/production\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-page_view\.json$/);
      expect(options).toEqual({ access: 'public', addRandomSuffix: true, contentType: 'application/json' });

      // Verify the audit event structure
      const parsedContent = JSON.parse(content);
      expect(parsedContent.version).toBe(1);
      expect(parsedContent.eventId).toBeDefined();
      expect(parsedContent.eventType).toBe('page_view');
      expect(parsedContent.environment).toBe('production');
      expect(parsedContent.path).toBe('/home');
      expect(parsedContent.metadata).toEqual({ source: 'test' });
      expect(parsedContent.timestamp).toBeDefined();
    });

    it('stores batch of events', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/audit/route');

      const events = [
        { eventType: 'page_view', path: '/' },
        { eventType: 'chat_opened', path: '/' },
        { eventType: 'section_view', path: '/', section: 'hero' },
      ];

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(3);
      expect(mockPut).toHaveBeenCalledTimes(3);

      // Verify different event types were stored
      const calls = mockPut.mock.calls;
      expect(calls[0][0]).toContain('page_view');
      expect(calls[1][0]).toContain('chat_opened');
      expect(calls[2][0]).toContain('section_view');

      // Verify section field is present in the third event
      const thirdEvent = JSON.parse(calls[2][1]);
      expect(thirdEvent.section).toBe('hero');
    });

    it('accepts all valid event types', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const eventTypes = [
        'page_view',
        'section_view',
        'chat_opened',
        'chat_message_sent',
        'fit_assessment_started',
        'fit_assessment_completed',
        'fit_assessment_download',
        'external_link_click',
      ];

      for (const eventType of eventTypes) {
        vi.clearAllMocks();
        vi.resetModules();

        const { POST: PostHandler } = await import('@/app/api/audit/route');
        const request = new Request('http://localhost/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, path: '/test' }),
        });

        const response = await PostHandler(request);
        expect(response.status).toBe(200);
      }
    });

    it('uses preview environment when VERCEL_ENV is preview', async () => {
      process.env.VERCEL_ENV = 'preview';
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/audit/preview/');
    });

    it('uses development environment when VERCEL_ENV is not set', async () => {
      delete process.env.VERCEL_ENV;
      mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/test', pathname: 'test' });

      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      });

      await POST(request);

      const [pathname] = mockPut.mock.calls[0];
      expect(pathname).toContain('/audit/development/');
    });

    it('handles optional fields correctly', async () => {
      mockPut.mockResolvedValue({ url: 'https://test', pathname: 'test' });

      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'section_view',
          path: '/test',
          section: 'experience',
          sessionId: 'session-123',
          userAgent: 'Mozilla/5.0',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const [, content] = mockPut.mock.calls[0];
      const parsedContent = JSON.parse(content);
      expect(parsedContent.section).toBe('experience');
      expect(parsedContent.sessionId).toBe('session-123');
      expect(parsedContent.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('validation errors', () => {
    it('rejects invalid event type', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'invalid_type', path: '/' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('eventType');
    });

    it('rejects missing path', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'page_view' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('path');
    });

    it('rejects empty path', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'page_view', path: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('path');
    });

    it('rejects empty events array', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No events');
    });

    it('rejects batch exceeding 10 events', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const events = Array(11).fill({ eventType: 'page_view', path: '/' });

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('10');
    });

    it('rejects invalid JSON body', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('rejects event with invalid object in batch', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const events = [
        { eventType: 'page_view', path: '/' },
        { eventType: 'invalid_type', path: '/' }, // Invalid event type
        { eventType: 'chat_opened', path: '/' },
      ];

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Event 1'); // Zero-indexed
    });
  });

  describe('request size validation', () => {
    it('rejects oversized request', async () => {
      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '200000', // 200KB, exceeds 100KB limit
        },
        body: JSON.stringify(validEvent),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('too large');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('blob errors', () => {
    it('returns 500 when blob put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      const { POST } = await import('@/app/api/audit/route');

      const request = new Request('http://localhost/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('store');

      consoleSpy.mockRestore();
    });
  });
});
