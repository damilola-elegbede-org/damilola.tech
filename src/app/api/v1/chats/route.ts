import { list } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
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
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 100);
    const cursor = searchParams.get('cursor') || undefined;

    const prefix = `${CHATS_PREFIX}${environment}/`;
    const result = await list({ prefix, cursor, limit });

    const chats: ChatSummary[] = result.blobs
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
      .filter((chat): chat is ChatSummary => chat !== null);

    return apiSuccess(
      { chats },
      {
        environment,
        pagination: {
          cursor: result.cursor || undefined,
          hasMore: result.hasMore,
        },
      }
    );
  } catch (error) {
    console.error('[api/v1/chats] Error listing chats:', error);
    return Errors.internalError('Failed to list chats');
  }
}
