import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadSession,
  saveSession,
  clearSession,
  getSessionId,
  getSessionStartedAt,
  archiveSession,
  type StoredMessage,
} from '@/lib/chat-storage';

// Mock fetch for archive API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('chat-storage', () => {
  let localStorageMock: { [key: string]: string };
  let originalLocalStorage: Storage;

  beforeEach(() => {
    localStorageMock = {};
    originalLocalStorage = window.localStorage;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('loadSession', () => {
    it('returns null when no data exists', () => {
      const result = loadSession();
      expect(result).toBeNull();
    });

    it('returns messages when valid data exists', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] },
      ];

      const session = {
        messages,
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();
      expect(result).toEqual(messages);
    });

    it('returns null when session expired (>4 hours)', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Old message' }] },
      ];

      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      const session = {
        messages,
        timestamp: fiveHoursAgo,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });

    it('returns null and clears corrupted data', () => {
      localStorageMock['damilola-chat-session'] = 'not valid json {{{';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });

    it('returns null for invalid message structure', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'invalid_role', parts: [] }, // invalid role
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });

    it('returns null for missing parts array', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'user' }, // missing parts
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('returns null for invalid part structure', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'image', url: 'test.png' }] }, // not text type
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('saveSession', () => {
    it('stores messages to localStorage', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'damilola-chat-session',
        expect.any(String)
      );

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.messages).toEqual(messages);
      expect(savedData.timestamp).toBeDefined();
      expect(typeof savedData.timestamp).toBe('number');
    });

    it('stores multiple messages correctly', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Second' }] },
        { id: '3', role: 'user', parts: [{ type: 'text', text: 'Third' }] },
      ];

      saveSession(messages);

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.messages).toHaveLength(3);
      expect(savedData.messages[0].parts[0].text).toBe('First');
      expect(savedData.messages[1].parts[0].text).toBe('Second');
      expect(savedData.messages[2].parts[0].text).toBe('Third');
    });
  });

  describe('clearSession', () => {
    it('removes data from localStorage', () => {
      localStorageMock['damilola-chat-session'] = JSON.stringify({
        messages: [],
        timestamp: Date.now(),
      });

      clearSession();

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });
  });

  describe('localStorage unavailable', () => {
    it('loadSession returns null when localStorage unavailable', () => {
      // Make localStorage throw
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('QuotaExceededError'); },
          getItem: () => { throw new Error('SecurityError'); },
          removeItem: () => { throw new Error('SecurityError'); },
        },
        writable: true,
      });

      const result = loadSession();
      expect(result).toBeNull();
    });

    it('saveSession handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('QuotaExceededError'); },
          getItem: vi.fn(() => '__storage_test__'),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Test' }] },
      ];

      // Should not throw
      expect(() => saveSession(messages)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('clearSession handles localStorage errors gracefully', () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: vi.fn(),
          getItem: vi.fn(() => '__storage_test__'),
          removeItem: () => { throw new Error('SecurityError'); },
        },
        writable: true,
      });

      // Should not throw
      expect(() => clearSession()).not.toThrow();
    });
  });

  describe('validates message structure', () => {
    it('validates message has required id field', () => {
      const invalidSession = {
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }, // missing id
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('validates role is user or assistant', () => {
      const validSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(validSession);

      const result = loadSession();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('validates parts contains text type with text string', () => {
      const validSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(validSession);

      const result = loadSession();
      expect(result).not.toBeNull();
      expect(result![0].parts[0].text).toBe('Hello');
    });
  });

  describe('session metadata', () => {
    it('saveSession sets startedAt on first save', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.startedAt).toBeDefined();
      expect(typeof savedData.startedAt).toBe('string');
      // Verify it's a valid ISO date
      expect(new Date(savedData.startedAt).toISOString()).toBe(savedData.startedAt);
    });

    it('saveSession preserves startedAt on subsequent saves', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      // First save
      saveSession(messages);
      const firstSave = JSON.parse(localStorageMock['damilola-chat-session']);
      const originalStartedAt = firstSave.startedAt;

      // Second save with more messages
      const moreMessages: StoredMessage[] = [
        ...messages,
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
      ];
      saveSession(moreMessages);

      const secondSave = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(secondSave.startedAt).toBe(originalStartedAt);
    });

    it('saveSession generates sessionId on first save', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.sessionId).toBeDefined();
      // UUID v4 format check
      expect(savedData.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('saveSession preserves sessionId on subsequent saves', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      // First save
      saveSession(messages);
      const firstSave = JSON.parse(localStorageMock['damilola-chat-session']);
      const originalSessionId = firstSave.sessionId;

      // Second save
      saveSession([...messages, { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] }]);

      const secondSave = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(secondSave.sessionId).toBe(originalSessionId);
    });

    it('getSessionId returns current session ID', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);
      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);

      const sessionId = getSessionId();
      expect(sessionId).toBe(savedData.sessionId);
    });

    it('getSessionId returns null when no session exists', () => {
      const sessionId = getSessionId();
      expect(sessionId).toBeNull();
    });

    it('getSessionStartedAt returns current session startedAt', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);
      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);

      const startedAt = getSessionStartedAt();
      expect(startedAt).toBe(savedData.startedAt);
    });

    it('getSessionStartedAt returns null when no session exists', () => {
      const startedAt = getSessionStartedAt();
      expect(startedAt).toBeNull();
    });
  });

  describe('archiveSession', () => {
    it('sends session data to archive API', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T10:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
      ];

      await archiveSession(sessionId, startedAt, messages);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionStartedAt: startedAt, messages }),
      });
    });

    it('handles archive API failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T10:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      // Should resolve without throwing (archiveSession handles errors internally)
      await expect(archiveSession(sessionId, startedAt, messages)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('archive'), expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('handles non-OK response gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T10:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      await archiveSession(sessionId, startedAt, messages);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('archive'), expect.stringContaining('500'));

      consoleSpy.mockRestore();
    });
  });

  describe('session archiving on expiry', () => {
    it('archives expired session before clearing', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T05:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Old message' }] },
      ];

      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      const session = {
        messages,
        timestamp: fiveHoursAgo,
        startedAt,
        sessionId,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();

      // Wait for async archive to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionStartedAt: startedAt, messages }),
      });
    });

    it('archive failure does not block session clearing', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T05:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Old message' }] },
      ];

      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      const session = {
        messages,
        timestamp: fiveHoursAgo,
        startedAt,
        sessionId,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();

      // Session should be cleared regardless of archive failure
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });

    it('does not archive valid (non-expired) sessions', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Recent message' }] },
      ];

      const session = {
        messages,
        timestamp: Date.now(),
        startedAt: new Date().toISOString(),
        sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      loadSession();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not archive sessions with no messages', async () => {
      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T05:30:00.000Z';

      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      const session = {
        messages: [],
        timestamp: fiveHoursAgo,
        startedAt,
        sessionId,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      loadSession();

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('clearSession archiving', () => {
    it('archives session with messages when clearSession is called', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const startedAt = '2025-01-22T10:30:00.000Z';
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
      ];

      const session = {
        messages,
        timestamp: Date.now(),
        startedAt,
        sessionId,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      clearSession();

      // Wait for async archive
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionStartedAt: startedAt, messages }),
      });
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });

    it('does not archive when clearSession has no existing session', async () => {
      clearSession();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not archive when session has no messages', async () => {
      const session = {
        messages: [],
        timestamp: Date.now(),
        startedAt: '2025-01-22T10:30:00.000Z',
        sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      clearSession();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });

    it('archive failure does not block clearSession', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const session = {
        messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        timestamp: Date.now(),
        startedAt: '2025-01-22T10:30:00.000Z',
        sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      clearSession();

      // Session should still be cleared
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });
  });
});
