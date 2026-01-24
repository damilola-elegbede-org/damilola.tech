import { cookies } from 'next/headers';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

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
  const ip = getClientIp(req);

  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const blobUrl = decodeURIComponent(id);

    // Validate URL to prevent SSRF attacks
    if (!isValidBlobUrl(blobUrl)) {
      return Response.json({ error: 'Invalid chat URL' }, { status: 400 });
    }

    // Fetch the blob content
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }

    const data = await response.json();

    // Log chat access
    await logAdminEvent('admin_chat_viewed', { chatUrl: blobUrl }, ip);

    return Response.json(data);
  } catch (error) {
    console.error('[admin/chats/[id]] Error fetching chat:', error);
    return Response.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}
