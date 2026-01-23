export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blobUrl = decodeURIComponent(id);

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
