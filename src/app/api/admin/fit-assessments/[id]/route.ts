export const runtime = 'nodejs';

// Validate that URL belongs to our Vercel Blob storage
function isValidBlobUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.blob.vercel-storage.com') &&
      url.pathname.includes('/damilola.tech/fit-assessments/')
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
      return Response.json({ error: 'Invalid assessment URL' }, { status: 400 });
    }

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
