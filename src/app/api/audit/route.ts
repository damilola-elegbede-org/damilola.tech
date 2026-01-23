import { put } from '@vercel/blob';
import type { AuditEvent, AuditEventType } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_EVENTS_PER_BATCH = 10;

const VALID_EVENT_TYPES: AuditEventType[] = [
  'page_view',
  'section_view',
  'chat_opened',
  'chat_message_sent',
  'fit_assessment_started',
  'fit_assessment_completed',
  'fit_assessment_download',
  'external_link_click',
];

interface EventInput {
  eventType: AuditEventType;
  path: string;
  section?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userAgent?: string;
}

function isValidEventType(type: unknown): type is AuditEventType {
  return typeof type === 'string' && VALID_EVENT_TYPES.includes(type as AuditEventType);
}

function validateEvent(event: unknown, index: number): { valid: true; data: EventInput } | { valid: false; error: string } {
  if (typeof event !== 'object' || event === null) {
    return { valid: false, error: `Event ${index}: Invalid event object` };
  }

  const e = event as Record<string, unknown>;

  if (!isValidEventType(e.eventType)) {
    return { valid: false, error: `Event ${index}: Invalid eventType` };
  }

  if (typeof e.path !== 'string' || !e.path) {
    return { valid: false, error: `Event ${index}: path is required` };
  }

  return {
    valid: true,
    data: {
      eventType: e.eventType,
      path: e.path,
      section: typeof e.section === 'string' ? e.section : undefined,
      metadata: typeof e.metadata === 'object' && e.metadata !== null ? e.metadata as Record<string, unknown> : {},
      sessionId: typeof e.sessionId === 'string' ? e.sessionId : undefined,
      userAgent: typeof e.userAgent === 'string' ? e.userAgent : undefined,
    },
  };
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function formatDatePath(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export async function POST(req: Request) {
  try {
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

    // Accept single event or array
    const events = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return Response.json({ error: 'No events provided' }, { status: 400 });
    }

    if (events.length > MAX_EVENTS_PER_BATCH) {
      return Response.json({ error: `Maximum ${MAX_EVENTS_PER_BATCH} events per batch` }, { status: 400 });
    }

    // Validate all events
    const validatedEvents: EventInput[] = [];
    for (let i = 0; i < events.length; i++) {
      const result = validateEvent(events[i], i);
      if (!result.valid) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      validatedEvents.push(result.data);
    }

    const environment = process.env.VERCEL_ENV || 'development';
    const now = new Date();
    const datePath = formatDatePath(now);

    // Store each event
    const storePromises = validatedEvents.map(async (event, index) => {
      const eventId = crypto.randomUUID();
      const timestamp = formatTimestamp(new Date(now.getTime() + index)); // Offset for uniqueness

      const auditEvent: AuditEvent = {
        version: 1,
        eventId,
        eventType: event.eventType,
        environment,
        timestamp: new Date().toISOString(),
        sessionId: event.sessionId,
        path: event.path,
        section: event.section,
        metadata: event.metadata || {},
        userAgent: event.userAgent,
      };

      const pathname = `damilola.tech/audit/${environment}/${datePath}/${timestamp}-${event.eventType}.json`;

      await put(pathname, JSON.stringify(auditEvent), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
      });
    });

    await Promise.all(storePromises);

    return Response.json({ success: true, count: validatedEvents.length });
  } catch (error) {
    console.error('[audit] Error storing events:', error);
    return Response.json({ error: 'Failed to store events' }, { status: 500 });
  }
}
