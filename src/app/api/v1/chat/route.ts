import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';
import { logUsage } from '@/lib/usage-logger';

export const runtime = 'nodejs';

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const isGeneratedPromptAvailable = CHATBOT_SYSTEM_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 200;
const MAX_BODY_SIZE = 500 * 1024;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0) return false; // Empty array is invalid
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: Request) {
  console.log('[api/v1/chat] Request received');
  const startTime = Date.now();

  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    let messages;
    try {
      const body = await req.json();
      messages = body.messages;
    } catch {
      return Errors.badRequest('Invalid JSON in request body.');
    }

    if (!validateMessages(messages)) {
      return Errors.validationError('Invalid messages format or content too long.');
    }

    const basePrompt = isGeneratedPromptAvailable
      ? CHATBOT_SYSTEM_PROMPT
      : await getFullSystemPrompt();

    const brevityPrefix = `CRITICAL: Keep responses SHORT. Default: 2-4 sentences. Simple factual questions: 1-2 sentences. Only use STAR format for behavioral questions. Never volunteer extra context unless asked.\n\n`;
    const systemPrompt = brevityPrefix + basePrompt;

    // Non-streaming API call for JSON response
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: messages.map((m) => ({
        role: m.role,
        content:
          m.role === 'user'
            ? `<user_message>${escapeXml(m.content)}</user_message>`
            : m.content,
      })),
    });

    const chatSessionId = `chat-api-${crypto.randomUUID()}`;
    const usage = response.usage;

    console.log(JSON.stringify({
      type: 'api_usage',
      timestamp: new Date().toISOString(),
      sessionId: chatSessionId,
      endpoint: 'chat-api',
      model: 'claude-sonnet-4-20250514',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    }));

    logUsage(chatSessionId, {
      endpoint: 'chat-api',
      model: 'claude-sonnet-4-20250514',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      durationMs: Date.now() - startTime,
      cacheTtl: '1h',
    }).catch((err) => console.warn('[api/v1/chat] Failed to log usage:', err));

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    return apiSuccess({
      message: {
        role: 'assistant',
        content: responseText,
      },
      model: response.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error('[api/v1/chat] Error:', error);
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return Errors.rateLimited(60);
      }
    }
    return Errors.internalError('Chat service error.');
  }
}
