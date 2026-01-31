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
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const { id } = await params;

    // Handle malformed percent-encoding in URL
    let blobUrl: string;
    try {
      blobUrl = decodeURIComponent(id);
    } catch {
      return Errors.badRequest('Invalid assessment URL encoding');
    }

    // Validate URL to prevent SSRF attacks
    if (!isValidBlobUrl(blobUrl)) {
      return Errors.badRequest('Invalid assessment URL');
    }

    const response = await fetch(blobUrl);
    if (!response.ok) {
      return Errors.notFound('Assessment not found');
    }

    const data = await response.json();

    // Log assessment access with API context
    await logAdminEvent('admin_assessment_viewed', { assessmentUrl: blobUrl }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[api/v1/fit-assessments/[id]] Error fetching assessment:', error);
    return Errors.internalError('Failed to fetch assessment');
  }
}
