import { put } from '@vercel/blob';

export const runtime = 'nodejs';

// 100KB max - archived sessions contain message history
const MAX_BODY_SIZE = 100 * 1024;

// Session ID regex pattern: chat-prefixed UUID v4
const SESSION_ID_REGEX = /^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MessagePart {
  type: 'text';
  text: string;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

interface ArchiveRequest {
  sessionId: string;
  sessionStartedAt: string;
  messages: StoredMessage[];
}

interface ArchivedSession {
  version: number;
  sessionId: string;
  environment: string;
  archivedAt: string;
  sessionStartedAt: string;
  messageCount: number;
  messages: StoredMessage[];
}

function isValidRequest(body: unknown): body is ArchiveRequest {
  if (typeof body !== 'object' || body === null) return false;

  const req = body as Record<string, unknown>;

  if (typeof req.sessionId !== 'string') return false;
  if (typeof req.sessionStartedAt !== 'string') return false;
  if (!Array.isArray(req.messages)) return false;

  return true;
}

interface ValidationResult {
  error: string | null;
  normalizedSessionId: string | null;
}

function validateRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Invalid request body', normalizedSessionId: null };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.sessionId !== 'string' || !req.sessionId) {
    return { error: 'sessionId is required', normalizedSessionId: null };
  }

  // Normalize to lowercase for consistent storage
  const normalizedId = req.sessionId.toLowerCase();
  if (!SESSION_ID_REGEX.test(normalizedId)) {
    console.error(JSON.stringify({
      type: 'session_validation_error',
      timestamp: new Date().toISOString(),
      endpoint: 'chat/archive',
      error: 'invalid_session_id_format',
      receivedFormat: normalizedId?.slice(0, 25),
      expectedPattern: 'chat-{uuid}',
    }));
    return { error: 'sessionId must be a valid chat-prefixed UUID', normalizedSessionId: null };
  }

  if (typeof req.sessionStartedAt !== 'string' || !req.sessionStartedAt) {
    return { error: 'sessionStartedAt is required', normalizedSessionId: null };
  }

  // Validate ISO date format
  const date = new Date(req.sessionStartedAt);
  if (isNaN(date.getTime())) {
    return { error: 'sessionStartedAt must be a valid ISO date', normalizedSessionId: null };
  }

  if (!Array.isArray(req.messages)) {
    return { error: 'messages array is required', normalizedSessionId: null };
  }

  if (req.messages.length === 0) {
    return { error: 'messages cannot be empty', normalizedSessionId: null };
  }

  return { error: null, normalizedSessionId: normalizedId };
}

function formatTimestamp(date: Date): string {
  // Format: 2025-01-22T14-30-00Z (colons replaced with dashes for filename safety)
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function getShortId(sessionId: string): string {
  // Extract first 8 characters of UUID portion for brevity in filename
  // Session ID format: chat-{uuid}, so split by '-' and take index 1
  const parts = sessionId.split('-');
  return parts.length > 1 ? parts[1] : parts[0];
}

export async function POST(req: Request) {
  console.log(JSON.stringify({
    type: 'archive_request',
    timestamp: new Date().toISOString(),
  }));
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { error: validationError, normalizedSessionId } = validateRequest(body);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    if (!isValidRequest(body)) {
      return Response.json({ error: 'Invalid request structure' }, { status: 400 });
    }

    const { sessionStartedAt, messages } = body;
    // Use normalized sessionId from validation (lowercase for consistent storage)
    const sessionId = normalizedSessionId!;
    const environment = process.env.VERCEL_ENV || 'development';
    const now = new Date();

    const archivedSession: ArchivedSession = {
      version: 1,
      sessionId,
      environment,
      archivedAt: now.toISOString(),
      sessionStartedAt,
      messageCount: messages.length,
      messages,
    };

    const timestamp = formatTimestamp(now);
    const shortId = getShortId(sessionId);
    const pathname = `damilola.tech/chats/${environment}/${timestamp}-${shortId}.json`;

    await put(pathname, JSON.stringify(archivedSession), {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[chat/archive] Error archiving session:', error);
    return Response.json({ error: 'Failed to archive session' }, { status: 500 });
  }
}
