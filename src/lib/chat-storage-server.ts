/**
 * Server-side chat storage utilities
 *
 * Handles persisting chat conversations to Vercel Blob storage.
 * Used by the /api/chat endpoint for live capture of conversations.
 */

import { put } from '@vercel/blob';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SavedConversation {
  version: number;
  sessionId: string;
  environment: string;
  updatedAt: string;
  sessionStartedAt: string;
  messageCount: number;
  messages: ChatMessage[];
}

/**
 * Format a date for use in filenames.
 * Format: 2025-01-22T14-30-00Z (colons replaced with dashes for filename safety)
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Extract short ID from session ID.
 * Session ID format: chat-{uuid}, so split by '-' and take the first UUID segment
 */
function getShortId(sessionId: string): string {
  const parts = sessionId.split('-');
  // Skip 'chat' prefix if present and return first UUID segment
  return parts.length > 1 ? parts[1] : sessionId.slice(0, 8);
}

/**
 * Save a conversation to Vercel Blob storage
 *
 * Uses unified format: chat-{timestamp}-{shortId}.json
 * The timestamp comes from sessionStartedAt for consistency across updates.
 * Uses addRandomSuffix: false to overwrite the same file on each update.
 *
 * @param sessionId - Unique session identifier (chat-{uuid} format)
 * @param sessionStartedAt - ISO timestamp of when the session started
 * @param messages - Array of chat messages
 */
export async function saveConversationToBlob(
  sessionId: string,
  sessionStartedAt: string,
  messages: ChatMessage[]
): Promise<void> {
  const environment = process.env.VERCEL_ENV || 'development';

  // Validate sessionStartedAt date, fall back to current time if invalid
  const startedDate = new Date(sessionStartedAt);
  const validDate = isNaN(startedDate.getTime()) ? new Date() : startedDate;

  // New unified format: chat-{timestamp}-{shortId}.json
  const timestamp = formatTimestamp(validDate);
  const shortId = getShortId(sessionId);
  const path = `damilola.tech/chats/${environment}/chat-${timestamp}-${shortId}.json`;

  const payload: SavedConversation = {
    version: 1,
    sessionId,
    environment,
    updatedAt: new Date().toISOString(),
    sessionStartedAt,
    messageCount: messages.length,
    messages,
  };

  await put(path, JSON.stringify(payload), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}
