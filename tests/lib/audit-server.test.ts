import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAdminEvent } from '@/lib/audit-server';
import type { AuditEventType } from '@/lib/types/audit-event';

// Mock @vercel/blob
const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

// Mock crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
const mockRandomUUID = vi.fn();
const originalVercelEnv = process.env.VERCEL_ENV;

describe('audit-server', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test' });
    mockRandomUUID.mockReturnValue('12345678-90ab-cdef-1234-567890abcdef');
    crypto.randomUUID = mockRandomUUID;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-28T14:30:00.000Z'));
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  describe('logAdminEvent', () => {
    it('creates audit record in blob storage', async () => {
      const eventType: AuditEventType = 'admin_login_success';
      const metadata = { username: 'admin', method: 'password' };
      const ip = '192.168.1.100';

      await logAdminEvent(eventType, metadata, ip);

      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut).toHaveBeenCalledWith(
        'damilola.tech/audit/development/2025-01-28/2025-01-28T14-30-00.000Z-admin_login_success.json',
        expect.any(String),
        expect.objectContaining({
          access: 'public',
          addRandomSuffix: true,
        })
      );
    });

    it('creates correct audit record structure', async () => {
      const eventType: AuditEventType = 'admin_audit_accessed';
      const metadata = { filters: { environment: 'production' }, count: 42 };
      const ip = '192.168.1.100';

      await logAdminEvent(eventType, metadata, ip);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload).toMatchObject({
        version: 1,
        eventId: '2025-01-28T14-30-00.000Z-12345678',
        eventType: 'admin_audit_accessed',
        environment: 'development',
        timestamp: '2025-01-28T14:30:00.000Z',
        path: '/admin',
        metadata: {
          filters: { environment: 'production' },
          count: 42,
          ip: '192.168.1.0',
        },
      });
    });

    it('handles different event types', async () => {
      const eventTypes: AuditEventType[] = [
        'admin_login_success',
        'admin_login_failure',
        'admin_logout',
        'admin_chat_viewed',
        'admin_assessment_viewed',
        'admin_audit_accessed',
        'admin_resume_generation_viewed',
      ];

      for (const eventType of eventTypes) {
        mockPut.mockClear();
        await logAdminEvent(eventType, { action: 'test' }, '10.0.0.1');

        expect(mockPut).toHaveBeenCalledTimes(1);
        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.eventType).toBe(eventType);
      }
    });

    it('includes timestamp in ISO format', async () => {
      const eventType: AuditEventType = 'admin_login_success';
      const metadata = { test: true };
      const ip = '192.168.1.1';

      await logAdminEvent(eventType, metadata, ip);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.timestamp).toBe('2025-01-28T14:30:00.000Z');
      expect(new Date(savedPayload.timestamp).toISOString()).toBe('2025-01-28T14:30:00.000Z');
    });

    it('includes eventId with timestamp and UUID prefix', async () => {
      const eventType: AuditEventType = 'admin_logout';
      const metadata = {};
      const ip = '10.0.0.1';

      await logAdminEvent(eventType, metadata, ip);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.eventId).toBe('2025-01-28T14-30-00.000Z-12345678');
    });

    it('anonymizes IPv4 addresses by zeroing last octet', async () => {
      const testCases = [
        { input: '192.168.1.100', expected: '192.168.1.0' },
        { input: '10.0.0.1', expected: '10.0.0.0' },
        { input: '172.16.254.255', expected: '172.16.254.0' },
        { input: '8.8.8.8', expected: '8.8.8.0' },
      ];

      for (const { input, expected } of testCases) {
        mockPut.mockClear();
        await logAdminEvent('admin_login_success', {}, input);

        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.metadata.ip).toBe(expected);
      }
    });

    it('anonymizes IPv6 addresses by zeroing last 80 bits', async () => {
      const testCases = [
        { input: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', expected: '2001:0db8:85a3:0:0:0:0:0' },
        { input: '::1', expected: '::1:0:0:0:0:0' },
        { input: 'fe80::1', expected: 'fe80::1:0:0:0:0:0' },
        { input: '2001:db8::1', expected: '2001:db8::0:0:0:0:0' },
      ];

      for (const { input, expected } of testCases) {
        mockPut.mockClear();
        await logAdminEvent('admin_login_success', {}, input);

        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.metadata.ip).toBe(expected);
      }
    });

    it('handles special IP values', async () => {
      const testCases = [
        { input: 'unknown', expected: 'unknown' },
        { input: '', expected: 'unknown' },
        { input: '192.168', expected: 'unknown' }, // Invalid format
        { input: 'not-an-ip', expected: 'unknown' },
      ];

      for (const { input, expected } of testCases) {
        mockPut.mockClear();
        await logAdminEvent('admin_login_success', {}, input);

        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.metadata.ip).toBe(expected);
      }
    });

    it('uses VERCEL_ENV for environment when available', async () => {
      const originalEnv = process.env.VERCEL_ENV;
      process.env.VERCEL_ENV = 'production';

      try {
        await logAdminEvent('admin_login_success', {}, '10.0.0.1');

        expect(mockPut).toHaveBeenCalledWith(
          'damilola.tech/audit/production/2025-01-28/2025-01-28T14-30-00.000Z-admin_login_success.json',
          expect.any(String),
          expect.any(Object)
        );

        const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
        expect(savedPayload.environment).toBe('production');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.VERCEL_ENV;
        } else {
          process.env.VERCEL_ENV = originalEnv;
        }
      }
    });

    it('includes metadata with anonymized IP', async () => {
      const eventType: AuditEventType = 'admin_chat_viewed';
      const metadata = {
        sessionId: 'test-session',
        messageCount: 5,
        customField: 'value',
      };
      const ip = '192.168.1.100';

      await logAdminEvent(eventType, metadata, ip);

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.metadata).toMatchObject({
        sessionId: 'test-session',
        messageCount: 5,
        customField: 'value',
        ip: '192.168.1.0',
      });
    });

    it('uses addRandomSuffix true for unique audit logs', async () => {
      await logAdminEvent('admin_login_success', {}, '10.0.0.1');

      const options = mockPut.mock.calls[0][2];
      expect(options.addRandomSuffix).toBe(true);
    });

    it('organizes logs by environment and date', async () => {
      const originalEnv = process.env.VERCEL_ENV;

      // Test development
      process.env.VERCEL_ENV = 'development';
      await logAdminEvent('admin_login_success', {}, '10.0.0.1');
      expect(mockPut.mock.calls[0][0]).toBe(
        'damilola.tech/audit/development/2025-01-28/2025-01-28T14-30-00.000Z-admin_login_success.json'
      );

      // Test preview
      mockPut.mockClear();
      process.env.VERCEL_ENV = 'preview';
      await logAdminEvent('admin_logout', {}, '10.0.0.2');
      expect(mockPut.mock.calls[0][0]).toBe(
        'damilola.tech/audit/preview/2025-01-28/2025-01-28T14-30-00.000Z-admin_logout.json'
      );

      // Test production
      mockPut.mockClear();
      process.env.VERCEL_ENV = 'production';
      await logAdminEvent('admin_audit_accessed', {}, '10.0.0.3');
      expect(mockPut.mock.calls[0][0]).toBe(
        'damilola.tech/audit/production/2025-01-28/2025-01-28T14-30-00.000Z-admin_audit_accessed.json'
      );

      // Restore
      if (originalEnv === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = originalEnv;
      }
    });

    it('does not throw when blob storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPut.mockRejectedValue(new Error('Blob storage error'));

      await expect(
        logAdminEvent('admin_login_success', {}, '192.168.1.1')
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[audit-server] Failed to log event:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('logs error to console when blob storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const storageError = new Error('Network timeout');
      mockPut.mockRejectedValue(storageError);

      await logAdminEvent('admin_login_failure', { reason: 'invalid_password' }, '10.0.0.1');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[audit-server] Failed to log event:',
        storageError
      );

      consoleSpy.mockRestore();
    });

    it('handles empty metadata object', async () => {
      await logAdminEvent('admin_logout', {}, '192.168.1.1');

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.metadata).toMatchObject({
        ip: '192.168.1.0',
      });
    });

    it('preserves metadata with nested objects', async () => {
      const metadata = {
        user: {
          id: 'user-123',
          role: 'admin',
        },
        action: {
          type: 'view',
          target: 'sensitive-data',
        },
      };

      await logAdminEvent('admin_audit_accessed', metadata, '10.0.0.1');

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.metadata).toMatchObject({
        user: {
          id: 'user-123',
          role: 'admin',
        },
        action: {
          type: 'view',
          target: 'sensitive-data',
        },
        ip: '10.0.0.0',
      });
    });

    it('handles metadata with arrays', async () => {
      const metadata = {
        filters: ['production', 'preview'],
        tags: [1, 2, 3],
      };

      await logAdminEvent('admin_audit_accessed', metadata, '172.16.0.1');

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.metadata.filters).toEqual(['production', 'preview']);
      expect(savedPayload.metadata.tags).toEqual([1, 2, 3]);
    });

    it('uses correct path structure with /admin path', async () => {
      await logAdminEvent('admin_chat_viewed', {}, '10.0.0.1');

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.path).toBe('/admin');
    });

    it('sets version to 1', async () => {
      await logAdminEvent('admin_login_success', {}, '10.0.0.1');

      const savedPayload = JSON.parse(mockPut.mock.calls[0][1] as string);
      expect(savedPayload.version).toBe(1);
    });

    it('formats timestamp with hyphens in filename', async () => {
      vi.setSystemTime(new Date('2025-12-31T23:59:59.999Z'));

      await logAdminEvent('admin_logout', {}, '10.0.0.1');

      expect(mockPut.mock.calls[0][0]).toContain('2025-12-31T23-59-59.999Z');
    });

    it('handles concurrent event logging', async () => {
      const promises = [
        logAdminEvent('admin_login_success', { user: 'user1' }, '10.0.0.1'),
        logAdminEvent('admin_login_success', { user: 'user2' }, '10.0.0.2'),
        logAdminEvent('admin_logout', { user: 'user3' }, '10.0.0.3'),
      ];

      await Promise.all(promises);

      expect(mockPut).toHaveBeenCalledTimes(3);
      const payloads = mockPut.mock.calls.map((call) => JSON.parse(call[1] as string));
      expect(payloads[0].metadata.user).toBe('user1');
      expect(payloads[1].metadata.user).toBe('user2');
      expect(payloads[2].metadata.user).toBe('user3');
    });
  });
});
