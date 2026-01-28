/**
 * Session ID utilities for display formatting.
 */

/** Known session ID prefixes with their expected format. */
const KNOWN_PREFIXES = ['chat-', 'fit-assessment-', 'resume-generator-'] as const;

/**
 * Truncate session ID for display while preserving identifiability.
 * - Known prefixes (chat-, fit-assessment-, resume-generator-): show prefix + 8 UUID chars
 * - Exact 'anonymous': return unchanged
 * - *-anonymous patterns up to 30 chars: return unchanged
 * - Short IDs (<=12 chars): return unchanged
 * - Everything else: first 8 chars + '...'
 */
export function truncateSessionId(sessionId: string): string {
  // Known prefixed patterns - show prefix + first 8 chars of UUID
  for (const prefix of KNOWN_PREFIXES) {
    if (sessionId.startsWith(prefix)) {
      return sessionId.length <= 30 ? sessionId : `${sessionId.slice(0, prefix.length + 8)}...`;
    }
  }

  // Legacy anonymous patterns
  if (sessionId === 'anonymous') return sessionId;
  if (sessionId.endsWith('-anonymous') && sessionId.length <= 30) return sessionId;

  // Plain UUIDs or short strings
  if (sessionId.length <= 12) return sessionId;
  return `${sessionId.slice(0, 8)}...`;
}
