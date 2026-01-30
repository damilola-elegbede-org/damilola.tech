const STORAGE_KEY = 'audit_traffic_source';

export interface TrafficSource {
  source: string;
  medium: string;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  landingPage: string;
  capturedAt: string;
}

/**
 * Validate parsed data conforms to TrafficSource interface
 */
function isValidTrafficSource(data: unknown): data is TrafficSource {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.source === 'string' &&
    typeof obj.medium === 'string' &&
    typeof obj.landingPage === 'string' &&
    typeof obj.capturedAt === 'string'
  );
}

/**
 * Safely parse and validate TrafficSource from JSON string
 */
function parseTrafficSource(json: string): TrafficSource | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (isValidTrafficSource(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Known source classifications by referrer domain
 */
const REFERRER_SOURCES: Record<string, string> = {
  'google.com': 'google',
  'google.co.uk': 'google',
  'bing.com': 'bing',
  'linkedin.com': 'linkedin',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'github.com': 'github',
  'facebook.com': 'facebook',
};

/**
 * Extract UTM parameters from URL
 */
function getUtmParams(): Partial<TrafficSource> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const result: Partial<TrafficSource> = {};

  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  const term = params.get('utm_term');
  const content = params.get('utm_content');

  if (source) result.source = source;
  if (medium) result.medium = medium;
  if (campaign) result.campaign = campaign;
  if (term) result.term = term;
  if (content) result.content = content;

  return result;
}

/**
 * Classify source from referrer URL
 */
export function classifyReferrer(referrer: string): string {
  if (!referrer) return 'direct';

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace(/^www\./, '');

    // Check known sources
    for (const [domain, source] of Object.entries(REFERRER_SOURCES)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return source;
      }
    }

    // Return the domain name for unknown sources
    return hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Capture traffic source on page visit.
 * UTM parameters always override cached values (supports shortlink redirects).
 * Returns cached source only when no explicit UTM params present.
 */
export function captureTrafficSource(): TrafficSource | null {
  if (typeof window === 'undefined') return null;

  // FIRST: Check for explicit UTM parameters in current URL
  const utmParams = getUtmParams();
  const hasExplicitUtm = utmParams.source && utmParams.medium;

  // If explicit UTM params present, always use them (override cached)
  if (hasExplicitUtm) {
    const trafficSource: TrafficSource = {
      source: utmParams.source!,
      medium: utmParams.medium!,
      campaign: utmParams.campaign,
      term: utmParams.term,
      content: utmParams.content,
      referrer: document.referrer || undefined,
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
    };

    // Update localStorage with new UTM source
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trafficSource));
    } catch {
      // localStorage not available
    }

    return trafficSource;
  }

  // No explicit UTM: Check for cached value
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = parseTrafficSource(existing);
      if (parsed) return parsed;
    }
  } catch {
    // localStorage not available
  }

  // No cached value: Capture from referrer/direct
  const referrer = document.referrer;
  const source = classifyReferrer(referrer);
  let medium = '';

  // Auto-classify medium based on source
  if (source === 'direct') {
    medium = 'none';
  } else if (['google', 'bing'].includes(source)) {
    medium = 'organic';
  } else if (['linkedin', 'twitter', 'facebook', 'github'].includes(source)) {
    medium = 'social';
  } else if (referrer) {
    medium = 'referral';
  } else {
    medium = 'none';
  }

  const trafficSource: TrafficSource = {
    source,
    medium,
    campaign: utmParams.campaign,
    term: utmParams.term,
    content: utmParams.content,
    referrer: referrer || undefined,
    landingPage: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };

  // Store in localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trafficSource));
  } catch {
    // localStorage not available
  }

  return trafficSource;
}

/**
 * Get stored traffic source (if any)
 */
export function getTrafficSource(): TrafficSource | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return parseTrafficSource(stored);
    }
  } catch {
    // localStorage not available
  }

  return null;
}

/**
 * Clear stored traffic source (for testing)
 */
export function clearTrafficSource(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}
