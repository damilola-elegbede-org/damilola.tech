import { NextResponse } from 'next/server';
import { fetchAiContext } from '@/lib/blob';
import { parseAiContext } from '@/lib/parse-ai-context';
import type { AiContext } from '@/types';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse<Record<string, AiContext> | { error: string }>> {
  try {
    const markdown = await fetchAiContext();
    const contextMap = parseAiContext(markdown);

    // Convert Map to plain object for JSON serialization
    const contextObject: Record<string, AiContext> = {};
    contextMap.forEach((value, key) => {
      contextObject[key] = value;
    });

    return NextResponse.json(contextObject, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching AI context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI context' },
      { status: 500 }
    );
  }
}
