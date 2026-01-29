import { describe, it, expect } from 'vitest';
import { calculateCost, calculateCostSavings } from '@/lib/usage-logger';

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
