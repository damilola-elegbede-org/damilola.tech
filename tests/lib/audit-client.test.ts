import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

// Mock window and document
const windowMock = {
  location: { pathname: '/test-path' },
  addEventListener: vi.fn(),
};

const documentMock = {
  addEventListener: vi.fn(),
  visibilityState: 'visible',
};

const navigatorMock = {
  userAgent: 'test-user-agent',
  sendBeacon: vi.fn(() => true),
};

describe('audit-client module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorageMock.clear();

    // Setup global mocks
    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('navigator', navigatorMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('trackEvent', () => {
    it('queues events without immediately sending', async () => {
      const { trackEvent, auditClient } = await import('@/lib/audit-client');

      trackEvent('page_view', { metadata: { page: 'home' } });

      // Event should be queued, not sent yet
      expect(fetch).not.toHaveBeenCalled();
    });

    it('captures path and userAgent automatically', async () => {
      const { trackEvent, auditClient } = await import('@/lib/audit-client');

      trackEvent('page_view');

      // Force flush to verify event content
      await auditClient.flush();

      expect(fetch).toHaveBeenCalledWith(
        '/api/audit',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"path":"/test-path"'),
        })
      );
    });
  });

  describe('batching', () => {
    it('flushes when batch size is reached', async () => {
      const { trackEvent } = await import('@/lib/audit-client');

      // Queue 10 events (batch size)
      for (let i = 0; i < 10; i++) {
        trackEvent('page_view');
      }

      // Should have triggered a flush
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('creates session ID on first init', async () => {
      const { auditClient } = await import('@/lib/audit-client');

      const sessionId = auditClient.getSessionId();

      expect(sessionId).toBe('test-uuid-1234');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('audit_session_id', 'test-uuid-1234');
    });

    it('reuses existing session ID', async () => {
      localStorageMock.getItem.mockReturnValueOnce('existing-session-id');

      const { auditClient } = await import('@/lib/audit-client');

      const sessionId = auditClient.getSessionId();

      expect(sessionId).toBe('existing-session-id');
    });
  });

  describe('flush', () => {
    it('sends queued events via fetch', async () => {
      const { trackEvent, auditClient } = await import('@/lib/audit-client');

      trackEvent('chat_opened');
      await auditClient.flush();

      expect(fetch).toHaveBeenCalledWith(
        '/api/audit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('uses sendBeacon when page is hidden', async () => {
      documentMock.visibilityState = 'hidden';

      const { trackEvent, auditClient } = await import('@/lib/audit-client');

      trackEvent('page_view');
      await auditClient.flush();

      expect(navigatorMock.sendBeacon).toHaveBeenCalled();
    });

    it('does nothing when queue is empty', async () => {
      const { auditClient } = await import('@/lib/audit-client');

      await auditClient.flush();

      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
