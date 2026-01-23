export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blobUrl = decodeURIComponent(id);

    const response = await fetch(blobUrl);
    if (!response.ok) {
      return Response.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('[admin/fit-assessments/[id]] Error fetching assessment:', error);
    return Response.json({ error: 'Failed to fetch assessment' }, { status: 500 });
  }
}
