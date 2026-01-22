import { put } from '@vercel/blob';

export const runtime = 'nodejs';

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function getValidationError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return 'Invalid request body';
  }

  const req = body as Record<string, unknown>;

  if (typeof req.sessionId !== 'string' || !req.sessionId) {
    return 'sessionId is required';
  }

  if (!UUID_REGEX.test(req.sessionId)) {
    return 'sessionId must be a valid UUID';
  }

  if (typeof req.sessionStartedAt !== 'string' || !req.sessionStartedAt) {
    return 'sessionStartedAt is required';
  }

  // Validate ISO date format
  const date = new Date(req.sessionStartedAt);
  if (isNaN(date.getTime())) {
    return 'sessionStartedAt must be a valid ISO date';
  }

  if (!Array.isArray(req.messages)) {
    return 'messages array is required';
  }

  if (req.messages.length === 0) {
    return 'messages cannot be empty';
  }

  return null;
}

function formatTimestamp(date: Date): string {
  // Format: 2025-01-22T14-30-00Z (colons replaced with dashes for filename safety)
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function getShortId(uuid: string): string {
  // Extract first 8 characters of UUID for brevity in filename
  return uuid.split('-')[0];
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validationError = getValidationError(body);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    if (!isValidRequest(body)) {
      return Response.json({ error: 'Invalid request structure' }, { status: 400 });
    }

    const { sessionId, sessionStartedAt, messages } = body;
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
      contentType: 'application/json',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[chat/archive] Error archiving session:', error);
    return Response.json({ error: 'Failed to archive session' }, { status: 500 });
  }
}
