import Anthropic from '@anthropic-ai/sdk';
import { isIP } from 'node:net';
import { RESUME_GENERATOR_PROMPT } from '@/lib/generated/system-prompt';
import { logAdminEvent } from '@/lib/audit-server';
import {
  checkGenericRateLimit,
  createRateLimitResponse,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
// ResumeAnalysisResult parsing happens client-side for streaming support

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

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = RESUME_GENERATOR_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_BODY_SIZE = 50 * 1024; // 50KB max request body
const MIN_EXTRACTED_CONTENT_LENGTH = 100;
const URL_FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB max response from fetched URL

// Private IP ranges and blocked hosts for SSRF protection
const BLOCKED_HOSTNAMES = ['localhost', 'localhost.', '127.0.0.1', '0.0.0.0', '::1'];

// Keywords that indicate content is a job description
const JD_KEYWORDS = [
  'responsibilities',
  'qualifications',
  'requirements',
  'experience',
  'skills',
  'job description',
  'position',
  'duties',
  'about the role',
  "what you'll do",
  'who you are',
  "what we're looking for",
  'minimum requirements',
  'preferred qualifications',
  'about this job',
  'the role',
  'your responsibilities',
  'must have',
  'nice to have',
  'benefits',
  'compensation',
  'salary',
  'apply',
];

// Minimum number of JD keywords required to validate content
const MIN_JD_KEYWORDS = 2;

const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^0\./, // Current network
  /^224\./, // Multicast
  /^240\./, // Reserved
];

/**
 * Extract text content from HTML by stripping tags and decoding entities.
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
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

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Check if the input looks like a URL.
 */
function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

/**
 * Validate that extracted content looks like a job description.
 * Returns true if content contains enough JD-related keywords.
 */
function looksLikeJobDescription(content: string): boolean {
  const lowerContent = content.toLowerCase();
  let matchCount = 0;

  for (const keyword of JD_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      matchCount++;
      if (matchCount >= MIN_JD_KEYWORDS) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an IP address is private/reserved (IPv4 or IPv6).
 */
function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return PRIVATE_IP_PATTERNS.some((p) => p.test(address));
  }
  if (version === 6) {
    const lower = address.toLowerCase();

    // Loopback
    if (lower === '::1') return true;

    // IPv4-mapped IPv6 in dotted decimal (e.g., ::ffff:127.0.0.1)
    const mappedDotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted && PRIVATE_IP_PATTERNS.some((p) => p.test(mappedDotted[1]))) {
      return true;
    }

    // IPv4-mapped IPv6 in hex format (e.g., ::ffff:7f00:1 = 127.0.0.1)
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (PRIVATE_IP_PATTERNS.some((p) => p.test(ipv4))) {
        return true;
      }
    }

    // ULA: fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // Link-local: fe80::/10 (fe80–febf)
    if (/^fe[89ab]/.test(lower)) return true;

    return false;
  }
  return false;
}

/**
 * Validate URL for SSRF protection with DNS resolution.
 * Returns error message if URL is blocked, null if allowed.
 */
async function validateUrlForSsrf(urlString: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return 'Invalid URL format.';
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    return 'Only HTTP and HTTPS URLs are supported.';
  }

  const hostname = url.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return 'This URL is not allowed.';
  }

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254') {
    return 'This URL is not allowed.';
  }

  // Strip brackets from IPv6 addresses for isIP check
  const ipAddress = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Check if hostname is an IP address directly
  if (isIP(ipAddress)) {
    if (isPrivateIp(ipAddress)) {
      return 'This URL is not allowed.';
    }
    return null;
  }

  // For hostnames, resolve to IP addresses and check each one
  try {
    const lookup = await getDnsLookup();
    if (lookup) {
      const results = await lookup(hostname, { all: true });
      const addresses = results.map((r) => r.address);

      if (addresses.some(isPrivateIp)) {
        return 'This URL is not allowed.';
      }
    }
  } catch (error) {
    // DNS resolution failed - fail closed for security (SSRF protection)
    console.warn(`[resume-generator] DNS resolution failed for ${hostname}:`, error);
    return 'This URL is not allowed.';
  }

  return null;
}

const MAX_REDIRECTS = 5;

/**
 * Fetch URL with size limit using streaming.
 */
async function fetchWithSizeLimit(
  url: string,
  maxSize: number,
  timeout: number,
  redirectCount = 0
): Promise<string> {
  if (redirectCount >= MAX_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumeGeneratorBot/1.0)' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'manual', // Don't follow redirects automatically
  });

  // Handle redirects manually to validate each hop
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, url).href;
      const redirectError = await validateUrlForSsrf(redirectUrl);
      if (redirectError) {
        throw new Error(`Redirect blocked: ${redirectError}`);
      }
      return fetchWithSizeLimit(redirectUrl, maxSize, timeout, redirectCount + 1);
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Check content-length if available
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error('Response too large');
  }

  // Stream response with size limit
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxSize) {
        throw new Error('Response too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Use streaming mode for TextDecoder to properly handle multi-byte characters across chunk boundaries
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const textParts = chunks.map((chunk, index) =>
    decoder.decode(chunk, { stream: index < chunks.length - 1 })
  );
  // Final decode to flush any remaining bytes
  textParts.push(decoder.decode());
  return textParts.join('');
}

/**
 * Runtime fetch for the resume generator prompt (development fallback)
 */
async function getResumeGeneratorPrompt(): Promise<string> {
  if (isGeneratedPromptAvailable) {
    return RESUME_GENERATOR_PROMPT;
  }

  // Development fallback: fetch from blob or local file
  try {
    const { fetchResumeGeneratorInstructionsRequired } = await import('@/lib/blob');
    const { fetchAllContent } = await import('@/lib/blob');

    const [instructions, content] = await Promise.all([
      fetchResumeGeneratorInstructionsRequired(),
      fetchAllContent(),
    ]);

    // Apply replacements
    let prompt = instructions;
    const replacements: Record<string, string> = {
      '{{RESUME_FULL}}': content.resume || '*Resume content not available.*',
      '{{STAR_STORIES}}': content.starStories || '*STAR stories not available.*',
      '{{LEADERSHIP_PHILOSOPHY}}': content.leadershipPhilosophy || '*Leadership philosophy not available.*',
      '{{TECHNICAL_EXPERTISE}}': content.technicalExpertise || '*Technical expertise not available.*',
      '{{VERILY_FEEDBACK}}': content.verilyFeedback || '*Performance feedback not available.*',
      '{{PROJECTS_CONTEXT}}': content.projectsContext || '*Projects context not available.*',
      '{{ANECDOTES}}': content.anecdotes || '*Anecdotes not available.*',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      prompt = prompt.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
        () => value
      );
    }

    return prompt;
  } catch (error) {
    console.error('[resume-generator] Failed to fetch prompt:', error);
    throw new Error('Resume generator prompt not available');
  }
}

export async function POST(req: Request) {
  console.log('[resume-generator] Request received');
  const ip = getClientIp(req);

  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    console.log('[resume-generator] Content-Length:', contentLength);
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      console.log('[resume-generator] Request body too large, rejecting');
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    // Rate limit check using IP
    const rateLimitResult = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.resumeGenerator,
      ip
    );
    if (rateLimitResult.limited) {
      console.log(`[resume-generator] Rate limited: ${ip}`);
      return createRateLimitResponse(rateLimitResult);
    }

    const { jobDescription } = await req.json();
    console.log('[resume-generator] Job description length:', jobDescription?.length ?? 0);

    if (!jobDescription || typeof jobDescription !== 'string') {
      console.log('[resume-generator] Invalid job description, rejecting');
      return Response.json({ error: 'Job description is required.' }, { status: 400 });
    }

    // Check if input is a URL
    let jobDescriptionText = jobDescription;
    let wasUrl = false;
    let extractedUrl: string | undefined;

    if (isUrl(jobDescription)) {
      console.log('[resume-generator] Detected URL, fetching content...');
      wasUrl = true;
      extractedUrl = jobDescription.trim();

      // SSRF protection: validate URL before fetching
      const ssrfError = await validateUrlForSsrf(extractedUrl);
      if (ssrfError) {
        console.log('[resume-generator] URL blocked by SSRF protection:', ssrfError);
        return Response.json(
          {
            error: `${ssrfError} Please copy and paste the job description text directly.`,
          },
          { status: 400 }
        );
      }

      try {
        const html = await fetchWithSizeLimit(extractedUrl, MAX_RESPONSE_SIZE, URL_FETCH_TIMEOUT);
        const textContent = extractTextFromHtml(html);
        console.log('[resume-generator] Extracted content length:', textContent.length);

        if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
          console.log('[resume-generator] Extracted content too short');
          return Response.json(
            {
              error:
                'Could not extract job description from that URL. The page may require login or block automated access. Please copy and paste the job description text directly.',
            },
            { status: 400 }
          );
        }

        // Validate that the extracted content looks like a job description
        if (!looksLikeJobDescription(textContent)) {
          console.log('[resume-generator] Extracted content does not look like a job description');
          return Response.json(
            {
              error:
                'The URL does not appear to contain a job description. Please ensure the URL points directly to a job posting, or copy and paste the job description text directly.',
            },
            { status: 400 }
          );
        }

        jobDescriptionText = textContent;
      } catch (err) {
        console.error('[resume-generator] URL fetch error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (errorMessage.includes('HTTP ')) {
          return Response.json(
            {
              error: `Could not access the job posting (${errorMessage}). Please copy and paste the job description text directly.`,
            },
            { status: 400 }
          );
        }

        if (errorMessage.includes('Response too large')) {
          return Response.json(
            {
              error: 'The page is too large to process. Please copy and paste the job description text directly.',
            },
            { status: 400 }
          );
        }

        if (errorMessage.includes('Redirect blocked')) {
          return Response.json(
            {
              error: 'The URL redirected to a blocked destination. Please copy and paste the job description text directly.',
            },
            { status: 400 }
          );
        }

        return Response.json(
          {
            error:
              'Could not fetch the job posting. The site may be unavailable or blocking access. Please copy and paste the job description text directly.',
          },
          { status: 400 }
        );
      }
    }

    // Get the system prompt
    console.log('[resume-generator] Loading system prompt (generated:', isGeneratedPromptAvailable, ')');
    const systemPrompt = await getResumeGeneratorPrompt();
    console.log('[resume-generator] System prompt loaded, length:', systemPrompt.length);

    // Log audit event for generation started
    await logAdminEvent('resume_generation_started', {
      inputType: wasUrl ? 'url' : 'text',
      extractedUrl: extractedUrl || undefined,
      jobDescriptionLength: jobDescriptionText.length,
    }, ip);

    console.log('[resume-generator] Calling Anthropic API (streaming)...');

    // Streaming API call for progressive JSON output
    // Wrap job description in XML tags for prompt injection mitigation
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this job description and provide ATS optimization recommendations for the resume. Return ONLY valid JSON, no markdown or code blocks.\n\n<job_description>${jobDescriptionText}</job_description>`,
        },
      ],
    });

    // Return streaming response with metadata header
    const metadataHeader = JSON.stringify({ wasUrl, extractedUrl });

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first (separated by newline)
            controller.enqueue(new TextEncoder().encode(metadataHeader + '\n'));

            for await (const event of stream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                controller.enqueue(new TextEncoder().encode(event.delta.text));
              }
            }
            controller.close();
            console.log('[resume-generator] Stream completed');
          } catch (streamError) {
            console.error('[resume-generator] Stream error:', streamError);
            controller.error(streamError);
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      }
    );
  } catch (error) {
    console.error('[resume-generator] Error:', error);
    console.error('[resume-generator] Stack:', error instanceof Error ? error.stack : 'No stack');
    return Response.json(
      { error: 'AI service error.' },
      { status: 503 }
    );
  }
}
