/**
 * Server-side audit logging for API routes.
 *
 * API routes cannot use client-side fetch to self, so this module
 * writes directly to Vercel Blob storage.
 */

import { put } from '@vercel/blob';
import type { AuditEventType } from '@/lib/types/audit-event';

const AUDIT_PREFIX = 'damilola.tech/audit';

/**
 * Log an admin event directly to Vercel Blob storage.
 * Used by API routes that cannot call the /api/audit endpoint.
 */
export async function logAdminEvent(
  eventType: AuditEventType,
  metadata: Record<string, unknown>,
  ip: string
): Promise<void> {
  try {
    const environment = process.env.VERCEL_ENV || 'development';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/:/g, '-');
    const eventId = `${timestamp}-${crypto.randomUUID().slice(0, 8)}`;

    const event = {
      version: 1,
      eventId,
      eventType,
      environment,
      timestamp: now.toISOString(),
      path: '/admin',
      metadata: {
        ...metadata,
        ip,
      },
    };

    const pathname = `${AUDIT_PREFIX}/${environment}/${dateStr}/${timestamp}-${eventType}.json`;

    await put(pathname, JSON.stringify(event), {
      access: 'public',
      addRandomSuffix: true,
    });
  } catch (error) {
    // Log but don't throw - audit logging should not break the main flow
    console.error('[audit-server] Failed to log event:', error);
  }
}
