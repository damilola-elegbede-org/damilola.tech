/**
 * API Key authentication for external API access.
 *
 * Accepts: Authorization: Bearer dk_live_xxx OR X-API-Key: dk_live_xxx
 */

import { hashApiKey, getApiKeyByHash, updateApiKeyLastUsed } from '@/lib/api-key-storage';
import type { ApiKey } from '@/lib/types/api-key';
import { API_KEY_PREFIX } from '@/lib/types/api-key';

export interface ApiKeyAuthResult {
  authenticated: boolean;
  apiKey?: ApiKey;
  error?: string;
  statusCode?: number;
}

/**
 * Extract API key from request headers.
 * Supports Authorization: Bearer and X-API-Key headers.
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization: Bearer header first
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith(API_KEY_PREFIX)) {
      return token;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader?.startsWith(API_KEY_PREFIX)) {
    return apiKeyHeader.trim();
  }

  return null;
}

/**
 * Authenticate a request using API key.
 */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  // Extract API key from headers
  const rawKey = extractApiKey(req);

  if (!rawKey) {
    return {
      authenticated: false,
      error: 'API key required. Use Authorization: Bearer dk_xxx or X-API-Key: dk_xxx header.',
      statusCode: 401,
    };
  }

  // Validate key format
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return {
      authenticated: false,
      error: 'Invalid API key format.',
      statusCode: 401,
    };
  }

  try {
    // Hash the provided key and look it up
    const keyHash = hashApiKey(rawKey);
    const apiKey = await getApiKeyByHash(keyHash);

    if (!apiKey) {
      return {
        authenticated: false,
        error: 'Invalid API key.',
        statusCode: 401,
      };
    }

    // Check if key is revoked
    if (apiKey.revokedAt) {
      return {
        authenticated: false,
        error: 'API key has been revoked.',
        statusCode: 403,
      };
    }

    // Check if key is disabled
    if (!apiKey.enabled) {
      return {
        authenticated: false,
        error: 'API key is disabled.',
        statusCode: 403,
      };
    }

    // Update last used timestamp (fire and forget)
    updateApiKeyLastUsed(apiKey.id).catch((err) => {
      console.error('[api-key-auth] Failed to update lastUsedAt:', err);
    });

    return {
      authenticated: true,
      apiKey,
    };
  } catch (error) {
    console.error('[api-key-auth] Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed.',
      statusCode: 500,
    };
  }
}

/**
 * Middleware-style function to require API key authentication.
 * Returns null if authenticated, or an error Response if not.
 */
export async function requireApiKey(req: Request): Promise<{ apiKey: ApiKey } | Response> {
  const result = await authenticateApiKey(req);

  if (!result.authenticated) {
    return Response.json(
      {
        success: false,
        error: {
          code: result.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
          message: result.error,
        },
      },
      { status: result.statusCode }
    );
  }

  return { apiKey: result.apiKey! };
}
