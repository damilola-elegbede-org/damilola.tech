/**
 * Chat session persistence with 4-hour TTL
 *
 * Stores chat messages in localStorage to survive page refreshes.
 * Sessions automatically expire after 4 hours of inactivity.
 * Expired sessions are archived to Vercel Blob before clearing.
 */

const STORAGE_KEY = 'damilola-chat-session';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Message format matching @ai-sdk/react useChat hook
interface MessagePart {
  type: 'text';
  text: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

interface StoredSession {
  messages: StoredMessage[];
  timestamp: number;
  startedAt: string;
  sessionId: string;
}

/**
 * Generate a cryptographically secure UUID v4
 * Falls back to Math.random() only in environments without crypto API
 */
function generateUUID(): string {
  // Use Web Crypto API if available (secure)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers (less secure but functional)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if localStorage is available (handles SSR and private browsing)
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runtime type guard for StoredSession
 * Validates parsed JSON matches expected structure
 */
function isStoredSession(obj: unknown): obj is StoredSession {
  if (typeof obj !== 'object' || obj === null) return false;

  const session = obj as Record<string, unknown>;

  if (typeof session.timestamp !== 'number') return false;
  if (!Array.isArray(session.messages)) return false;

  return session.messages.every((msg: unknown) => {
    if (typeof msg !== 'object' || msg === null) return false;
    const m = msg as Record<string, unknown>;
    return (
      typeof m.id === 'string' &&
      (m.role === 'user' || m.role === 'assistant') &&
      Array.isArray(m.parts) &&
      m.parts.every(
        (p: unknown) =>
          typeof p === 'object' &&
          p !== null &&
          (p as Record<string, unknown>).type === 'text' &&
          typeof (p as Record<string, unknown>).text === 'string'
      )
    );
  });
}

/**
 * Get the raw stored session without validation or expiry checks
 */
function getRawSession(): StoredSession | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!isStoredSession(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Archive a session to Vercel Blob (fire-and-forget)
 * This is called before clearing expired sessions or when user clears chat
 */
export async function archiveSession(
  sessionId: string,
  sessionStartedAt: string,
  messages: StoredMessage[]
): Promise<void> {
  try {
    const response = await fetch('/api/chat/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, sessionStartedAt, messages }),
    });

    if (!response.ok) {
      console.warn('Failed to archive session:', `HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('Failed to archive session:', error);
  }
}

/**
 * Save chat messages to localStorage
 * Preserves startedAt and sessionId from existing session
 */
export function saveSession(messages: StoredMessage[]): void {
  if (!isLocalStorageAvailable()) return;

  // Preserve existing session metadata or create new
  const existing = getRawSession();

  const session: StoredSession = {
    messages,
    timestamp: Date.now(),
    startedAt: existing?.startedAt || new Date().toISOString(),
    sessionId: existing?.sessionId || generateUUID(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    // Ignore quota exceeded or other storage errors
    console.warn('Failed to save chat session:', error);
  }
}

/**
 * Get the current session ID
 * Returns null if no session exists
 */
export function getSessionId(): string | null {
  const session = getRawSession();
  return session?.sessionId ?? null;
}

/**
 * Get the session start timestamp
 * Returns null if no session exists
 */
export function getSessionStartedAt(): string | null {
  const session = getRawSession();
  return session?.startedAt ?? null;
}

/**
 * Load chat messages from localStorage if session is still valid
 * Returns null if no session exists or session has expired
 * Archives expired sessions before clearing them
 */
export function loadSession(): StoredMessage[] | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);

    // Validate structure before using
    if (!isStoredSession(parsed)) {
      console.warn('Invalid session structure, clearing');
      removeSessionFromStorage();
      return null;
    }

    const age = Date.now() - parsed.timestamp;

    if (age > SESSION_TTL_MS) {
      // Archive expired session before clearing (fire-and-forget)
      if (parsed.messages.length > 0 && parsed.sessionId && parsed.startedAt) {
        archiveSession(parsed.sessionId, parsed.startedAt, parsed.messages);
      }
      removeSessionFromStorage();
      return null;
    }

    return parsed.messages;
  } catch (error) {
    // If parsing fails, clear corrupted data
    console.warn('Failed to load chat session:', error);
    removeSessionFromStorage();
    return null;
  }
}

/**
 * Internal function to remove session from localStorage without archiving
 */
function removeSessionFromStorage(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear the stored chat session
 * Archives the session before clearing if it has messages
 */
export function clearSession(): void {
  if (!isLocalStorageAvailable()) return;

  // Get current session to archive before clearing
  const session = getRawSession();
  if (session && session.messages.length > 0 && session.sessionId && session.startedAt) {
    // Fire-and-forget archive
    archiveSession(session.sessionId, session.startedAt, session.messages);
  }

  removeSessionFromStorage();
}
