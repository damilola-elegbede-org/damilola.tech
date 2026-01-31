import Anthropic from '@anthropic-ai/sdk';
import { isIP } from 'node:net';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { FIT_ASSESSMENT_PROMPT } from '@/lib/generated/system-prompt';
import { getFitAssessmentPrompt } from '@/lib/system-prompt';
import { logUsage } from '@/lib/usage-logger';

// Dynamic import for DNS to allow testing without mocking
let dnsLookup: typeof import('node:dns/promises').lookup | null = null;
async function getDnsLookup() {
  if (dnsLookup === null) {
    try {
      const dns = await import('node:dns/promises');
      dnsLookup = dns.lookup;
    } catch {
      dnsLookup = undefined as unknown as typeof import('node:dns/promises').lookup;
    }
  }
  return dnsLookup;
}

export const runtime = 'nodejs';

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const isGeneratedPromptAvailable = FIT_ASSESSMENT_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_BODY_SIZE = 50 * 1024;
const MIN_EXTRACTED_CONTENT_LENGTH = 100;
const URL_FETCH_TIMEOUT = 10000;
const MAX_RESPONSE_SIZE = 1024 * 1024;

const BLOCKED_HOSTNAMES = ['localhost', 'localhost.', '127.0.0.1', '0.0.0.0', '::1'];

const JD_KEYWORDS = [
  'responsibilities', 'qualifications', 'requirements', 'experience', 'skills',
  'job description', 'position', 'duties', 'about the role', 'what you\'ll do',
  'who you are', 'what we\'re looking for', 'minimum requirements',
  'preferred qualifications', 'about this job', 'the role', 'your responsibilities',
  'must have', 'nice to have', 'benefits', 'compensation', 'salary', 'apply',
];

const MIN_JD_KEYWORDS = 2;

const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./, /^169\.254\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\./, /^224\./, /^240\./,
];

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    });
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function looksLikeJobDescription(content: string): boolean {
  const lowerContent = content.toLowerCase();
  let matchCount = 0;
  for (const keyword of JD_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      matchCount++;
      if (matchCount >= MIN_JD_KEYWORDS) return true;
    }
  }
  return false;
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return PRIVATE_IP_PATTERNS.some((p) => p.test(address));
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1') return true;
    const mappedDotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted && PRIVATE_IP_PATTERNS.some((p) => p.test(mappedDotted[1]))) return true;
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (PRIVATE_IP_PATTERNS.some((p) => p.test(ipv4))) return true;
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(lower)) return true;
    return false;
  }
  return false;
}

async function validateUrlForSsrf(urlString: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return 'Invalid URL format.';
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return 'Only HTTP and HTTPS URLs are supported.';
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) return 'This URL is not allowed.';
  if (hostname === '169.254.169.254') return 'This URL is not allowed.';
  const ipAddress = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1) : hostname;
  if (isIP(ipAddress)) {
    if (isPrivateIp(ipAddress)) return 'This URL is not allowed.';
    return null;
  }
  try {
    const lookup = await getDnsLookup();
    if (lookup) {
      const results = await lookup(hostname, { all: true });
      const addresses = results.map((r) => r.address);
      if (addresses.some(isPrivateIp)) return 'This URL is not allowed.';
    }
  } catch {
    return 'This URL is not allowed.';
  }
  return null;
}

const MAX_REDIRECTS = 5;

async function fetchWithSizeLimit(
  url: string,
  maxSize: number,
  timeout: number,
  redirectCount = 0
): Promise<string> {
  if (redirectCount >= MAX_REDIRECTS) throw new Error('Too many redirects');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitAssessmentBot/1.0)' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, url).href;
      const redirectError = await validateUrlForSsrf(redirectUrl);
      if (redirectError) throw new Error(`Redirect blocked: ${redirectError}`);
      return fetchWithSizeLimit(redirectUrl, maxSize, timeout, redirectCount + 1);
    }
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error('Response too large');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > maxSize) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
}

export async function POST(req: Request) {
  console.log('[api/v1/fit-assessment] Request received');
  const startTime = Date.now();

  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    const body = await req.json();
    const input = body.input || body.prompt;

    if (!input || typeof input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    let jobDescriptionText = input;

    if (isUrl(input)) {
      console.log('[api/v1/fit-assessment] Detected URL, fetching content...');
      const urlToFetch = input.trim();

      const ssrfError = await validateUrlForSsrf(urlToFetch);
      if (ssrfError) {
        return Errors.badRequest(`${ssrfError} Please provide the job description text directly.`);
      }

      try {
        const html = await fetchWithSizeLimit(urlToFetch, MAX_RESPONSE_SIZE, URL_FETCH_TIMEOUT);
        const textContent = extractTextFromHtml(html);

        if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
          return Errors.badRequest(
            'Could not extract job description from that URL. Please provide the job description text directly.'
          );
        }

        if (!looksLikeJobDescription(textContent)) {
          return Errors.badRequest(
            'The URL does not appear to contain a job description. Please provide the job description text directly.'
          );
        }

        jobDescriptionText = textContent;
      } catch (err) {
        console.error('[api/v1/fit-assessment] URL fetch error:', err);
        return Errors.badRequest(
          'Could not fetch the job posting. Please provide the job description text directly.'
        );
      }
    }

    const systemPrompt = isGeneratedPromptAvailable
      ? FIT_ASSESSMENT_PROMPT
      : await getFitAssessmentPrompt();

    // Non-streaming API call for JSON response
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate an Executive Fit Report for this job description:\n\n<job_description>${jobDescriptionText}</job_description>`,
        },
      ],
    });

    const fitSessionId = `fit-assessment-api-${crypto.randomUUID()}`;

    // Log usage
    const usage = message.usage;
    console.log(JSON.stringify({
      type: 'api_usage',
      timestamp: new Date().toISOString(),
      sessionId: fitSessionId,
      endpoint: 'fit-assessment-api',
      model: 'claude-sonnet-4-20250514',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    }));

    logUsage(fitSessionId, {
      endpoint: 'fit-assessment-api',
      model: 'claude-sonnet-4-20250514',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      durationMs: Date.now() - startTime,
      cacheTtl: '1h',
    }).catch((err) => console.warn('[api/v1/fit-assessment] Failed to log usage:', err));

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === 'text');
    const assessmentText = textContent?.type === 'text' ? textContent.text : '';

    return apiSuccess({
      assessment: assessmentText,
      model: message.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error('[api/v1/fit-assessment] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
