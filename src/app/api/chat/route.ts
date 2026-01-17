import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { getFullSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'edge';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;

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
    const { messages } = await req.json();

    if (!validateMessages(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format or content too long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get full system prompt (resume + STAR stories + guidelines)
    // This is fetched from Vercel Blob and cached in memory
    const systemPrompt = await getFullSystemPrompt();

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
