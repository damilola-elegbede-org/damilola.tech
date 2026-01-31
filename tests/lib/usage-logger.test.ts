import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PutBlobResult, HeadBlobResult } from '@vercel/blob';

// Mock Vercel Blob functions - use factory function
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
}));

import { calculateCost, calculateCostSavings, logUsage } from '@/lib/usage-logger';
import * as blobModule from '@vercel/blob';

// Helper to create mock PutBlobResult
const mockPutResult = (url: string): PutBlobResult => ({
  url,
  downloadUrl: url,
  pathname: url.split('/').pop() ?? '',
  contentType: 'application/json',
  contentDisposition: 'inline',
});

// Helper to create mock HeadBlobResult
const mockHeadResult = (url: string): HeadBlobResult => ({
  url,
  downloadUrl: url,
  pathname: url.split('/').pop() ?? '',
  contentType: 'application/json',
  contentDisposition: 'inline',
  size: 1024,
  uploadedAt: new Date(),
  cacheControl: 'public, max-age=31536000',
});

describe('calculateCost', () => {
  describe('with known model (claude-sonnet-4-20250514)', () => {
    const model = 'claude-sonnet-4-20250514';

    it('calculates cost for basic request without caching', () => {
      const cost = calculateCost({
        model,
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 0,
        cacheRead: 0,
      });

      // Input: 1000 tokens * $3/M = $0.003
      // Output: 500 tokens * $15/M = $0.0075
      // Total: $0.0105
      expect(cost).toBe(0.0105);
    });

    it('calculates cost with cache read', () => {
      const cost = calculateCost({
        model,
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 0,
        cacheRead: 800,
      });

      // Uncached input: 1000 - 800 = 200 tokens * $3/M = $0.0006
      // Cache read: 800 tokens * $0.30/M = $0.00024
      // Output: 500 tokens * $15/M = $0.0075
      // Total: $0.008340
      expect(cost).toBe(0.00834);
    });

    it('calculates cost with cache creation', () => {
      const cost = calculateCost({
        model,
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 500,
        cacheRead: 0,
      });

      // Input: 1000 tokens * $3/M = $0.003
      // Cache creation: 500 tokens * $6/M = $0.003 (1-hour TTL)
      // Output: 500 tokens * $15/M = $0.0075
      // Total: $0.0135
      expect(cost).toBe(0.0135);
    });

    it('calculates cost with both cache read and creation', () => {
      const cost = calculateCost({
        model,
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 200,
        cacheRead: 600,
      });

      // Uncached input: 1000 - 600 = 400 tokens * $3/M = $0.0012
      // Cache read: 600 tokens * $0.30/M = $0.00018
      // Cache creation: 200 tokens * $6/M = $0.0012 (1-hour TTL)
      // Output: 500 tokens * $15/M = $0.0075
      // Total: $0.01008
      expect(cost).toBe(0.01008);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for zero tokens', () => {
      const cost = calculateCost({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 0,
        outputTokens: 0,
        cacheCreation: 0,
        cacheRead: 0,
      });

      expect(cost).toBe(0);
    });

    it('clamps uncached input to 0 when cacheRead > inputTokens', () => {
      const cost = calculateCost({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 500,
        outputTokens: 100,
        cacheCreation: 0,
        cacheRead: 800, // More than inputTokens
      });

      // Uncached input: max(0, 500 - 800) = 0
      // Cache read: 800 tokens * $0.30/M = $0.00024
      // Output: 100 tokens * $15/M = $0.0015
      // Total: $0.00174
      expect(cost).toBe(0.00174);
    });

    it('handles large token counts', () => {
      const cost = calculateCost({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100000,
        outputTokens: 50000,
        cacheCreation: 10000,
        cacheRead: 80000,
      });

      // Uncached input: 100000 - 80000 = 20000 tokens * $3/M = $0.06
      // Cache read: 80000 tokens * $0.30/M = $0.024
      // Cache creation: 10000 tokens * $6/M = $0.06 (1-hour TTL)
      // Output: 50000 tokens * $15/M = $0.75
      // Total: $0.894
      expect(cost).toBe(0.894);
    });
  });

  describe('fallback pricing for unknown models', () => {
    it('uses fallback pricing for unknown model', () => {
      const costUnknown = calculateCost({
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 0,
        cacheRead: 0,
      });

      const costKnown = calculateCost({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 0,
        cacheRead: 0,
      });

      // Should use claude-sonnet-4-20250514 pricing as fallback
      expect(costUnknown).toBe(costKnown);
    });

    it('uses fallback for empty model string', () => {
      const cost = calculateCost({
        model: '',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 0,
        cacheRead: 0,
      });

      // Should use fallback pricing
      expect(cost).toBe(0.0105);
    });
  });

  describe('precision and rounding', () => {
    it('rounds to 6 decimal places', () => {
      const cost = calculateCost({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1,
        outputTokens: 1,
        cacheCreation: 1,
        cacheRead: 0,
      });

      // Input: 1 token * $3/M = $0.000003
      // Cache creation: 1 token * $6/M = $0.000006 (1-hour TTL)
      // Output: 1 token * $15/M = $0.000015
      // Total: $0.000024, rounded to $0.000024
      expect(cost).toBe(0.000024);
      expect(cost.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    });
  });
});

describe('calculateCostSavings', () => {
  describe('with known model', () => {
    it('calculates savings from cache hits', () => {
      const savings = calculateCostSavings({
        model: 'claude-sonnet-4-20250514',
        cacheRead: 100000,
      });

      // Full cost: 100000 tokens * $3/M = $0.30
      // Cached cost: 100000 tokens * $0.30/M = $0.03
      // Savings: $0.27
      expect(savings).toBe(0.27);
    });

    it('returns 0 for zero cache read', () => {
      const savings = calculateCostSavings({
        model: 'claude-sonnet-4-20250514',
        cacheRead: 0,
      });

      expect(savings).toBe(0);
    });

    it('handles small cache read amounts', () => {
      const savings = calculateCostSavings({
        model: 'claude-sonnet-4-20250514',
        cacheRead: 1000,
      });

      // Full cost: 1000 tokens * $3/M = $0.003
      // Cached cost: 1000 tokens * $0.30/M = $0.0003
      // Savings: $0.0027
      expect(savings).toBe(0.0027);
    });
  });

  describe('fallback pricing', () => {
    it('uses fallback pricing for unknown model', () => {
      const savingsUnknown = calculateCostSavings({
        model: 'unknown-model',
        cacheRead: 100000,
      });

      const savingsKnown = calculateCostSavings({
        model: 'claude-sonnet-4-20250514',
        cacheRead: 100000,
      });

      expect(savingsUnknown).toBe(savingsKnown);
    });
  });

  describe('precision', () => {
    it('rounds to 6 decimal places', () => {
      const savings = calculateCostSavings({
        model: 'claude-sonnet-4-20250514',
        cacheRead: 1,
      });

      // Full cost: 1 token * $3/M = $0.000003
      // Cached cost: 1 token * $0.30/M = $0.0000003
      // Savings: $0.0000027, rounded to $0.000003
      expect(savings).toBe(0.000003);
    });
  });
});

describe('logUsage', () => {
  const mockPut = vi.mocked(blobModule.put);
  const mockHead = vi.mocked(blobModule.head);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API key attribution', () => {
    it('creates session with apiKeyId when provided', async () => {
      // Mock getSession to return null (new session)
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-1',
        {
          endpoint: 'chat-api',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreation: 0,
          cacheRead: 0,
          durationMs: 1500,
        },
        {
          apiKeyId: 'key-abc-123',
        }
      );

      expect(mockPut).toHaveBeenCalledTimes(1);
      const putCall = mockPut.mock.calls[0];
      const sessionData = JSON.parse(putCall[1] as string);

      expect(sessionData.apiKeyId).toBe('key-abc-123');
      expect(sessionData.apiKeyName).toBeUndefined();
      expect(sessionData.sessionId).toBe('test-session-1');
    });

    it('creates session with apiKeyName when provided', async () => {
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-2',
        {
          endpoint: 'fit-assessment-api',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 2000,
          outputTokens: 1000,
          cacheCreation: 500,
          cacheRead: 0,
          durationMs: 2500,
        },
        {
          apiKeyName: 'Production API Key',
        }
      );

      expect(mockPut).toHaveBeenCalledTimes(1);
      const putCall = mockPut.mock.calls[0];
      const sessionData = JSON.parse(putCall[1] as string);

      expect(sessionData.apiKeyId).toBeUndefined();
      expect(sessionData.apiKeyName).toBe('Production API Key');
      expect(sessionData.sessionId).toBe('test-session-2');
    });

    it('creates session with both apiKeyId and apiKeyName when provided', async () => {
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-3',
        {
          endpoint: 'resume-generator',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1500,
          outputTokens: 800,
          cacheCreation: 300,
          cacheRead: 500,
          durationMs: 3000,
        },
        {
          apiKeyId: 'key-def-456',
          apiKeyName: 'Development API Key',
        }
      );

      expect(mockPut).toHaveBeenCalledTimes(1);
      const putCall = mockPut.mock.calls[0];
      const sessionData = JSON.parse(putCall[1] as string);

      expect(sessionData.apiKeyId).toBe('key-def-456');
      expect(sessionData.apiKeyName).toBe('Development API Key');
      expect(sessionData.sessionId).toBe('test-session-3');
    });

    it('creates session without API key fields when not provided', async () => {
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-4',
        {
          endpoint: 'chat',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 500,
          outputTokens: 250,
          cacheCreation: 0,
          cacheRead: 0,
          durationMs: 1000,
        }
      );

      expect(mockPut).toHaveBeenCalledTimes(1);
      const putCall = mockPut.mock.calls[0];
      const sessionData = JSON.parse(putCall[1] as string);

      expect(sessionData.apiKeyId).toBeUndefined();
      expect(sessionData.apiKeyName).toBeUndefined();
      expect(sessionData.sessionId).toBe('test-session-4');
    });

    it('preserves API key fields on subsequent requests to same session', async () => {
      // First request with API key
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-5',
        {
          endpoint: 'chat-api',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreation: 0,
          cacheRead: 0,
          durationMs: 1500,
        },
        {
          apiKeyId: 'key-ghi-789',
          apiKeyName: 'Test Key',
        }
      );

      const firstPutCall = mockPut.mock.calls[0];
      const firstSessionData = JSON.parse(firstPutCall[1] as string);

      // Second request to same session (without options)
      mockHead.mockResolvedValue(mockHeadResult('https://example.com/session.json'));
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(firstSessionData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      mockPut.mockClear();

      await logUsage('test-session-5', {
        endpoint: 'chat-api',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 800,
        outputTokens: 400,
        cacheCreation: 0,
        cacheRead: 600,
        durationMs: 1200,
      });

      expect(mockPut).toHaveBeenCalledTimes(1);
      const secondPutCall = mockPut.mock.calls[0];
      const secondSessionData = JSON.parse(secondPutCall[1] as string);

      // API key fields should be preserved from first request
      expect(secondSessionData.apiKeyId).toBe('key-ghi-789');
      expect(secondSessionData.apiKeyName).toBe('Test Key');
      expect(secondSessionData.requests).toHaveLength(2);
    });
  });

  describe('session creation fields', () => {
    it('includes all required session fields', async () => {
      mockHead.mockRejectedValue(new Error('Blob does not exist'));
      mockPut.mockResolvedValue(mockPutResult('https://example.com/session.json'));

      await logUsage(
        'test-session-6',
        {
          endpoint: 'chat-api',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreation: 200,
          cacheRead: 300,
          durationMs: 1500,
        },
        {
          apiKeyId: 'key-test',
          apiKeyName: 'Test',
        }
      );

      expect(mockPut).toHaveBeenCalledTimes(1);
      const putCall = mockPut.mock.calls[0];
      const sessionData = JSON.parse(putCall[1] as string);

      // Verify all required fields
      expect(sessionData).toHaveProperty('sessionId', 'test-session-6');
      expect(sessionData).toHaveProperty('createdAt');
      expect(sessionData).toHaveProperty('lastUpdatedAt');
      expect(sessionData).toHaveProperty('apiKeyId', 'key-test');
      expect(sessionData).toHaveProperty('apiKeyName', 'Test');
      expect(sessionData).toHaveProperty('requests');
      expect(sessionData).toHaveProperty('totals');

      // Verify requests array has one entry
      expect(sessionData.requests).toHaveLength(1);
      expect(sessionData.requests[0]).toMatchObject({
        endpoint: 'chat-api',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreation: 200,
        cacheRead: 300,
        durationMs: 1500,
      });

      // Verify totals
      expect(sessionData.totals).toMatchObject({
        requestCount: 1,
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        cacheReadTokens: 300,
      });
    });
  });
});
