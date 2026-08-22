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
import { buildResumeText, scoreAts, type AtsScore } from '@/lib/score-core';
import { getResumeGeneratorPrompt } from '@/lib/resume-generator-prompt';
import type { ProposedChange } from '@/lib/types/resume-generation';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';

export const runtime = 'nodejs';
export const maxDuration = 120;

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const MAX_BODY_SIZE = 50 * 1024;
const AI_REQUEST_TIMEOUT_MS = 90_000;

function buildScoreContext(score: AtsScore): string {
  return `<ats_scores>
ATS (résumé only): ${score.current.total}/100
ATS (Max, truthful corpus ceiling): ${score.max.total}/100
Addressable gap: ${score.gap}
${score.gapLine}

Return only suggested rewrites for addressable gaps. Each proposedChanges item MUST contain
original (an exact current résumé line), modified, reason, and jdRequirement (an exact JD requirement).
Never propose a rewrite for a structural gap. Do not return scores or impact points.
</ats_scores>`;
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  const textBlock = content.find((block) => block.type === 'text' && typeof block.text === 'string');
  return textBlock?.text ?? '';
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Invalid JSON response');
  }
}

function sharesSpecificTerm(resumeLine: string, requirement: string): boolean {
  const words = (value: string) => new Set(value.toLowerCase().match(/[a-z][a-z0-9/+.-]{3,}/g) ?? []);
  const ignored = new Set(['with', 'that', 'this', 'from', 'have', 'experience', 'requirements', 'engineering', 'leadership']);
  const resumeWords = words(resumeLine);
  return [...words(requirement)].some((word) => !ignored.has(word) && resumeWords.has(word));
}

function normalizeChanges(changes: unknown, resumeText: string, jobDescription: string, gap: number): ProposedChange[] {
  if (!Array.isArray(changes)) {
    return [];
  }

  // Anchors are evidence, not model assertions: `original` must be a whole
  // résumé line verbatim, not merely a substring somewhere in the document —
  // a fragment match would let an unrelated line "anchor" a claim.
  const resumeLines = new Set(
    resumeText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  );

  return changes
    .filter((change) => change && typeof change === 'object')
    .map((change) => {
      const value = change as Record<string, unknown>;
      const original = typeof value.original === 'string' ? value.original.trim() : '';
      const modified = typeof value.modified === 'string' ? value.modified.trim() : '';
      const jdRequirement = typeof value.jdRequirement === 'string' ? value.jdRequirement.trim() : '';
      return {
        section: typeof value.section === 'string' ? value.section : 'unknown',
        original,
        modified,
        reason: typeof value.reason === 'string' ? value.reason : '',
        relevanceSignals: [jdRequirement],
        impactPoints: 0,
      };
    })
    .filter((change) => change.original.length > 0 && change.relevanceSignals[0].length > 0 &&
      resumeLines.has(change.original) &&
      // A rewrite must actually propose different text.
      change.modified.length > 0 && change.modified !== change.original &&
      jobDescription.includes(change.relevanceSignals[0]) &&
      sharesSpecificTerm(change.original, change.relevanceSignals[0]))
    .map((change, index, valid) => ({
      ...change,
      // This is an exact ATS-gap allocation, never a rescale of model estimates.
      impactPoints: Math.floor(gap / valid.length) + (index < gap % valid.length ? 1 : 0),
    }));
}

function extractGaps(gaps: unknown): string[] {
  if (!Array.isArray(gaps)) {
    return [];
  }

  return gaps
    .map((gap) => {
      if (typeof gap === 'string') {
        return gap;
      }
      if (gap && typeof gap === 'object' && typeof (gap as Record<string, unknown>).requirement === 'string') {
        return (gap as Record<string, unknown>).requirement as string;
      }
      return '';
    })
    .filter((gap) => gap.length > 0);
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    const rateLimit = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.resumeGenerator, ip);
    if (rateLimit.limited) {
      return Errors.rateLimited(rateLimit.retryAfter || 60);
    }

    let body: { input?: unknown };
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    if (!body.input || typeof body.input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    const resolvedInput = await resolveJobDescriptionInput(
      body.input,
      'Mozilla/5.0 (compatible; ResumeGeneratorBot/1.0)'
    );

    const systemPrompt = await getResumeGeneratorPrompt();
    const atsScore = await scoreAts(resolvedInput.text);
    const resumeText = buildResumeText();

    const message = await (async () => {
      try {
        return await client.messages.create(
          {
            model: 'claude-opus-4-6',
            max_tokens: 8192,
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
                content: `${buildScoreContext(atsScore)}\n\nAnalyze this job description and provide anchored ATS rewrite recommendations. Return ONLY valid JSON, no markdown or code blocks.\n\n<job_description>${xmlEscape(resolvedInput.text)}</job_description>`,
              },
            ],
          },
          {
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
          }
        );
      } catch (error) {
        if (
          (error instanceof Error && error.name === 'TimeoutError') ||
          (error instanceof Error && /aborted|timeout/i.test(error.message))
        ) {
          return null;
        }
        throw error;
      }
    })();

    if (!message) {
      return Errors.internalError('Resume generation timed out');
    }

    const aiText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(aiText);

    const analysis = parsed.analysis && typeof parsed.analysis === 'object'
      ? parsed.analysis as Record<string, unknown>
      : {};

    const proposedChanges = normalizeChanges(parsed.proposedChanges, resumeText, resolvedInput.text, atsScore.gap);
    const points = proposedChanges.reduce((sum, change) => sum + change.impactPoints, 0);
    if (points !== atsScore.gap) {
      throw new Error(`ATS addressable gap mismatch: changes total ${points}, ATS gap ${atsScore.gap}`);
    }

    const responseData = {
      generationId: crypto.randomUUID(),
      companyName: typeof analysis.companyName === 'string'
        ? analysis.companyName
        : (typeof parsed.companyName === 'string' ? parsed.companyName : 'Unknown'),
      roleTitle: typeof analysis.roleTitle === 'string'
        ? analysis.roleTitle
        : (typeof parsed.roleTitle === 'string' ? parsed.roleTitle : 'Unknown'),
      atsScore,
      proposedChanges,
      gapsIdentified: extractGaps(parsed.gaps),
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
    };

    try {
      await logApiAccess('api_resume_generation', authResult.apiKey, {
        inputType: resolvedInput.inputType,
        extractedUrl: resolvedInput.extractedUrl,
        atsCurrent: responseData.atsScore.current.total,
        atsMax: responseData.atsScore.max.total,
        proposedChanges: responseData.proposedChanges.length,
      }, ip);
    } catch (error) {
      console.warn('[api/v1/resume-generator] Failed to log audit:', error);
    }

    return apiSuccess(responseData);
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/resume-generator] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
