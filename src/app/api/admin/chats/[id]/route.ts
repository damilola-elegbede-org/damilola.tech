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
    return Response.json(data);
  } catch (error) {
    console.error('[admin/chats/[id]] Error fetching chat:', error);
    return Response.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}
