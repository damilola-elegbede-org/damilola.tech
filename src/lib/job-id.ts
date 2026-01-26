/**
 * Job ID generation utilities for deduplication in the job tracking system.
 *
 * Job IDs are deterministic hashes that enable:
 * - Deduplication: Same job = same ID, regardless of when added
 * - URL preference: If URL provided, use URL hash; otherwise use title+company
 * - Normalization: URLs/titles are normalized for consistent matching
 */

export type JobId = string; // 12-char hex hash

export interface JobIdentifier {
  jobId: JobId;
  source: 'url' | 'title_company';
  originalUrl?: string;
  datePosted?: string;
}

interface GenerateJobIdInput {
  url?: string;
  title?: string;
  company?: string;
}

/**
 * Normalize a URL for consistent hashing.
 * - Remove protocol (http:// or https://)
 * - Remove www. prefix
 * - Lowercase
 * - Remove trailing slash
 * - Keep query params (different params = different job)
 * - Remove hash fragments
 */
export function normalizeUrl(url: string): string {
  let normalized = url
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '') // Remove www
    .toLowerCase();

  // Remove hash fragments
  const hashIndex = normalized.indexOf('#');
  if (hashIndex !== -1) {
    normalized = normalized.slice(0, hashIndex);
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize company name or job title for consistent hashing.
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple whitespace to single space
 */
export function normalizeCompanyAndTitle(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Collapse whitespace (handles tabs, newlines, multiple spaces)
}

/**
 * Generate a deterministic hash and truncate to 12 hex characters.
 * Uses a simple algorithm for synchronous operation in all environments.
 */
function hashStringSync(str: string): string {
  // Simple hash function for synchronous use
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Extend to 12 chars by hashing twice with offset
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash2 = (hash2 << 7) - hash2 + char + i;
    hash2 = hash2 & hash2;
  }
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return (hex + hex2).slice(0, 12);
}

/**
 * Generate a unique job ID from URL or title+company.
 *
 * Priority:
 * 1. If URL provided, use normalized URL hash
 * 2. Otherwise, use normalized title+company hash
 *
 * @throws Error if neither URL nor title+company provided
 */
export function generateJobId(input: GenerateJobIdInput): JobIdentifier {
  const { url, title, company } = input;

  // URL takes priority
  if (url) {
    const normalized = normalizeUrl(url);
    const jobId = hashStringSync(normalized);
    return {
      jobId,
      source: 'url',
      originalUrl: url,
    };
  }

  // Fall back to title+company
  if (title && company) {
    const normalizedTitle = normalizeCompanyAndTitle(title);
    const normalizedCompany = normalizeCompanyAndTitle(company);
    const combined = `${normalizedCompany}::${normalizedTitle}`; // Use separator to avoid collisions
    const jobId = hashStringSync(combined);
    return {
      jobId,
      source: 'title_company',
    };
  }

  throw new Error('Either url or both title and company are required');
}

/**
 * Extract job posting date from JD text.
 * Supports common formats:
 * - ISO date: "2025-01-15"
 * - "Posted X days ago"
 * - "Posted today"
 * - "Posted on January 15, 2025"
 * - "Date posted: December 3, 2024"
 *
 * @returns ISO date string (YYYY-MM-DD) or undefined if not found
 */
export function extractDatePosted(jdText: string): string | undefined {
  const text = jdText.toLowerCase();

  // Try ISO date format first: YYYY-MM-DD
  const isoMatch = jdText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Try "Posted today"
  if (/posted\s+today/i.test(text)) {
    return new Date().toISOString().split('T')[0];
  }

  // Try "Posted X days ago" - use UTC to avoid timezone off-by-one errors
  const daysAgoMatch = text.match(/posted\s+(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  // Try "Posted on Month Day, Year" or "Date posted: Month Day, Year"
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const monthPattern = `(${monthNames.join('|')})`;
  const datePatterns = [
    new RegExp(`posted\\s+on\\s+${monthPattern}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'),
    new RegExp(`date\\s+posted:?\\s+${monthPattern}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'),
  ];

  for (const pattern of datePatterns) {
    const match = jdText.match(pattern);
    if (match) {
      const monthName = match[1].toLowerCase();
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const monthIndex = monthNames.indexOf(monthName);

      if (monthIndex !== -1) {
        const date = new Date(year, monthIndex, day);
        const isoDate = date.toISOString().split('T')[0];
        return isoDate;
      }
    }
  }

  return undefined;
}
