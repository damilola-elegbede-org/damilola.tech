import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';
import type { ResumeGenerationLog } from '@/lib/types/resume-generation';

export const runtime = 'nodejs';

const ALLOWED_BLOB_HOSTS = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
];

function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_BLOB_HOSTS.some(host => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(id);
  } catch {
    return Errors.badRequest('Invalid blob URL encoding');
  }

  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  // Validate URL is from allowed blob storage domain (SSRF protection)
  if (!isValidBlobUrl(decodedUrl)) {
    return Errors.badRequest('Invalid blob URL');
  }

  try {
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Errors.notFound('Generation not found');
    }

    const data: ResumeGenerationLog = await response.json();

    // Log access with API context
    await logAdminEvent('admin_resume_generation_viewed', { generationUrl: decodedUrl }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[api/v1/resume-generations/[id]] Error:', error);
    return Errors.internalError('Failed to fetch generation');
  }
}
