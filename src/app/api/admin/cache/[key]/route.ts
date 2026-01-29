import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  readAdminCache,
  writeAdminCache,
  CACHE_KEYS,
  type CacheKey,
} from '@/lib/admin-cache';

export const runtime = 'nodejs';

// Valid cache keys
const VALID_KEYS = new Set(Object.values(CACHE_KEYS));

function isValidCacheKey(key: string): key is CacheKey {
  return VALID_KEYS.has(key as CacheKey);
}

/**
 * GET /api/admin/cache/[key]
 * Returns cached data from Vercel Blob.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;

  if (!isValidCacheKey(key)) {
    return Response.json({ error: 'Invalid cache key' }, { status: 400 });
  }

  try {
    const cached = await readAdminCache(key);

    if (!cached) {
      return Response.json({ error: 'Cache miss' }, { status: 404 });
    }

    return Response.json(cached);
  } catch (error) {
    console.error(`[admin/cache/${key}] Error reading cache:`, error);
    return Response.json({ error: 'Failed to read cache' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/cache/[key]
 * Updates cache in Vercel Blob.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key } = await params;

  if (!isValidCacheKey(key)) {
    return Response.json({ error: 'Invalid cache key' }, { status: 400 });
  }

  // Validate Content-Type before parsing
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return Response.json({ error: 'Content-Type must be application/json' }, { status: 400 });
  }

  // Pre-parse size guard using Content-Length
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > 5 * 1024 * 1024) {
    return Response.json({ error: 'Request body too large' }, { status: 413 });
  }

  // Parse JSON with error handling
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  // Validate body structure
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const { data, dateRange } = body as { data?: unknown; dateRange?: unknown };

  // Validate data field exists and is an object
  if (!data || typeof data !== 'object') {
    return Response.json({ error: 'Missing or invalid data field' }, { status: 400 });
  }

  // Validate dateRange structure if provided
  if (dateRange !== undefined) {
    if (
      typeof dateRange !== 'object' ||
      dateRange === null ||
      typeof (dateRange as { start?: unknown }).start !== 'string' ||
      typeof (dateRange as { end?: unknown }).end !== 'string'
    ) {
      return Response.json({ error: 'Invalid dateRange format' }, { status: 400 });
    }
  }

  // Serialize once for both size check and storage
  const serializedData = JSON.stringify(data);
  if (serializedData.length > 5 * 1024 * 1024) {
    return Response.json({ error: 'Data too large (max 5MB)' }, { status: 400 });
  }

  try {
    await writeAdminCache(key, data, dateRange as { start: string; end: string } | undefined);

    return Response.json({ success: true });
  } catch (error) {
    console.error(`[admin/cache/${key}] Error writing cache:`, error);
    return Response.json({ error: 'Failed to write cache' }, { status: 500 });
  }
}
