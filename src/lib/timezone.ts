/**
 * Mountain Time (America/Denver) timezone utilities.
 * Automatically handles MST/MDT daylight saving transitions.
 */

export const MT_TIMEZONE = 'America/Denver';

/**
 * Get UTC timestamps for start and end of a day in Mountain Time.
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Object with startUTC and endUTC timestamps in milliseconds
 */
export function getMTDayBounds(dateStr: string): { startUTC: number; endUTC: number } {
  const [year, month, day] = dateStr.split('-').map(Number);

  // Use midday to reliably check DST status
  const midday = new Date(Date.UTC(year, month - 1, day, 18, 0, 0));
  const offsetHours = getMTOffsetHours(midday);

  // Midnight MT = offsetHours:00 UTC (e.g., midnight MST = 07:00 UTC)
  const startUTC = Date.UTC(year, month - 1, day, offsetHours, 0, 0, 0);

  // 23:59:59.999 MT = (23 + offsetHours):59:59.999 UTC
  const endUTC = Date.UTC(year, month - 1, day, 23 + offsetHours, 59, 59, 999);

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
