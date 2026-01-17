import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'edge';

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = SYSTEM_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;
// Maximum request body size: 50 messages * 2000 chars + overhead ≈ 150KB
const MAX_BODY_SIZE = 150 * 1024;

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
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = await req.json();

    if (!validateMessages(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format or content too long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use build-time generated prompt (production) or fetch at runtime (development)
    const systemPrompt = isGeneratedPromptAvailable
      ? SYSTEM_PROMPT
      : await getFullSystemPrompt();

    // Stream response
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
