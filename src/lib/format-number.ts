/**
 * Format a number with K/M suffixes for compact display.
 *
 * @param value - The number to format
 * @returns Formatted string (e.g., "11.0K", "1.5M", "999")
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
