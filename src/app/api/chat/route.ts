import Anthropic from '@anthropic-ai/sdk';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';
import { saveConversationToBlob } from '@/lib/chat-storage-server';
import { compactConversation } from '@/lib/chat-compaction';

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

export async function POST(req: Request) {
  console.log('[chat] Request received');
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    const { messages, sessionId, sessionStartedAt } = await req.json();

    // Validate session identifiers to prevent path injection
    const isValidSessionId =
      typeof sessionId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    const isValidSessionStartedAt =
      typeof sessionStartedAt === 'string' && !Number.isNaN(Date.parse(sessionStartedAt));

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
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512, // Reduced to encourage brevity
      system: systemPrompt,
      messages: processedMessages.map((m) => ({
        role: m.role,
        content: m.content,
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
        } catch (error) {
          console.error('[chat] Stream error:', error);
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
