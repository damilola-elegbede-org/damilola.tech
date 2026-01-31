import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  getApiKeyById,
  updateApiKey,
  revokeApiKey,
  isApiKeyStorageAvailable,
} from '@/lib/api-key-storage';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/api-keys/[id]
 * Get a single API key by ID.
 */
export async function GET(req: Request, context: RouteContext) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isApiKeyStorageAvailable()) {
    return Response.json(
      { error: 'API key storage not available.' },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;
    const apiKey = await getApiKeyById(id);

    if (!apiKey) {
      return Response.json({ error: 'API key not found' }, { status: 404 });
    }

    // Return without sensitive keyHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash: _keyHash, ...safeKey } = apiKey;
    return Response.json({ key: safeKey });
  } catch (error) {
    console.error('[admin/api-keys/[id]] Error getting key:', error);
    return Response.json({ error: 'Failed to get API key' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/api-keys/[id]
 * Update an API key (enable/disable, name, description).
 */
export async function PATCH(req: Request, context: RouteContext) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isApiKeyStorageAvailable()) {
    return Response.json(
      { error: 'API key storage not available.' },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { name, description, enabled } = body;

    // Validate inputs
    const updates: { name?: string; description?: string; enabled?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return Response.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return Response.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 500) {
        return Response.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
      }
      updates.description = description.trim();
    }

    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return Response.json({ error: 'Enabled must be a boolean' }, { status: 400 });
      }
      updates.enabled = enabled;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Get current key to check state
    const currentKey = await getApiKeyById(id);
    if (!currentKey) {
      return Response.json({ error: 'API key not found' }, { status: 404 });
    }

    if (currentKey.revokedAt) {
      return Response.json({ error: 'Cannot update a revoked key' }, { status: 400 });
    }

    // Update the key
    const updatedKey = await updateApiKey(id, updates);
    if (!updatedKey) {
      return Response.json({ error: 'Failed to update API key' }, { status: 500 });
    }

    // Log enable/disable events
    const ip = getClientIp(req);
    if (enabled !== undefined && enabled !== currentKey.enabled) {
      const eventType = enabled ? 'api_key_enabled' : 'api_key_disabled';
      await logAdminEvent(eventType, { keyId: id, keyName: updatedKey.name }, ip, {
        accessType: 'browser',
      });
    }

    // Return without sensitive keyHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash: _keyHash, ...safeKey } = updatedKey;
    return Response.json({ key: safeKey });
  } catch (error) {
    console.error('[admin/api-keys/[id]] Error updating key:', error);
    return Response.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/api-keys/[id]
 * Revoke an API key (soft delete).
 */
export async function DELETE(req: Request, context: RouteContext) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isApiKeyStorageAvailable()) {
    return Response.json(
      { error: 'API key storage not available.' },
      { status: 503 }
    );
  }

  try {
    const { id } = await context.params;

    // Get current key first
    const currentKey = await getApiKeyById(id);
    if (!currentKey) {
      return Response.json({ error: 'API key not found' }, { status: 404 });
    }

    if (currentKey.revokedAt) {
      return Response.json({ error: 'API key already revoked' }, { status: 400 });
    }

    // Revoke the key
    const revokedKey = await revokeApiKey(id);
    if (!revokedKey) {
      return Response.json({ error: 'Failed to revoke API key' }, { status: 500 });
    }

    // Log the revocation
    const ip = getClientIp(req);
    await logAdminEvent('api_key_revoked', { keyId: id, keyName: revokedKey.name }, ip, {
      accessType: 'browser',
    });

    // Return without sensitive keyHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keyHash: _keyHash, ...safeKey } = revokedKey;
    return Response.json({ key: safeKey, message: 'API key revoked' });
  } catch (error) {
    console.error('[admin/api-keys/[id]] Error revoking key:', error);
    return Response.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
