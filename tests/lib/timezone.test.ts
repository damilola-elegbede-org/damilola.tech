import { describe, it, expect } from 'vitest';
import { getMTDayBounds, formatInMT, MT_TIMEZONE } from '@/lib/timezone';

describe('getMTDayBounds', () => {
  describe('standard dates', () => {
    it('returns valid UTC bounds for a regular date', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-06-15');
      expect(startUTC).toBeGreaterThan(0);
      expect(endUTC).toBeGreaterThan(startUTC);
      // The day should span approximately 24 hours
      expect(endUTC - startUTC).toBeCloseTo(24 * 60 * 60 * 1000 - 1, -3);
    });

    it('start time represents midnight MT', () => {
      const { startUTC } = getMTDayBounds('2024-06-15');
      const startDate = new Date(startUTC);
      const mtHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: MT_TIMEZONE,
          hour: 'numeric',
          hour12: false,
        }).format(startDate),
        10
      );
      expect(mtHour).toBe(0); // Midnight in MT
    });

    it('end time represents 23:59:59 MT', () => {
      const { endUTC } = getMTDayBounds('2024-06-15');
      const endDate = new Date(endUTC);
      const mtParts = new Intl.DateTimeFormat('en-US', {
        timeZone: MT_TIMEZONE,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      }).formatToParts(endDate);

      const hour = parseInt(mtParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
      const minute = parseInt(mtParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
      const second = parseInt(mtParts.find((p) => p.type === 'second')?.value ?? '0', 10);

      expect(hour).toBe(23);
      expect(minute).toBe(59);
      expect(second).toBe(59);
    });
  });

  describe('DST spring forward (March 10, 2024)', () => {
    // On this day, MT transitions from MST (-7) to MDT (-6) at 2am
    // Midnight is in MST, end of day is in MDT

    it('correctly handles start time (MST offset)', () => {
      const { startUTC } = getMTDayBounds('2024-03-10');
      const startDate = new Date(startUTC);

      // Midnight March 10 MT should be 07:00 UTC (MST = UTC-7)
      expect(startDate.getUTCHours()).toBe(7);
      expect(startDate.getUTCMinutes()).toBe(0);
    });

    it('correctly handles end time (MDT offset)', () => {
      const { endUTC } = getMTDayBounds('2024-03-10');
      const endDate = new Date(endUTC);

      // 23:59:59 March 10 MT should be 05:59:59 UTC March 11 (MDT = UTC-6)
      expect(endDate.getUTCDate()).toBe(11);
      expect(endDate.getUTCHours()).toBe(5);
      expect(endDate.getUTCMinutes()).toBe(59);
    });

    it('day spans correct number of hours (23 on spring forward)', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-03-10');
      const durationHours = (endUTC - startUTC) / (60 * 60 * 1000);
      // Spring forward day loses an hour: 23 hours instead of 24
      expect(durationHours).toBeCloseTo(23, 0);
    });
  });

  describe('DST fall back (November 3, 2024)', () => {
    // On this day, MT transitions from MDT (-6) to MST (-7) at 2am
    // Midnight is in MDT, end of day is in MST

    it('correctly handles start time (MDT offset)', () => {
      const { startUTC } = getMTDayBounds('2024-11-03');
      const startDate = new Date(startUTC);

      // Midnight November 3 MT should be 06:00 UTC (MDT = UTC-6)
      expect(startDate.getUTCHours()).toBe(6);
      expect(startDate.getUTCMinutes()).toBe(0);
    });

    it('correctly handles end time (MST offset)', () => {
      const { endUTC } = getMTDayBounds('2024-11-03');
      const endDate = new Date(endUTC);

      // 23:59:59 November 3 MT should be 06:59:59 UTC November 4 (MST = UTC-7)
      expect(endDate.getUTCDate()).toBe(4);
      expect(endDate.getUTCHours()).toBe(6);
      expect(endDate.getUTCMinutes()).toBe(59);
    });

    it('day spans correct number of hours (25 on fall back)', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-11-03');
      const durationHours = (endUTC - startUTC) / (60 * 60 * 1000);
      // Fall back day gains an hour: 25 hours instead of 24
      expect(durationHours).toBeCloseTo(25, 0);
    });
  });

  describe('invalid date validation', () => {
    it('returns NaN for invalid date like 2024-02-30', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-02-30');
      expect(Number.isNaN(startUTC)).toBe(true);
      expect(Number.isNaN(endUTC)).toBe(true);
    });

    it('returns NaN for invalid month like 2024-13-01', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-13-01');
      expect(Number.isNaN(startUTC)).toBe(true);
      expect(Number.isNaN(endUTC)).toBe(true);
    });

    it('returns NaN for invalid day like 2024-00-01', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-00-01');
      expect(Number.isNaN(startUTC)).toBe(true);
      expect(Number.isNaN(endUTC)).toBe(true);
    });

    it('accepts valid leap day 2024-02-29', () => {
      const { startUTC, endUTC } = getMTDayBounds('2024-02-29');
      expect(Number.isNaN(startUTC)).toBe(false);
      expect(Number.isNaN(endUTC)).toBe(false);
    });

    it('rejects invalid leap day 2023-02-29', () => {
      const { startUTC, endUTC } = getMTDayBounds('2023-02-29');
      expect(Number.isNaN(startUTC)).toBe(true);
      expect(Number.isNaN(endUTC)).toBe(true);
    });

    it('returns NaN for malformed date string', () => {
      const { startUTC, endUTC } = getMTDayBounds('not-a-date');
      expect(Number.isNaN(startUTC)).toBe(true);
      expect(Number.isNaN(endUTC)).toBe(true);
    });
  });
});

describe('formatInMT', () => {
  it('formats date with MT suffix', () => {
    const date = new Date('2024-06-15T18:30:00Z');
    const formatted = formatInMT(date);
    expect(formatted).toContain('MT');
    expect(formatted).toMatch(/Jun\s+15/);
  });

  it('respects custom options', () => {
    const date = new Date('2024-06-15T18:30:00Z');
    const formatted = formatInMT(date, { year: 'numeric' });
    expect(formatted).toContain('2024');
    expect(formatted).toContain('MT');
  });
});
