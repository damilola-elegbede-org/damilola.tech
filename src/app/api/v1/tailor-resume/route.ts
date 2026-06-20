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
import { resumeData } from '@/lib/resume-data';

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic();

const DEFAULT_MAX_BULLETS = 5;
const MAX_JD_BYTES = 100 * 1024;

function collectBullets(data: typeof resumeData): string[] {
  return (data.experiences ?? []).flatMap((exp) =>
    (exp.highlights ?? []).map(
      (h: string) => `[${exp.company} — ${exp.title}] ${h}`
    )
  );
}

function buildTailorPrompt(jd: string, bullets: string[], maxBullets: number): string {
  const bulletList = bullets
    .map((b, i) => `${i + 1}. ${b}`)
    .join('\n');

  return `You are a resume tailoring assistant. Given a job description and a list of experience bullets from a senior engineering leader's resume, select and rank the ${maxBullets} most relevant bullets.

Return ONLY valid JSON with this exact structure (no markdown fences):
{
  "top_bullets": ["bullet text without the company prefix", ...],
  "rationale": "one sentence explaining why these bullets were selected",
  "skills_match": ["skill1", "skill2", ...]
}

Rules:
- Return exactly up to ${maxBullets} bullets in top_bullets (may be fewer if fewer bullets are relevant).
- Strip the "[Company — Title] " prefix from each bullet in the output — return only the bullet text itself.
- skills_match should list specific technical/leadership skills from the JD that D's bullets demonstrate (max 8).
- rationale must be a single sentence.

<job_description>
${xmlEscape(jd)}
</job_description>

<experience_bullets>
${bulletList}
</experience_bullets>`;
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  const block = content.find((b) => b.type === 'text' && typeof b.text === 'string');
  return block?.text ?? '';
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  const rateLimit = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.tailorResume, ip);
  if (rateLimit.limited) {
    return Errors.rateLimited(rateLimit.retryAfter ?? 60);
  }

  let body: unknown;
  try {
    body = await req.json() as unknown;
  } catch {
    return Errors.badRequest('Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Errors.validationError('Request body must be a JSON object.');
  }

  const { job_description: jd, max_bullets: maxBulletsRaw } = body as Record<string, unknown>;

  if (typeof jd !== 'string' || jd.trim().length === 0) {
    return Errors.validationError('"job_description" is required and must be a non-empty string.');
  }

  if (new TextEncoder().encode(jd).byteLength > MAX_JD_BYTES) {
    return Errors.badRequest('"job_description" exceeds size limit.');
  }

  const maxBullets =
    typeof maxBulletsRaw === 'number' && Number.isInteger(maxBulletsRaw) && maxBulletsRaw > 0
      ? maxBulletsRaw
      : DEFAULT_MAX_BULLETS;

  const bullets = collectBullets(resumeData);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: 'You are a precise resume tailoring assistant. Return only valid JSON as instructed.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildTailorPrompt(jd.trim(), bullets, maxBullets),
        },
      ],
    });

    const responseText = extractTextContent(
      message.content as Array<{ type: string; text?: string }>
    );
    const parsed = parseJsonResponse(responseText);

    const topBullets = Array.isArray(parsed.top_bullets)
      ? (parsed.top_bullets as unknown[]).filter((b) => typeof b === 'string')
      : [];
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';
    const skillsMatch = Array.isArray(parsed.skills_match)
      ? (parsed.skills_match as unknown[]).filter((s) => typeof s === 'string')
      : [];

    logApiAccess('api_tailor_resume', authResult.apiKey, {
      maxBullets,
      bulletsReturned: topBullets.length,
      jdLength: jd.length,
    }, ip).catch((err: unknown) => {
      console.warn('[api/v1/tailor-resume] Failed to log audit:', err);
    });

    return apiSuccess({ top_bullets: topBullets, rationale, skills_match: skillsMatch });
  } catch (error) {
    console.error('[api/v1/tailor-resume] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
