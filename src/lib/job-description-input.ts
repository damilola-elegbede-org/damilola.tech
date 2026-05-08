import { fetchWithResolvedPublicIp, resolvePublicHttpUrl } from '@/lib/ssrf-validator';

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

const MIN_JD_KEYWORDS = 2;
const MIN_EXTRACTED_CONTENT_LENGTH = 100;

const EMPTY_SHELL_MAX_VISIBLE_BYTES = 50;

// Known client-side-rendered ATS/SPA framework markers. When the <body>
// contains fewer than EMPTY_SHELL_MAX_VISIBLE_BYTES of visible text but one
// of these markers appears in the raw HTML, we treat the page as an empty
// SSR shell whose real content is fetched post-hydration.
const EMPTY_SHELL_MARKERS: readonly RegExp[] = [
  /\b__ASHBY_(?:JOB_ID|HYDRATE)__\b/,
  /data-automation-id=["']wd-appRoot["']/i,
  /\bid=["']wd-[A-Za-z][A-Za-z0-9_-]*["']/,
  /\b__WD_BOOTSTRAP__\b/,
  /\bid=["']__next["']/,
  /\bid=["']root["']\s*>\s*<\/div>/i,
  /<noscript>[^<]*enable\s+JavaScript[^<]*<\/noscript>/i,
];

export const URL_FETCH_TIMEOUT = 10000;
export const MAX_RESPONSE_SIZE = 1024 * 1024;
export const HEADLESS_TIMEOUT = 15000;
const HEADLESS_FALLBACK_THRESHOLD = 500;

export class JobDescriptionInputError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isUrlInput(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function extractTextFromHtml(html: string): string {
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
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    });

  return text.replace(/\s+/g, ' ').trim();
}

function extractBodyHtml(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

export function detectEmptyShell(html: string): boolean {
  const bodyHtml = extractBodyHtml(html);
  const visibleBytes = new TextEncoder().encode(extractTextFromHtml(bodyHtml)).byteLength;
  if (visibleBytes > EMPTY_SHELL_MAX_VISIBLE_BYTES) {
    return false;
  }
  return EMPTY_SHELL_MARKERS.some((marker) => marker.test(html));
}

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

async function fetchJobDescriptionHtml(
  url: string,
  userAgent: string
): Promise<string> {
  try {
    return await fetchWithResolvedPublicIp(url, {
      maxSize: MAX_RESPONSE_SIZE,
      timeout: URL_FETCH_TIMEOUT,
      userAgent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message === 'Invalid URL format.' ||
      message === 'Only HTTP and HTTPS URLs are supported.' ||
      message === 'This URL is not allowed.' ||
      message === 'DNS resolution unavailable - URL fetching disabled for security.'
    ) {
      throw new JobDescriptionInputError(`${message} Please provide the job description text directly.`);
    }

    if (message.includes('Response too large')) {
      throw new JobDescriptionInputError('The page is too large to process. Please provide the job description text directly.');
    }

    if (message.includes('Too many redirects')) {
      throw new JobDescriptionInputError('The URL redirected too many times. Please provide the job description text directly.');
    }

    throw error;
  }
}

async function fetchJobDescriptionHeadless(url: string): Promise<string> {
  const { resolvedUrl, hostname } = await resolvePublicHttpUrl(url);

  const chromiumModule = await import('@sparticuz/chromium');
  // @sparticuz/chromium types only expose args and executablePath; defaultViewport
  // and headless are not typed but the chromium args already configure headless-shell mode
  const chromium = chromiumModule.default;
  const puppeteer = await import('puppeteer-core');

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
    // resolvedUrl is an IP from SSRF pinning; the server's TLS SAN won't match. This flag
    // applies browser-wide, but the instance is ephemeral and closed immediately after fetch.
    acceptInsecureCerts: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; ResumeScoreBot/1.0)');
    await page.setExtraHTTPHeaders({ Host: hostname });
    await page.goto(resolvedUrl, { waitUntil: 'networkidle2', timeout: HEADLESS_TIMEOUT });
    // Allow SPA hydration to settle after network becomes idle
    // page.waitForTimeout removed in puppeteer v22; use native Promise
    await new Promise<void>((r) => setTimeout(r, 2000));
    return await page.content();
  } finally {
    await browser.close();
  }
}

export function resolvePreFetchedJobDescription(
  content: string,
  sourceUrl: string
): { text: string; inputType: 'content'; extractedUrl: string; isEmptyShell?: boolean } {
  const looksLikeHtml = /<[a-z][\s\S]*?>/i.test(content);
  const textContent = looksLikeHtml
    ? extractTextFromHtml(content)
    : content.replace(/\s+/g, ' ').trim();

  if (looksLikeHtml && detectEmptyShell(content)) {
    return {
      text: textContent,
      inputType: 'content',
      extractedUrl: sourceUrl,
      isEmptyShell: true,
    };
  }

  if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
    throw new JobDescriptionInputError(
      `Pre-fetched content too short (${textContent.length} chars, minimum ${MIN_EXTRACTED_CONTENT_LENGTH} required).`
    );
  }

  if (!looksLikeJobDescription(textContent)) {
    throw new JobDescriptionInputError(
      'Pre-fetched content does not appear to be a job description.'
    );
  }

  return {
    text: textContent,
    inputType: 'content',
    extractedUrl: sourceUrl,
  };
}

export async function resolveJobDescriptionInput(
  input: string,
  userAgent: string
): Promise<{ text: string; inputType: 'text' | 'url'; extractedUrl?: string; isEmptyShell?: boolean }> {
  if (!isUrlInput(input)) {
    return { text: input, inputType: 'text' };
  }

  const urlToFetch = input.trim();

  try {
    const html = await fetchJobDescriptionHtml(urlToFetch, userAgent);
    let textContent = extractTextFromHtml(html);

    // If plain fetch returned too little content, try headless rendering for SPA/ATS pages
    if (textContent.length < HEADLESS_FALLBACK_THRESHOLD) {
      try {
        const headlessHtml = await fetchJobDescriptionHeadless(urlToFetch);
        textContent = extractTextFromHtml(headlessHtml);
      } catch (headlessError) {
        // Headless launch or navigation failed — fall through to validation below
        // which will throw JobDescriptionInputError with the original short content
        console.warn('[score-job] headless fallback failed:', headlessError instanceof Error ? headlessError.message : String(headlessError));
      }
    }

    if (detectEmptyShell(html)) {
      return {
        text: textContent,
        inputType: 'url',
        extractedUrl: urlToFetch,
        isEmptyShell: true,
      };
    }

    if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
      throw new JobDescriptionInputError(
        `Content too short (${textContent.length} chars, minimum ${MIN_EXTRACTED_CONTENT_LENGTH} required). Please provide the job description text directly.`
      );
    }

    if (!looksLikeJobDescription(textContent)) {
      throw new JobDescriptionInputError(
        'The URL does not appear to contain a job description. Please provide the job description text directly.'
      );
    }

    return {
      text: textContent,
      inputType: 'url',
      extractedUrl: urlToFetch,
    };
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Response too large')) {
      throw new JobDescriptionInputError('The page is too large to process. Please provide the job description text directly.');
    }

    throw new JobDescriptionInputError(
      'Could not fetch the job posting. The site may be unavailable or blocking access. Please provide the job description text directly.'
    );
  }
}
