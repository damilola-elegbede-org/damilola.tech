import { list } from '@vercel/blob';

export const runtime = 'nodejs';

const CHATS_PREFIX = 'damilola.tech/chats/';

interface ChatSummary {
  id: string;
  pathname: string;
  sessionId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || 'production';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const prefix = `${CHATS_PREFIX}${environment}/`;
    const result = await list({ prefix, cursor, limit });

    const chats: ChatSummary[] = result.blobs.map((blob) => {
      // Extract info from pathname: damilola.tech/chats/{env}/{timestamp}-{uuid}.json
      const filename = blob.pathname.split('/').pop() || '';
      const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]+)/);

      return {
        id: blob.pathname,
        pathname: blob.pathname,
        sessionId: match?.[2] || '',
        environment,
        timestamp: match?.[1]?.replace(/-/g, (m, i) => i > 9 ? ':' : m).replace('Z', '.000Z') || '',
        size: blob.size,
        url: blob.url,
      };
    });

    return Response.json({
      chats,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('[admin/chats] Error listing chats:', error);
    return Response.json({ error: 'Failed to list chats' }, { status: 500 });
  }
}
