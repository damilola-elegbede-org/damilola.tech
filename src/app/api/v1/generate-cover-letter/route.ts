import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { xmlEscape } from '@/lib/xml-escape';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { logUsage } from '@/lib/usage-logger';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';
import { fetchBlob } from '@/lib/blob';

export const runtime = 'nodejs';
export const maxDuration = 120;

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const MAX_BODY_SIZE = 50 * 1024; // 50KB
const AI_REQUEST_TIMEOUT_MS = 90_000;
const MODEL = 'claude-sonnet-4-6';

// Banned phrases — presence triggers a warning metric, does not block response.
const BANNED_PHRASES = [
  'passionate about',
  'excited to',
  'excited about',
  'would be excited',
  'i am thrilled',
  'leverage',
  'synergy',
  'synergies',
  'dynamic team',
  'dynamic environment',
  'fast-paced environment',
  'team player',
  'thought leader',
  'thought leadership',
];

function countWords(text: string): number {
  // Strip YAML frontmatter before counting
  const stripped = text.replace(/^---[\s\S]*?---\n?/, '');
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

function containsEmDash(text: string): boolean {
  return text.includes('\u2014') || text.includes('&mdash;');
}

function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

function extractFrontmatterField(text: string, field: string): string {
  const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

async function getCoverLetterSystemPrompt(): Promise<string> {
  // Try blob first, then fall back to local career-data file
  const blobContent = await fetchBlob('cover-letter.md');
  if (blobContent) return blobContent;

  // Local fallback for development
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const localPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'career-data', 'templates', 'cover-letter.md');
    return await fs.readFile(localPath, 'utf-8');
  } catch {
    throw new Error('Cover letter template not found in blob or locally.');
  }
}

async function getSharedContext(): Promise<{
  resume: string;
  starStories: string;
  leadershipPhilosophy: string;
}> {
  const [resume, starStories, leadershipPhilosophy] = await Promise.all([
    fetchBlob('resume-full.json').catch(() => ''),
    fetchBlob('star-stories.json').catch(() => ''),
    fetchBlob('leadership-philosophy.md').catch(() => ''),
  ]);

  // Local fallbacks for development
  const results = { resume, starStories, leadershipPhilosophy };

  if (!results.resume || !results.starStories || !results.leadershipPhilosophy) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      if (!results.resume) {
        const p = path.join(/*turbopackIgnore: true*/ process.cwd(), 'career-data', 'data', 'resume-full.json');
        results.resume = await fs.readFile(p, 'utf-8').catch(() => '');
      }
      if (!results.starStories) {
        const p = path.join(/*turbopackIgnore: true*/ process.cwd(), 'career-data', 'data', 'star-stories.json');
        results.starStories = await fs.readFile(p, 'utf-8').catch(() => '');
      }
      if (!results.leadershipPhilosophy) {
        const p = path.join(/*turbopackIgnore: true*/ process.cwd(), 'career-data', 'context', 'leadership-philosophy.md');
        results.leadershipPhilosophy = await fs.readFile(p, 'utf-8').catch(() => '');
      }
    } catch {
      // Leave empty — non-fatal
    }
  }

  return results;
}

function buildSystemPrompt(
  template: string,
  jobPosting: string,
  scoreJobOutput: string,
  context: { resume: string; starStories: string; leadershipPhilosophy: string },
  company: string,
  role: string,
  tone: string
): string {
  return template
    .replace('{JOB_POSTING}', xmlEscape(jobPosting))
    .replace('{SCORE_JOB_OUTPUT}', scoreJobOutput === 'unavailable' ? 'unavailable' : xmlEscape(scoreJobOutput))
    .replace('{RESUME_CONTEXT}', context.resume || '*Resume not available.*')
    .replace('{STAR_STORIES}', context.starStories || '*STAR stories not available.*')
    .replace('{LEADERSHIP_PHILOSOPHY}', context.leadershipPhilosophy || '*Leadership philosophy not available.*')
    .replace(/{TONE}/g, tone)
    .replace(/{COMPANY}/g, company || 'Hiring Team')
    .replace(/{ROLE}/g, role || 'this role');
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    // Size guard
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    // Rate limit (reuse resumeGenerator config — same ceiling)
    const rateLimit = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.resumeGenerator, ip);
    if (rateLimit.limited) {
      return Errors.rateLimited(rateLimit.retryAfter || 60);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Errors.validationError('Request body must be a JSON object.');
    }

    // Validate: exactly one of job_posting_url XOR job_posting_text
    const hasUrl = 'job_posting_url' in body && body.job_posting_url !== null && body.job_posting_url !== undefined && body.job_posting_url !== '';
    const hasText = 'job_posting_text' in body && body.job_posting_text !== null && body.job_posting_text !== undefined && body.job_posting_text !== '';

    if (!hasUrl && !hasText) {
      return Errors.validationError('Exactly one of job_posting_url or job_posting_text is required.');
    }
    if (hasUrl && hasText) {
      return Errors.validationError('Provide either job_posting_url or job_posting_text, not both.');
    }

    if (hasUrl && typeof body.job_posting_url !== 'string') {
      return Errors.validationError('job_posting_url must be a string.');
    }
    if (hasText && typeof body.job_posting_text !== 'string') {
      return Errors.validationError('job_posting_text must be a string.');
    }

    // Validate tone
    const VALID_TONES = ['confident', 'warm', 'technical'] as const;
    type Tone = typeof VALID_TONES[number];
    const rawTone = body.tone ?? 'confident';
    if (typeof rawTone !== 'string' || !VALID_TONES.includes(rawTone as Tone)) {
      return Errors.validationError(`tone must be one of: ${VALID_TONES.join(', ')}.`);
    }
    const tone = rawTone as Tone;

    // Optional fields
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const scoreJobOutput = typeof body.score_job_output === 'string' && body.score_job_output.trim()
      ? body.score_job_output
      : 'unavailable';

    // Resolve job posting text
    let jobPostingText: string;
    let inputSource: 'url' | 'text';

    if (hasUrl) {
      const resolved = await resolveJobDescriptionInput(
        body.job_posting_url as string,
        'Mozilla/5.0 (compatible; CoverLetterBot/1.0)'
      );
      jobPostingText = resolved.text;
      inputSource = 'url';
    } else {
      jobPostingText = body.job_posting_text as string;
      inputSource = 'text';
    }

    // Load template and shared context
    let template: string;
    try {
      template = await getCoverLetterSystemPrompt();
    } catch (err) {
      console.error('[generate-cover-letter] Failed to load template:', err);
      return Errors.internalError('Cover letter template unavailable.');
    }

    const context = await getSharedContext();

    // Build the full prompt by filling placeholders
    const filledPrompt = buildSystemPrompt(
      template,
      jobPostingText,
      scoreJobOutput,
      context,
      company,
      role,
      tone
    );

    const startTime = Date.now();

    // Call Anthropic with prompt cache on the system prompt
    let message: Anthropic.Message;
    try {
      message = await client.messages.create(
        {
          model: MODEL,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: filledPrompt,
              cache_control: { type: 'ephemeral', ttl: '1h' },
            },
          ],
          messages: [
            {
              role: 'user',
              content: 'Generate the cover letter now. Return ONLY the markdown output with frontmatter as specified. Do not add any preamble, explanation, or code fences around the output.',
            },
          ],
        },
        { signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) }
      );
    } catch (err) {
      // Check for Anthropic API errors — works both with real SDK and test mocks
      const isAnthropicError = err instanceof Anthropic.APIError ||
        (err instanceof Error && err.name === 'APIError');
      if (isAnthropicError) {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          return Errors.unauthorized('Anthropic API key invalid or missing.');
        }
        console.error('[generate-cover-letter] Anthropic API error:', status, err.message);
        return Errors.internalError('AI generation failed.');
      }
      if (err instanceof Error && (err.name === 'TimeoutError' || /aborted|timeout/i.test(err.message))) {
        return Errors.internalError('Cover letter generation timed out.');
      }
      throw err;
    }

    const durationMs = Date.now() - startTime;

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Errors.internalError('No text content returned from AI.');
    }
    const coverLetterMarkdown = textBlock.text;

    // Extract token usage
    const usage = message.usage;
    const tokenUsage = {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_read: usage.cache_read_input_tokens ?? 0,
    };

    // Post-generation quality checks — warn only, never block
    const wordCount = countWords(coverLetterMarkdown);
    if (wordCount > 400) {
      console.warn(JSON.stringify({
        event: 'cover_letter.word_count_exceeded',
        wordCount,
        threshold: 400,
        company: company || 'unknown',
        role: role || 'unknown',
      }));
    }

    const bannedFound = findBannedPhrases(coverLetterMarkdown);
    if (bannedFound.length > 0) {
      console.warn(JSON.stringify({
        event: 'cover_letter.banned_phrases_detected',
        phrases: bannedFound,
        company: company || 'unknown',
        role: role || 'unknown',
      }));
    }

    if (containsEmDash(coverLetterMarkdown)) {
      console.warn(JSON.stringify({
        event: 'cover_letter.em_dash_detected',
        company: company || 'unknown',
        role: role || 'unknown',
      }));
    }

    // Resolve company/role from frontmatter if not supplied
    const resolvedCompany = company || extractFrontmatterField(coverLetterMarkdown, 'company') || 'Unknown';
    const resolvedRole = role || extractFrontmatterField(coverLetterMarkdown, 'role') || 'Unknown';

    // Extract score_job_fit from frontmatter for metadata
    const fitScoreStr = extractFrontmatterField(coverLetterMarkdown, 'score_job_fit');
    const fitScore = fitScoreStr ? parseInt(fitScoreStr, 10) : 0;

    // Structured usage log (safe fields only — no keys, no prompt content)
    console.log(JSON.stringify({
      type: 'api_usage',
      ts: new Date().toISOString(),
      endpoint: 'cover-letter',
      model: MODEL,
      input_source: inputSource,
      score_job_used: scoreJobOutput !== 'unavailable',
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
      cacheRead: tokenUsage.cache_read,
      wordCount,
      durationMs,
    }));

    // Log to usage logger (fire-and-forget)
    const sessionId = `cover-letter-${crypto.randomUUID()}`;
    logUsage(sessionId, {
      endpoint: 'cover-letter',
      model: MODEL,
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: tokenUsage.cache_read,
      durationMs,
      cacheTtl: '1h',
    }).catch((err) => console.warn('[generate-cover-letter] Failed to log usage:', err));

    // Audit log
    try {
      await logApiAccess('api_cover_letter_generation', authResult.apiKey, {
        inputSource,
        company: resolvedCompany,
        role: resolvedRole,
        scoreJobUsed: scoreJobOutput !== 'unavailable',
        fitScore,
        wordCount,
      }, ip);
    } catch (err) {
      console.warn('[generate-cover-letter] Failed to log audit:', err);
    }

    const responseData = {
      cover_letter_markdown: coverLetterMarkdown,
      metadata: {
        company: resolvedCompany,
        role: resolvedRole,
        generated_at: new Date().toISOString(),
        model: MODEL,
        input_source: inputSource,
        score_job_used: scoreJobOutput !== 'unavailable',
        token_usage: tokenUsage,
      },
    };

    return apiSuccess(responseData);
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }
    console.error('[generate-cover-letter] Unexpected error:', error);
    return Errors.internalError('An unexpected error occurred.');
  }
}
