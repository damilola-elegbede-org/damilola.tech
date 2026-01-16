import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { getFullSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

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
