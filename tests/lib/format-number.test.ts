import { describe, it, expect } from 'vitest';
import { formatNumber } from '@/lib/format-number';

describe('format-number', () => {
  describe('formatNumber()', () => {
    describe('thousands formatting', () => {
      it('formats exactly 1000 as 1.0K', () => {
        expect(formatNumber(1000)).toBe('1.0K');
      });

      it('formats 1500 as 1.5K', () => {
        expect(formatNumber(1500)).toBe('1.5K');
      });

      it('formats 11000 as 11.0K', () => {
        expect(formatNumber(11000)).toBe('11.0K');
      });

      it('formats 999999 as 1000.0K', () => {
        expect(formatNumber(999999)).toBe('1000.0K');
      });

      it('formats 50000 as 50.0K', () => {
        expect(formatNumber(50000)).toBe('50.0K');
      });

      it('formats 1234 with one decimal place', () => {
        expect(formatNumber(1234)).toBe('1.2K');
      });
    });

    describe('millions formatting', () => {
      it('formats exactly 1000000 as 1.0M', () => {
        expect(formatNumber(1000000)).toBe('1.0M');
      });

      it('formats 1500000 as 1.5M', () => {
        expect(formatNumber(1500000)).toBe('1.5M');
      });

      it('formats 2300000 as 2.3M', () => {
        expect(formatNumber(2300000)).toBe('2.3M');
      });

      it('formats 50000000 as 50.0M', () => {
        expect(formatNumber(50000000)).toBe('50.0M');
      });

      it('formats 1234567 with one decimal place', () => {
        expect(formatNumber(1234567)).toBe('1.2M');
      });
    });

    describe('small numbers', () => {
      it('handles zero', () => {
        expect(formatNumber(0)).toBe('0');
      });

      it('formats 1 as "1"', () => {
        expect(formatNumber(1)).toBe('1');
      });

      it('formats 10 as "10"', () => {
        expect(formatNumber(10)).toBe('10');
      });

      it('formats 100 as "100"', () => {
        expect(formatNumber(100)).toBe('100');
      });

      it('formats 999 without K suffix', () => {
        expect(formatNumber(999)).toBe('999');
      });

      it('formats 500 without K suffix', () => {
        expect(formatNumber(500)).toBe('500');
      });
    });

    describe('negative numbers', () => {
      it('formats -1000 using toLocaleString', () => {
        expect(formatNumber(-1000)).toBe('-1,000');
      });

      it('formats -1500 using toLocaleString', () => {
        expect(formatNumber(-1500)).toBe('-1,500');
      });

      it('formats -1000000 using toLocaleString', () => {
        expect(formatNumber(-1000000)).toBe('-1,000,000');
      });

      it('formats -500 without suffix', () => {
        expect(formatNumber(-500)).toBe('-500');
      });

      it('formats -50 without suffix', () => {
        expect(formatNumber(-50)).toBe('-50');
      });
    });

    describe('decimal precision', () => {
      it('rounds 1234 to 1.2K (one decimal)', () => {
        expect(formatNumber(1234)).toBe('1.2K');
      });

      it('rounds 1567 to 1.6K (one decimal)', () => {
        expect(formatNumber(1567)).toBe('1.6K');
      });

      it('rounds 1999 to 2.0K (one decimal)', () => {
        expect(formatNumber(1999)).toBe('2.0K');
      });

      it('rounds 1234567 to 1.2M (one decimal)', () => {
        expect(formatNumber(1234567)).toBe('1.2M');
      });

      it('rounds 9876543 to 9.9M (one decimal)', () => {
        expect(formatNumber(9876543)).toBe('9.9M');
      });
    });

    describe('boundary conditions', () => {
      it('formats 999 without K suffix (just below threshold)', () => {
        expect(formatNumber(999)).toBe('999');
      });

      it('formats 1000 with K suffix (at threshold)', () => {
        expect(formatNumber(1000)).toBe('1.0K');
      });

      it('formats 999999 as 1000.0K (just below million threshold)', () => {
        expect(formatNumber(999999)).toBe('1000.0K');
      });

      it('formats 1000000 as 1.0M (at million threshold)', () => {
        expect(formatNumber(1000000)).toBe('1.0M');
      });
    });

    describe('locale formatting for small numbers', () => {
      it('uses toLocaleString for numbers under 1000', () => {
        // Small numbers should use toLocaleString (no commas for numbers < 1000)
        expect(formatNumber(100)).toBe('100');
        expect(formatNumber(999)).toBe('999');
      });

      it('returns string type for all inputs', () => {
        expect(typeof formatNumber(0)).toBe('string');
        expect(typeof formatNumber(500)).toBe('string');
        expect(typeof formatNumber(1000)).toBe('string');
        expect(typeof formatNumber(1000000)).toBe('string');
      });
    });
  });
});
