/**
 * Chat session persistence with 4-hour TTL
 *
 * Stores chat messages in localStorage to survive page refreshes.
 * Sessions automatically expire after 4 hours of inactivity.
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
 * Save chat messages to localStorage
 */
export function saveSession(messages: StoredMessage[]): void {
  if (!isLocalStorageAvailable()) return;

  const session: StoredSession = {
    messages,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    // Ignore quota exceeded or other storage errors
    console.warn('Failed to save chat session:', error);
  }
}

/**
 * Load chat messages from localStorage if session is still valid
 * Returns null if no session exists or session has expired
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
      clearSession();
      return null;
    }

    const age = Date.now() - parsed.timestamp;

    if (age > SESSION_TTL_MS) {
      clearSession();
      return null;
    }

    return parsed.messages;
  } catch (error) {
    // If parsing fails, clear corrupted data
    console.warn('Failed to load chat session:', error);
    clearSession();
    return null;
  }
}

/**
 * Clear the stored chat session
 */
export function clearSession(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
