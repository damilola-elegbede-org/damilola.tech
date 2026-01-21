import Anthropic from '@anthropic-ai/sdk';
import { FIT_ASSESSMENT_PROMPT } from '@/lib/generated/system-prompt';
import { getFitAssessmentPrompt } from '@/lib/system-prompt';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = FIT_ASSESSMENT_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_JD_LENGTH = 10000;
const MAX_BODY_SIZE = 50 * 1024; // 50KB max request body
const MIN_EXTRACTED_CONTENT_LENGTH = 100;
const URL_FETCH_TIMEOUT = 10000; // 10 seconds

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

export async function POST(req: Request) {
  console.log('[fit-assessment] Request received');
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    console.log('[fit-assessment] Content-Length:', contentLength);
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      console.log('[fit-assessment] Request body too large, rejecting');
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    const { prompt: jobDescription } = await req.json();
    console.log('[fit-assessment] Job description length:', jobDescription?.length ?? 0);

    if (!jobDescription || typeof jobDescription !== 'string') {
      console.log('[fit-assessment] Invalid job description, rejecting');
      return Response.json({ error: 'Job description is required.' }, { status: 400 });
    }

    if (jobDescription.length > MAX_JD_LENGTH) {
      console.log('[fit-assessment] Job description too long, rejecting');
      return Response.json({ error: 'Job description too long.' }, { status: 400 });
    }

    // Check if input is a URL
    let jobDescriptionText = jobDescription;

    if (isUrl(jobDescription)) {
      console.log('[fit-assessment] Detected URL, fetching content...');
      const urlToFetch = jobDescription.trim();

      try {
        const response = await fetch(urlToFetch, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitAssessmentBot/1.0)' },
          signal: AbortSignal.timeout(URL_FETCH_TIMEOUT),
        });

        if (!response.ok) {
          console.log('[fit-assessment] URL fetch failed with status:', response.status);
          return Response.json(
            {
              error: `Could not access the job posting (HTTP ${response.status}). Please copy and paste the job description text directly.`,
            },
            { status: 400 }
          );
        }

        const html = await response.text();
        const textContent = extractTextFromHtml(html);
        console.log('[fit-assessment] Extracted content length:', textContent.length);

        if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
          console.log('[fit-assessment] Extracted content too short');
          return Response.json(
            {
              error:
                'Could not extract job description from that URL. The page may require login or block automated access. Please copy and paste the job description text directly.',
            },
            { status: 400 }
          );
        }

        jobDescriptionText = textContent;
      } catch (err) {
        console.error('[fit-assessment] URL fetch error:', err);
        return Response.json(
          {
            error:
              'Could not fetch the job posting. The site may be unavailable or blocking access. Please copy and paste the job description text directly.',
          },
          { status: 400 }
        );
      }
    }

    // Use generated prompt in production, fall back to runtime fetch in development
    console.log('[fit-assessment] Loading system prompt (generated:', isGeneratedPromptAvailable, ')');
    const systemPrompt = isGeneratedPromptAvailable
      ? FIT_ASSESSMENT_PROMPT
      : await getFitAssessmentPrompt();
    console.log('[fit-assessment] System prompt loaded, length:', systemPrompt.length);

    console.log('[fit-assessment] Calling Anthropic API (streaming)...');

    // Streaming API call for progressive text display
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate an Executive Fit Report for this job description:\n\n${jobDescriptionText}`,
        },
      ],
    });

    // Return streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                controller.enqueue(new TextEncoder().encode(event.delta.text));
              }
            }
            controller.close();
            console.log('[fit-assessment] Stream completed');
          } catch (streamError) {
            console.error('[fit-assessment] Stream error:', streamError);
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
    console.error('[fit-assessment] Error:', error);
    console.error('[fit-assessment] Stack:', error instanceof Error ? error.stack : 'No stack');
    return Response.json(
      { error: 'AI service error.' },
      { status: 503 }
    );
  }
}
