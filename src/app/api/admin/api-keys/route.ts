import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  generateApiKey,
  storeApiKey,
  listApiKeys,
  isApiKeyStorageAvailable,
} from '@/lib/api-key-storage';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * GET /api/admin/api-keys
 * List all API keys.
 */
export async function GET() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Redis is available
  if (!isApiKeyStorageAvailable()) {
    return Response.json(
      { error: 'API key storage not available. Redis configuration required.' },
      { status: 503 }
    );
  }

  try {
    const keys = await listApiKeys();

    // Return keys without sensitive data (keyHash is already filtered by type)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safeKeys = keys.map(({ keyHash: _keyHash, ...rest }) => rest);

    return Response.json({ keys: safeKeys });
  } catch (error) {
    console.error('[admin/api-keys] Error listing keys:', error);
    return Response.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

/**
 * POST /api/admin/api-keys
 * Create a new API key.
 */
export async function POST(req: Request) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Redis is available
  if (!isApiKeyStorageAvailable()) {
    return Response.json(
      { error: 'API key storage not available. Redis configuration required.' },
      { status: 503 }
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    if (name.trim().length > 100) {
      return Response.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
    }

    if (description && (typeof description !== 'string' || description.length > 500)) {
      return Response.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
    }

    // Generate new key
    const isProduction = process.env.VERCEL_ENV === 'production';
    const { rawKey, keyHash, keyPrefix } = generateApiKey(isProduction);

    // Store key
    const apiKey = await storeApiKey(name.trim(), keyHash, keyPrefix, description?.trim());

    // Log the creation
    const ip = getClientIp(req);
    await logAdminEvent('api_key_created', { keyId: apiKey.id, keyName: apiKey.name }, ip, {
      accessType: 'browser',
    });

    // Return with raw key (only shown once)
    return Response.json({
      key: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.keyPrefix,
        enabled: apiKey.enabled,
        createdAt: apiKey.createdAt,
      },
      rawKey, // Only returned at creation time!
      warning: 'Store this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[admin/api-keys] Error creating key:', error);
    return Response.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
