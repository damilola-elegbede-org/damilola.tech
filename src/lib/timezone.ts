/**
 * Mountain Time (America/Denver) timezone utilities.
 * Automatically handles MST/MDT daylight saving transitions.
 */

export const MT_TIMEZONE = 'America/Denver';

/**
 * Get UTC timestamps for start and end of a day in Mountain Time.
 * Correctly handles DST transitions by computing separate offsets for start and end.
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Object with startUTC and endUTC timestamps in milliseconds. Returns NaN for invalid dates.
 */
export function getMTDayBounds(dateStr: string): { startUTC: number; endUTC: number } {
  const parts = dateStr.split('-').map(Number);
  const [year, month, day] = parts;

  // Validate that we parsed valid numbers
  if (
    parts.length !== 3 ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return { startUTC: NaN, endUTC: NaN };
  }

  // Validate date components are semantically valid
  // Date.UTC normalizes invalid dates (e.g., Feb 30 -> Mar 1), so we must check
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return { startUTC: NaN, endUTC: NaN };
  }

  // Compute offset for the actual midnight instant (start of day)
  // On DST transition days, midnight may use different offset than midday
  const startOffset = getMTOffsetHours(new Date(Date.UTC(year, month - 1, day, 0, 0, 0)));

  // Compute offset for the actual end of day instant
  // On DST transition days, 23:59:59 may use different offset than midnight
  const endOffset = getMTOffsetHours(new Date(Date.UTC(year, month - 1, day, 23, 59, 59)));

  // Midnight MT = startOffset:00 UTC (e.g., midnight MST = 07:00 UTC, MDT = 06:00 UTC)
  const startUTC = Date.UTC(year, month - 1, day, startOffset, 0, 0, 0);

  // 23:59:59.999 MT = (23 + endOffset):59:59.999 UTC
  const endUTC = Date.UTC(year, month - 1, day, 23 + endOffset, 59, 59, 999);

  return { startUTC, endUTC };
}

/**
 * Get MT timezone offset in hours (7 for MST, 6 for MDT).
 */
function getMTOffsetHours(date: Date): number {
  const utcHour = date.getUTCHours();
  const mtFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  });
  const mtHour = parseInt(mtFormatter.format(date), 10);

  let offset = utcHour - mtHour;
  if (offset < 0) offset += 24;

  return offset;
}

/**
 * Format a Date for display in MT timezone with "MT" suffix.
 */
export function formatInMT(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
  return `${formatted} MT`;
}
