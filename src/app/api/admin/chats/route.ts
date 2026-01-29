import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { parseChatFilename } from '@/lib/chat-filename';

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
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const prefix = `${CHATS_PREFIX}${environment}/`;
    const result = await list({ prefix, cursor, limit });

    const chats: ChatSummary[] = result.blobs
      // Filter out zero-byte files
      .filter((blob) => blob.size > 0)
      .map((blob) => {
        const filename = blob.pathname.split('/').pop() || '';
        const parsed = parseChatFilename(filename, blob.uploadedAt?.toISOString());

        if (!parsed) {
          return null;
        }

        return {
          id: blob.pathname,
          pathname: blob.pathname,
          sessionId: parsed.sessionId,
          environment,
          timestamp: parsed.timestamp || '',
          size: blob.size,
          url: blob.url,
        };
      })
      // Filter out entries that couldn't be parsed
      .filter((chat): chat is ChatSummary => chat !== null);

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
