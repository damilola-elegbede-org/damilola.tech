import Anthropic from '@anthropic-ai/sdk';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';
import { saveConversationToBlob } from '@/lib/chat-storage-server';
import { compactConversation } from '@/lib/chat-compaction';
import {
  checkGenericRateLimit,
  createRateLimitResponse,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { logUsage } from '@/lib/usage-logger';

// Use Node.js runtime for reliable Anthropic SDK streaming
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = CHATBOT_SYSTEM_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 200;
// Maximum request body size: 200 messages * 2000 chars + overhead ≈ 500KB
const MAX_BODY_SIZE = 500 * 1024;
const COMPACTION_THRESHOLD = 180; // 90% of MAX_MESSAGES

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) return false;
  if (messages.length > MAX_MESSAGES) return false;

  return messages.every(
    (msg) =>
      typeof msg === 'object' &&
      msg !== null &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.length <= MAX_MESSAGE_LENGTH
  );
}

/**
 * Escape XML entities to prevent injection when wrapping user content in XML tags.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: Request) {
  console.log('[chat] Request received');
  const startTime = Date.now();
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    let messages, sessionId, sessionStartedAt;
    try {
      const body = await req.json();
      messages = body.messages;
      sessionId = body.sessionId;
      sessionStartedAt = body.sessionStartedAt;
    } catch {
      return Response.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    // Validate session identifiers to prevent path injection
    // Session IDs must be prefixed with 'chat-' followed by a UUID v4
    const isValidSessionId =
      typeof sessionId === 'string' &&
      /^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    const isValidSessionStartedAt =
      typeof sessionStartedAt === 'string' && !Number.isNaN(Date.parse(sessionStartedAt));

    // Log validation failures for debugging
    if (sessionId && !isValidSessionId) {
      console.error(JSON.stringify({
        type: 'session_validation_error',
        timestamp: new Date().toISOString(),
        endpoint: 'chat',
        error: 'invalid_session_id_format',
        receivedFormat: typeof sessionId === 'string' ? sessionId.slice(0, 25) : typeof sessionId,
        expectedPattern: 'chat-{uuid}',
      }));
    }
    if (sessionStartedAt && !isValidSessionStartedAt) {
      console.error(JSON.stringify({
        type: 'session_validation_error',
        timestamp: new Date().toISOString(),
        endpoint: 'chat',
        error: 'invalid_session_started_at',
      }));
    }

    // Rate limit check: always use IP to prevent bypass via client-controlled sessionId
    const ip = getClientIp(req);
    const rateLimitResult = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.chat,
      ip
    );
    if (rateLimitResult.limited) {
      console.log(`[chat] Rate limited: ${ip}`);
      return createRateLimitResponse(rateLimitResult);
    }

    if (!validateMessages(messages)) {
      return Response.json(
        { error: 'Invalid messages format or content too long.' },
        { status: 400 }
      );
    }

    // Use build-time generated prompt (production) or fetch at runtime (development)
    const basePrompt = isGeneratedPromptAvailable
      ? CHATBOT_SYSTEM_PROMPT
      : await getFullSystemPrompt();

    // Reinforce brevity at the system level
    const brevityPrefix = `CRITICAL: Keep responses SHORT. Default: 2-4 sentences. Simple factual questions: 1-2 sentences. Only use STAR format for behavioral questions. Never volunteer extra context unless asked.\n\n`;
    const systemPrompt = brevityPrefix + basePrompt;

    // Auto-compact conversation if approaching limits
    const { messages: processedMessages, wasCompacted, originalCount } = await compactConversation(
      messages,
      client,
      COMPACTION_THRESHOLD
    );

    if (wasCompacted) {
      console.log(`[chat] Compacted ${originalCount} -> ${processedMessages.length} messages`);
    }

    console.log('[chat] Starting stream, messages:', processedMessages.length);

    // Use Anthropic SDK streaming
    // Wrap user messages in XML tags for prompt injection mitigation
    // Enable prompt caching for the system prompt (90% cost reduction on cache hits)
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512, // Reduced to encourage brevity
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: processedMessages.map((m) => ({
        role: m.role,
        content:
          m.role === 'user'
            ? `<user_message>${escapeXml(m.content)}</user_message>`
            : m.content,
      })),
    });

    // Convert to ReadableStream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
          console.log('[chat] Stream completed');

          // Save to Blob after stream completes (fire-and-forget)
          if (isValidSessionId && isValidSessionStartedAt) {
            const fullConversation = [
              ...messages,
              { role: 'assistant' as const, content: fullResponse },
            ];
            saveConversationToBlob(sessionId, sessionStartedAt, fullConversation).catch(
              (err) => console.warn('[chat] Failed to save conversation:', err)
            );
          }
          // Log usage metrics for cost tracking (fire-and-forget)
          try {
            const finalMessage = await stream.finalMessage();
            const usage = finalMessage.usage;
            console.log(JSON.stringify({
              type: 'api_usage',
              timestamp: new Date().toISOString(),
              sessionId: isValidSessionId ? `sess_${sessionId.slice(0, 8)}` : 'anon',
              endpoint: 'chat',
              model: 'claude-sonnet-4-20250514',
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cacheCreation: usage.cache_creation_input_tokens ?? 0,
              cacheRead: usage.cache_read_input_tokens ?? 0,
            }));

            // Log to Vercel Blob for usage dashboard (fire-and-forget)
            logUsage(isValidSessionId ? sessionId : 'anonymous', {
              endpoint: 'chat',
              model: 'claude-sonnet-4-20250514',
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cacheCreation: usage.cache_creation_input_tokens ?? 0,
              cacheRead: usage.cache_read_input_tokens ?? 0,
              durationMs: Date.now() - startTime,
            }).catch((err) => console.warn('[chat] Failed to log usage to blob:', err));
          } catch (usageError) {
            console.warn('[chat] Failed to log usage:', usageError);
          }
        } catch (error) {
          // Categorize Anthropic API errors for better observability
          if (error instanceof Anthropic.APIError) {
            if (error.status === 429) {
              console.warn(JSON.stringify({
                event: 'anthropic.rate_limited',
                endpoint: '/api/chat',
                retryAfter: error.headers?.['retry-after'],
              }));
            } else if (error.status >= 500) {
              console.error(JSON.stringify({
                event: 'anthropic.server_error',
                endpoint: '/api/chat',
                status: error.status,
                message: error.message,
              }));
            } else {
              console.error(JSON.stringify({
                event: 'anthropic.api_error',
                endpoint: '/api/chat',
                status: error.status,
                message: error.message,
              }));
            }
          } else {
            console.error('[chat] Stream error:', error);
          }
          // Log error for anomaly detection
          console.log(JSON.stringify({
            type: 'api_usage_error',
            timestamp: new Date().toISOString(),
            sessionId: isValidSessionId ? `sess_${sessionId.slice(0, 8)}` : 'anon',
            endpoint: 'chat',
            error: error instanceof Error ? error.message : 'Unknown',
          }));
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('[chat] Error:', error);
    return Response.json(
      { error: 'Chat service error.' },
      { status: 500 }
    );
  }
}
