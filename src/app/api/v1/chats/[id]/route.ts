import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Validate that URL belongs to our Vercel Blob storage
function isValidBlobUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.blob.vercel-storage.com') &&
      url.pathname.includes('/damilola.tech/chats/')
    );
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const { id } = await params;
    let blobUrl: string;
    try {
      blobUrl = decodeURIComponent(id);
    } catch {
      return Errors.badRequest('Invalid chat URL encoding');
    }

    // Validate URL to prevent SSRF attacks
    if (!isValidBlobUrl(blobUrl)) {
      return Errors.badRequest('Invalid chat URL');
    }

    // Fetch the blob content
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return Errors.notFound('Chat not found');
    }

    const data = await response.json();

    // Log chat access with API context
    await logAdminEvent('admin_chat_viewed', { chatUrl: blobUrl }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[api/v1/chats/[id]] Error fetching chat:', error);
    return Errors.internalError('Failed to fetch chat');
  }
}
