/**
 * API audit logging helper.
 *
 * Simplifies audit logging for API routes with consistent API key context.
 */

import { logAdminEvent } from '@/lib/audit-server';
import type { ApiKey } from '@/lib/types/api-key';
import type { AuditEventType } from '@/lib/types/audit-event';

/**
 * Log an API access event with API key context.
 *
 * @param eventType - The type of audit event
 * @param apiKey - The authenticated API key
 * @param details - Additional event details
 * @param ip - Client IP address
 */
export async function logApiAccess(
  eventType: AuditEventType,
  apiKey: ApiKey,
  details: Record<string, unknown>,
  ip: string
): Promise<void> {
  await logAdminEvent(eventType, details, ip, {
    accessType: 'api',
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
  });
}
