/**
 * API Key types for external integrations (e.g., OpenClaw).
 */

export interface ApiKey {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name (e.g., "OpenClaw Production") */
  name: string;
  /** Optional notes about the key's purpose */
  description?: string;
  /** SHA-256 hash of the key (never store raw key) */
  keyHash: string;
  /** First 16 chars for display (e.g., dk_live_abc123...) */
  keyPrefix: string;
  /** Toggle without deleting */
  enabled: boolean;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 timestamp of last API call */
  lastUsedAt?: string;
  /** ISO 8601 timestamp of soft delete (revoked) */
  revokedAt?: string;
}

/**
 * API Key format: dk_{env}_{32-char-random}
 * Example: dk_live_7Hx9mK2pQ4rL5sT8wY1aB3cD6eF0gH1i
 */
export const API_KEY_PREFIX = 'dk_';
export const API_KEY_ENV_LIVE = 'live';
export const API_KEY_ENV_TEST = 'test';
