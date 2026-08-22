/**
 * Experience match — the Fit Score's 40-point component (ENG-1995).
 *
 * ## What it scores against, and why it is not the résumé
 *
 * A1: this component reads the **career-data corpus**, not the one-page résumé.
 * Fit asks "have I done this kind of work" — a fact about D's career, not about
 * his formatting. The résumé path saw 21 highlight bullets; the corpus is
 * ~14.3k words across six files. A role dropped because the one-pager omitted
 * something he genuinely did is a false negative he never sees.
 *
 * A2: every award names the corpus file and quotes it verbatim. The rubric's own
 * citation check clamps an uncited score to zero; `attributeCitation` extends
 * that to "cited, and we can say which file" — a richer corpus must not become a
 * licence to infer.
 *
 * A3: a corpus that will not load throws. It never falls back to the résumé.
 *
 * This is the runner that `resume-rubric.ts` (ENG-1565) was built for and never
 * had: it turns the locked rubric into three model calls, one per dimension, and
 * feeds the graded results back through the rubric's own evidence-grounding.
 *
 * Every mechanism the rubric module documents survives here intact — one call
 * per dimension (kills criteria-order bias), permuted options against a seed
 * (kills position bias without losing reproducibility), and a verbatim citation
 * or the score clamps to zero.
 *
 * ## Determinism
 *
 * `job_pipeline.py`'s canary re-scores one known role per run and alarms on
 * drift beyond a tolerance justified by a measured zero noise floor. That floor
 * was measured on a pure function; this component is not one. Two things keep
 * the noise as low as it can go: `temperature: 0`, and a seed derived from the
 * job description itself rather than from the clock or a random source — so a
 * re-score of an unchanged posting presents byte-identical prompts. ENG-1994
 * re-measures the canary's real noise floor and resizes the tolerance against
 * it rather than inheriting a number that no longer describes the scorer.
 */

import {
  RUBRIC_DIMENSIONS,
  buildDimensionCall,
  scoreDimension,
  type DimensionKey,
  type DimensionResult,
  type RawDimensionReply,
} from '@/lib/resume-rubric';
import { FIT_EXPERIENCE_DIMENSIONS } from '@/lib/fit-score';
import { scoringClient, extractTextContent, parseJsonResponse } from '@/lib/score-core';
import { attributeCitation, type CareerCorpus } from '@/lib/career-corpus';

/** Same model the gap-analysis call already uses on this route. */
export const FIT_EXPERIENCE_MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 400;

const SYSTEM_PROMPT =
  'You grade one rubric dimension at a time against verbatim evidence drawn from a career-data corpus. Never infer a capability the corpus does not state. Return JSON only.';

/**
 * FNV-1a over the job description. Deterministic, dependency-free, and stable
 * across processes — the seed must not come from the clock or Math.random or a
 * re-score of an unchanged posting stops being reproducible.
 */
export function seedFor(jobDescription: string): string {
  let h = 2166136261;
  for (let i = 0; i < jobDescription.length; i++) {
    h ^= jobDescription.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

/**
 * The one call shape this module makes. Declared structurally rather than as
 * `Pick<Anthropic, 'messages'>` so a test can supply a two-line fake instead of
 * a whole SDK namespace (batches, stream, countTokens, _client).
 */
export interface DimensionCallRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral'; ttl: '1h' } }>;
  messages: Array<{ role: 'user'; content: string }>;
}

export interface DimensionMessageClient {
  messages: { create: (body: DimensionCallRequest) => Promise<{ content: unknown }> };
}

export interface ExperienceMatchOptions {
  /** Injectable for tests; defaults to the shared Anthropic client. */
  client?: DimensionMessageClient;
}

/** A graded dimension plus the corpus file its evidence came from (A2). */
export interface CorpusDimensionResult extends DimensionResult {
  /** Basename of the corpus file the quote was found in; null when unattributable. */
  sourceFile: string | null;
}

/**
 * Grade the three Fit-path dimensions concurrently.
 *
 * A dimension whose call fails is scored `absent` rather than aborting the role:
 * a transport error is not evidence of a poor match, but it must not silently
 * inflate the component either, and zero is the conservative direction. The
 * failure is logged so a run that loses dimensions wholesale is visible.
 */
export async function scoreExperienceDimensions(
  corpus: CareerCorpus,
  jobDescription: string,
  options: ExperienceMatchOptions = {}
): Promise<CorpusDimensionResult[]> {
  const client = options.client ?? (scoringClient as unknown as DimensionMessageClient);
  const seed = seedFor(jobDescription);
  // The rubric's own machinery is reused unchanged; the "resume" it grades
  // against is the delimited corpus document, so `citationAppearsIn` verifies
  // the quote against everything true rather than everything currently written
  // down. `attributeCitation` then resolves WHICH file it came from.
  const corpusText = corpus.document;

  const specs = FIT_EXPERIENCE_DIMENSIONS.map((key: DimensionKey) => {
    const spec = RUBRIC_DIMENSIONS.find((d) => d.key === key);
    if (!spec) throw new Error(`fit-experience: unknown rubric dimension "${key}"`);
    return spec;
  });

  return Promise.all(
    specs.map(async (spec) => {
      const call = buildDimensionCall(spec, corpusText, jobDescription, seed);
      let reply: RawDimensionReply = {};
      try {
        const message = await client.messages.create({
          model: FIT_EXPERIENCE_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral', ttl: '1h' },
            },
          ],
          messages: [{ role: 'user', content: call.prompt }],
        });
        const text = extractTextContent(
          message.content as Array<{ type: string; text?: string }>
        );
        reply = parseJsonResponse(text) as RawDimensionReply;
      } catch (error) {
        console.warn(
          `[fit-experience] dimension "${spec.key}" failed, scoring absent:`,
          error
        );
        reply = {};
      }
      const graded = scoreDimension(call, reply, corpusText, jobDescription);
      const sourceFile = attributeCitation(graded.resumeQuote, corpus.sources);
      // A2: cited-but-unattributable is not evidence. The rubric already
      // clamped a quote it could not find at all; this clamps one we cannot
      // pin to a named file.
      if (graded.score > 0 && sourceFile === null) {
        return { ...graded, score: 0, band: 'absent' as const, evidenceRejected: true, sourceFile: null };
      }
      return { ...graded, sourceFile };
    })
  );
}
