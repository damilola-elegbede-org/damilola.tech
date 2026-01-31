/**
 * API Key storage module using Upstash Redis.
 *
 * Keys are stored with a SHA-256 hash for security.
 * Raw keys are never stored - only shown once at creation.
 */

import { Redis } from '@upstash/redis';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { ApiKey } from '@/lib/types/api-key';
import { API_KEY_PREFIX, API_KEY_ENV_LIVE, API_KEY_ENV_TEST } from '@/lib/types/api-key';

// Redis key prefixes
const APIKEY_PREFIX = 'apikey:';
const APIKEY_HASH_INDEX = 'apikey:hash:';
const APIKEY_LIST = 'apikey:list';

// Check if Redis is configured
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Lazy-init Redis client
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    if (!useRedis) {
      throw new Error('Redis not configured. API keys require UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

/**
 * Generate a cryptographically secure API key.
 * Format: dk_{env}_{32-char-random}
 * Example: dk_live_7Hx9mK2pQ4rL5sT8wY1aB3cD6eF0gH1i
 */
export function generateApiKey(isProduction = true): { rawKey: string; keyHash: string; keyPrefix: string } {
  const env = isProduction ? API_KEY_ENV_LIVE : API_KEY_ENV_TEST;
  const randomPart = randomBytes(24).toString('base64url').slice(0, 32);
  const rawKey = `${API_KEY_PREFIX}${env}_${randomPart}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 16);

  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Timing-safe comparison of API key hashes.
 */
export function verifyApiKeyHash(rawKey: string, expectedHash: string): boolean {
  const providedHash = hashApiKey(rawKey);
  const providedBuffer = Buffer.from(providedHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Store a new API key in Redis.
 */
export async function storeApiKey(
  name: string,
  keyHash: string,
  keyPrefix: string,
  description?: string
): Promise<ApiKey> {
  const client = getRedis();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const apiKey: ApiKey = {
    id,
    name,
    description,
    keyHash,
    keyPrefix,
    enabled: true,
    createdAt: now,
  };

  // Store key metadata
  await client.set(`${APIKEY_PREFIX}${id}`, JSON.stringify(apiKey));

  // Create hash index for lookup during authentication
  await client.set(`${APIKEY_HASH_INDEX}${keyHash}`, id);

  // Add to list of all keys
  await client.sadd(APIKEY_LIST, id);

  return apiKey;
}

/**
 * Get an API key by its hash (for authentication).
 */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const client = getRedis();

  // Look up ID from hash index
  const id = await client.get<string>(`${APIKEY_HASH_INDEX}${keyHash}`);
  if (!id) {
    return null;
  }

  // Get full key data
  const data = await client.get<string>(`${APIKEY_PREFIX}${id}`);
  if (!data) {
    return null;
  }

  return typeof data === 'string' ? JSON.parse(data) : data;
}

/**
 * Get an API key by its ID.
 */
export async function getApiKeyById(id: string): Promise<ApiKey | null> {
  const client = getRedis();

  const data = await client.get<string>(`${APIKEY_PREFIX}${id}`);
  if (!data) {
    return null;
  }

  return typeof data === 'string' ? JSON.parse(data) : data;
}

/**
 * List all API keys (for admin UI).
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const client = getRedis();

  // Get all key IDs
  const ids = await client.smembers(APIKEY_LIST);
  if (!ids || ids.length === 0) {
    return [];
  }

  // Fetch all keys in parallel
  const keys = await Promise.all(
    ids.map(async (id) => {
      const data = await client.get<string>(`${APIKEY_PREFIX}${id}`);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    })
  );

  // Filter out nulls and sort by createdAt descending
  return keys
    .filter((key): key is ApiKey => key !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Update an API key (enable/disable).
 */
export async function updateApiKey(
  id: string,
  updates: Partial<Pick<ApiKey, 'name' | 'description' | 'enabled'>>
): Promise<ApiKey | null> {
  const client = getRedis();

  // Get existing key
  const existing = await getApiKeyById(id);
  if (!existing) {
    return null;
  }

  // Don't allow updating revoked keys
  if (existing.revokedAt) {
    return null;
  }

  // Apply updates
  const updated: ApiKey = {
    ...existing,
    ...updates,
  };

  // Store updated key
  await client.set(`${APIKEY_PREFIX}${id}`, JSON.stringify(updated));

  return updated;
}

/**
 * Revoke an API key (soft delete).
 */
export async function revokeApiKey(id: string): Promise<ApiKey | null> {
  const client = getRedis();

  // Get existing key
  const existing = await getApiKeyById(id);
  if (!existing) {
    return null;
  }

  // Already revoked
  if (existing.revokedAt) {
    return existing;
  }

  // Mark as revoked
  const updated: ApiKey = {
    ...existing,
    enabled: false,
    revokedAt: new Date().toISOString(),
  };

  // Store updated key
  await client.set(`${APIKEY_PREFIX}${id}`, JSON.stringify(updated));

  return updated;
}

/**
 * Update the lastUsedAt timestamp for an API key.
 */
export async function updateApiKeyLastUsed(id: string): Promise<void> {
  const client = getRedis();

  const existing = await getApiKeyById(id);
  if (!existing) {
    return;
  }

  const updated: ApiKey = {
    ...existing,
    lastUsedAt: new Date().toISOString(),
  };

  await client.set(`${APIKEY_PREFIX}${id}`, JSON.stringify(updated));
}

/**
 * Check if Redis is available for API key storage.
 */
export function isApiKeyStorageAvailable(): boolean {
  return useRedis;
}
