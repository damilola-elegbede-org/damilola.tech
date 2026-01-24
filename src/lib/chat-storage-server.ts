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
 * Save a conversation to Vercel Blob storage
 *
 * Uses the sessionId as the filename to enable overwrites on each update.
 * This provides live capture - every message exchange updates the same file.
 *
 * @param sessionId - Unique session identifier (UUID)
 * @param sessionStartedAt - ISO timestamp of when the session started
 * @param messages - Array of chat messages
 */
export async function saveConversationToBlob(
  sessionId: string,
  sessionStartedAt: string,
  messages: ChatMessage[]
): Promise<void> {
  const environment = process.env.VERCEL_ENV || 'development';
  const path = `damilola.tech/chats/${environment}/${sessionId}.json`;

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
