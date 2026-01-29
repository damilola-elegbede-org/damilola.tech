/**
 * Chat filename parsing utilities.
 *
 * Supported formats (in priority order):
 * 1. Unified: chat-{timestamp}-{shortId}.json (NEW - primary write format)
 * 2. Old live: chat-{uuid}.json (read-only, backward compat)
 * 3. Old archive: {timestamp}-{shortId}.json (read-only, backward compat)
 * 4. Legacy: {uuid}.json (read-only, backward compat)
 */

export const CHAT_FILENAME_PATTERNS = {
  // NEW unified format: chat-{timestamp}-{shortId}.json
  unified: /^chat-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]{8})\.json$/i,

  // Old live format: chat-{uuid}.json
  chatPrefixUuid:
    /^(chat-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/i,

  // Old archive format: {timestamp}-{shortId}.json with optional random suffix
  timestampShortId:
    /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]{8})(?:-.+)?\.json$/i,

  // Legacy format: {uuid}.json
  legacy:
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/,
} as const;

export type ChatFilenameFormat =
  | 'unified'
  | 'chatPrefixUuid'
  | 'timestampShortId'
  | 'legacy';

export interface ParsedChatFilename {
  format: ChatFilenameFormat;
  sessionId: string; // Short ID (8 chars) for display
  timestamp: string | null; // ISO string, null if not extractable
  filename: string;
}

/**
 * Check if a filename is a valid chat file (matches any supported format)
 */
export function isValidChatFilename(filename: string): boolean {
  return (
    CHAT_FILENAME_PATTERNS.unified.test(filename) ||
    CHAT_FILENAME_PATTERNS.chatPrefixUuid.test(filename) ||
    CHAT_FILENAME_PATTERNS.timestampShortId.test(filename) ||
    CHAT_FILENAME_PATTERNS.legacy.test(filename)
  );
}

/**
 * Parse a chat filename and extract metadata.
 * Returns null if the filename doesn't match any supported format.
 */
export function parseChatFilename(
  filename: string,
  fallbackTimestamp?: string
): ParsedChatFilename | null {
  // Try unified format: chat-{timestamp}-{shortId}.json (NEW)
  const unifiedMatch = filename.match(CHAT_FILENAME_PATTERNS.unified);
  if (unifiedMatch) {
    const timestamp = unifiedMatch[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3.000Z'
    );
    return {
      format: 'unified',
      sessionId: unifiedMatch[2],
      timestamp,
      filename,
    };
  }

  // Try old live format: chat-{uuid}.json
  const chatPrefixMatch = filename.match(CHAT_FILENAME_PATTERNS.chatPrefixUuid);
  if (chatPrefixMatch) {
    // Use case-insensitive replace to handle Chat-, CHAT-, etc.
    const uuid = chatPrefixMatch[1].replace(/^chat-/i, '');
    return {
      format: 'chatPrefixUuid',
      sessionId: uuid.slice(0, 8),
      timestamp: fallbackTimestamp || null,
      filename,
    };
  }

  // Try old archive format: {timestamp}-{shortId}.json
  const timestampMatch = filename.match(CHAT_FILENAME_PATTERNS.timestampShortId);
  if (timestampMatch) {
    const timestamp = timestampMatch[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3.000Z'
    );
    return {
      format: 'timestampShortId',
      sessionId: timestampMatch[2],
      timestamp,
      filename,
    };
  }

  // Try legacy format: {uuid}.json
  const legacyMatch = filename.match(CHAT_FILENAME_PATTERNS.legacy);
  if (legacyMatch) {
    return {
      format: 'legacy',
      sessionId: legacyMatch[1].slice(0, 8),
      timestamp: fallbackTimestamp || null,
      filename,
    };
  }

  return null;
}

/**
 * Extract timestamp from a chat filename for cleanup/retention purposes.
 * Returns null if timestamp cannot be extracted (use blob.uploadedAt as fallback).
 */
export function extractTimestampFromFilename(filename: string): Date | null {
  // Unified format: chat-{timestamp}-{shortId}.json
  const unifiedMatch = filename.match(CHAT_FILENAME_PATTERNS.unified);
  if (unifiedMatch) {
    const isoTimestamp = unifiedMatch[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3Z'
    );
    const date = new Date(isoTimestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // Old archive format: {timestamp}-{shortId}.json
  const timestampMatch = filename.match(CHAT_FILENAME_PATTERNS.timestampShortId);
  if (timestampMatch) {
    const isoTimestamp = timestampMatch[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3Z'
    );
    const date = new Date(isoTimestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // chatPrefixUuid and legacy formats don't have timestamps in filename
  return null;
}
