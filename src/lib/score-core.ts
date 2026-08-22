/**
 * Shared scoring utilities used by both score-resume and score-job routes.
 *
 * Extracted from src/app/api/v1/score-resume/route.ts so that both routes
 * share the same scoring logic and any prompt tuning applies to both.
 */

import Anthropic from '@anthropic-ai/sdk';
import { resumeData } from '@/lib/resume-data';
import { resumeDataToText, type ScorerResumeData } from '@/lib/resume-text';
import {
  RUBRIC_DIMENSIONS, assembleRubric, buildDimensionCall, scoreDimension, MAX_DIMENSION_SCORE,
  type DimensionResult, type RawDimensionReply,
} from '@/lib/resume-rubric';
import { anchor } from '@/lib/resume-anchoring';
import { attributeCitation, buildCorpusDocument, loadCareerCorpus, RESUME_SOURCE_LABEL, type CareerCorpus } from '@/lib/career-corpus';

/**
 * Shared Anthropic client configured with the extended cache TTL beta header.
 * Both scoring routes use this same client instance.
 */
export const scoringClient = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

/**
 * Shared ATS scoring primitives returned by the score and generator APIs.
 */

/**
 * Extracts and concatenates all text blocks from an Anthropic message content array.
 * Anthropic responses may contain multiple text blocks (e.g., cited responses);
 * returning only the first block can silently truncate JSON responses.
 */
export function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

/**
 * Parses a JSON response that may be wrapped in a markdown code fence or
 * surrounded by prose. Throws if no valid JSON object can be extracted.
 */
/**
 * Extract the first COMPLETE JSON object, scanning braces.
 *
 * ENG-2010: the old fallback sliced `indexOf('{')` to `lastIndexOf('}')`. Models
 * routinely emit a valid object and then keep talking — and any `{` or `}` in
 * that trailing prose made the slice span junk, so the parse threw
 * `Invalid JSON response`. Longer, denser job descriptions draw more commentary,
 * which is why this looked like a JD-length or concurrency problem.
 *
 * The cost was not a visible error. `fit-experience` catches a failed dimension
 * call and scores it **absent** — correct for a transport blip, ruinous here:
 * the NVIDIA JD returned Fit experience 10/40 because `domain_evidence` had
 * silently parsed-failed, not because D lacks the domain.
 *
 * String-aware so a brace inside a quoted value cannot end the object early.
 */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJsonResponse(text: string): Record<string, unknown> {
  const parseObject = (value: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid JSON response');
    }
    return parsed as Record<string, unknown>;
  };

  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return parseObject(withoutFence);
  } catch {
    const candidate = firstJsonObject(withoutFence);
    if (candidate) return parseObject(candidate);
    throw new Error('Invalid JSON response');
  }
}


/**
 * Derives total years of experience from the earliest experience startDate to
 * the latest endDate ("Present" counts as now). Returns undefined — never a
 * stale guess — when a date can't be parsed, per ENG-1993 acceptance #3.
 */
export function deriveYearsExperience(
  experiences: Array<{ startDate?: string; endDate?: string }>,
  now: Date = new Date()
): number | undefined {
  const toDate = (value: string | undefined): Date | undefined => {
    if (!value) return undefined;
    if (value.trim().toLowerCase() === 'present') return now;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const starts = experiences.map((e) => toDate(e.startDate)).filter((d): d is Date => d !== undefined);
  const ends = experiences.map((e) => toDate(e.endDate)).filter((d): d is Date => d !== undefined);
  if (starts.length === 0 || ends.length !== experiences.length || starts.length !== experiences.length) {
    return undefined;
  }

  const earliestStart = new Date(Math.min(...starts.map((d) => d.getTime())));
  const latestEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const years = (latestEnd.getTime() - earliestStart.getTime()) / msPerYear;
  return years > 0 ? Math.round(years) : undefined;
}

/**
 * The canonical resumeData singleton, narrowed to the shape the scorers take.
 *
 * Extracted from buildScoringInput so the Fit Score's experience component
 * (ENG-1995) can read the same resume text the readiness scorer sees, without
 * duplicating the narrowing.
 *
 * ENG-1993: experienceTags, tiered skillsAssessment, tagline, and each
 * experience's location/startDate/endDate now pass through instead of being
 * silently dropped. yearsExperience is derived from the date span (see
 * deriveYearsExperience) instead of the hardcoded 15. teamSize has no
 * structured source in resumeData today — asserting the old Verily-era
 * '13 engineers' string would be a stale claim that can never follow D to
 * Visa, so it is left undefined rather than guessed; deriving it needs a real
 * data source, which is unaddressed scope (see the PR/issue comment).
 */
export function buildScorerResumeData(): ScorerResumeData {
  return {
    name: resumeData.name,
    summary: resumeData.brandingStatement,
    title: resumeData.title,
    tagline: resumeData.tagline,
    yearsExperience: deriveYearsExperience(resumeData.experiences),
    teamSize: undefined,
    skills: resumeData.skills.flatMap((s) => s.items),
    skillsByCategory: resumeData.skills,
    skillsAssessment: resumeData.skillsAssessment,
    experienceTags: resumeData.experienceTags,
    experiences: resumeData.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      highlights: e.highlights,
    })),
    education: resumeData.education?.map((e) => ({
      degree: e.degree,
      institution: e.institution,
    })) ?? [],
    openToRoles: resumeData.openToRoles,
  };
}

/** The plain-text resume both scoring paths grade against. */
export function buildResumeText(): string {
  return resumeDataToText(buildScorerResumeData());
}

/**
 * Builds the scorer input (resume text + readiness score) from a job description string.
 * Reads from the canonical resumeData singleton, matching the behaviour of
 * the original score-resume route.
 */
/**
 * 300 tokens truncated the reply mid-string on a long job description, leaving
 * JSON with no closing brace — which surfaced as `Invalid JSON response` and a
 * 500 for the whole role. The reply must carry a VERBATIM corpus quote and a
 * verbatim JD quote, and both scale with the posting; the Google Cloud JD
 * (6,399 chars) failed 3/3 while the shorter NVIDIA one succeeded, which is
 * what made this look like a concurrency or rate limit (ENG-2010 AC7).
 */
const DIMENSION_MAX_TOKENS = 1024;

async function callDimension(call: ReturnType<typeof buildDimensionCall>, source: string, jobDescription: string) {
  let reply: RawDimensionReply = {};
  try {
    const message = await scoringClient.messages.create({
      model: 'claude-opus-4-6', max_tokens: DIMENSION_MAX_TOKENS, temperature: 0,
      messages: [{ role: 'user', content: call.prompt }],
    });
    reply = parseJsonResponse(
      extractTextContent(message.content as Array<{ type: string; text?: string }>)
    ) as RawDimensionReply;
  } catch (error) {
    // One unparseable dimension must not cost the whole role — that is the 500
    // D hit. But it must NOT silently read as "no evidence" either: that is
    // exactly how Fit reported 10/40 on a JD squarely in his lane. Scored
    // absent AND marked, so the caller can tell the two apart.
    console.warn(`[scoreAts] dimension "${call.dimension.key}" failed, scoring absent:`, error);
    return { ...scoreDimension(call, {}, source, jobDescription), callFailed: true };
  }
  return { ...scoreDimension(call, reply, source, jobDescription), callFailed: false };
}

/**
 * Zero headroom below the 90 target is not a verdict — it is the signature of a
 * ceiling lookup that failed to attribute anything (ENG-2010).
 */
export class AtsHeadroomUnverifiedError extends Error {
  constructor(
    public readonly current: number,
    public readonly maximum: number,
    public readonly attributionFailures: string[]
  ) {
    super(
      `ATS reports zero headroom at ${current}/100 with a ceiling of ${maximum} — ` +
        `below the 90 target, so "already maximal" cannot be true. ` +
        `Unattributable corpus citations: ${attributionFailures.join(', ') || 'none'}.`
    );
    this.name = 'AtsHeadroomUnverifiedError';
  }
}

/**
 * What the ceiling pass actually emits. `DimensionResult` declares none of
 * these, and the assignment compiled only because `bounded` is a variable, so
 * excess-property checking never ran.
 */
export interface CeilingBoundedDimension extends DimensionResult {
  ceilingScore: number;
  ceilingSourceFile: string | null;
  attributionFailed: boolean;
}

export interface AtsScore {
  current: { total: number; breakdown: CeilingBoundedDimension[] };
  max: { total: number; breakdown: CeilingBoundedDimension[]; reachesTarget90: boolean };
  gap: number;
  gapLine: string;
  /** Dimensions where the model quoted the corpus but we could not attribute it. */
  attributionFailures: string[];
  resumeGap: { achievable: number; closeable: number; structural: number };
}

/** Scores exactly the five locked dimensions; current reads only the submitted resume. */
/**
 * Opus calls per role, run at a bounded width.
 *
 * ENG-2010 AC10: `Promise.all` over 5 dimension calls plus 3 corpus calls put
 * EIGHT concurrent Opus requests in flight. The Google JD (6,399 chars) failed
 * 3 of 3 attempts with a generic `AI service error` in ~10s while the shorter
 * NVIDIA JD (3,961) succeeded — the failure tracked JD size against fan-out,
 * not anything about the posting. That is the role D clears every stated
 * minimum for, so this was the defect actually blocking an application.
 *
 * 3 is below any per-key concurrency limit we have seen bite and still keeps
 * the eight calls inside a couple of round-trip waves.
 */
const ATS_CALL_CONCURRENCY = 3;

/** Bounded-width map. Preserves input order; failures propagate. */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * The ceiling a dimension may report.
 *
 * ENG-2010 AC5: the response shipped the raw pre-clamp value while the maths
 * used the clamped one, so the API emitted ceilings BELOW the achieved score —
 * `leadership_evidence` score 3 / ceiling 0. A ceiling under the observed score
 * is impossible on its face and made the whole payload untrustworthy.
 *
 * Exported so the clamp is testable on its own; inline it was unreachable by
 * any mutation a test could catch.
 */
export function boundedCeiling(score: number, corpusSupported: number | undefined): number {
  return Math.max(score, Math.min(MAX_DIMENSION_SCORE, corpusSupported ?? score));
}

export async function scoreAts(jobDescription: string, corpus?: CareerCorpus): Promise<AtsScore> {
  const resumeText = buildResumeText();
  const careerCorpus = corpus ?? await loadCareerCorpus(resumeText);
  const seed = `${jobDescription.length}:${resumeText.length}`;
  const calls = RUBRIC_DIMENSIONS.map((d) => buildDimensionCall(d, resumeText, jobDescription, seed));
  const dimensions = await mapWithLimit(calls, ATS_CALL_CONCURRENCY, (call) =>
    callDimension(call, resumeText, jobDescription)
  );
  const addressable = RUBRIC_DIMENSIONS.filter((d) => d.ceiling === 'addressable');
  // The ceiling answers "what could the résumé truthfully say if rewritten
  // using career-corpus evidence" — a citation landing only in the résumé
  // itself proves nothing beyond what `current` already scored, so it must
  // not be accepted as ceiling support. The résumé stays in the model's
  // context (it's still part of `careerCorpus.document`); only attribution
  // excludes it.
  const nonResumeSources = careerCorpus.sources.filter((s) => s.file !== RESUME_SOURCE_LABEL);
  // ENG-2010: the ceiling pass is given a document of NON-RÉSUMÉ sources only.
  //
  // It used to grade the full `careerCorpus.document`, which puts the résumé
  // first, and then attribution excluded the résumé. So the model read
  // top-down, quoted the most salient line — usually the résumé — and the
  // citation correctly attributed to nothing. Ceiling 0. That read as "the
  // corpus holds nothing more" when the truth was "we asked the wrong question":
  // the pool was never empty, the model was pointed at the part of it that
  // cannot, by definition, prove headroom.
  //
  // Narrowing the document also makes `scoreDimension`'s own citation check
  // validate against the same text attribution will search, so the two can no
  // longer disagree.
  const ceilingDocument = buildCorpusDocument(nonResumeSources);
  const corpusScores = await mapWithLimit(addressable, ATS_CALL_CONCURRENCY, async (dimension) => {
    const call = buildDimensionCall(dimension, ceilingDocument, jobDescription, `${seed}:corpus`);
    const scored = await callDimension(call, ceilingDocument, jobDescription);
    const sourceFile = attributeCitation(scored.resumeQuote, nonResumeSources);
    // AC3: a failed attribution and a genuine no-headroom verdict used to emit
    // byte-identical output, so a broken matcher read as a confident "already
    // maximal". They are now distinguishable: `attributionFailed` means the
    // model quoted something we could not verify, NOT that the corpus is empty.
    return [
      dimension.key,
      {
        score: sourceFile ? scored.score : 0,
        sourceFile,
        attributionFailed: Boolean(scored.resumeQuote) && sourceFile === null,
        quoted: Boolean(scored.resumeQuote),
      },
    ] as const;
  });
  const support = new Map(corpusScores);
  const bounded = dimensions.map((d) => {
    const s = support.get(d.dimension);
    return {
      ...d,
      // AC5: emit the value the maths actually uses. Shipping the raw pre-clamp
      // number produced ceilings BELOW the achieved score (score 3 / ceiling 0),
      // which is impossible on its face and made the payload untrustworthy.
      ceilingScore: boundedCeiling(d.score, s?.score),
      ceilingSourceFile: s?.sourceFile ?? null,
      attributionFailed: s?.attributionFailed ?? false,
    };
  });
  const rubric = assembleRubric(bounded);
  // Keep the anchoring module in the real scoring path. It intentionally emits no fourth score.
  anchor(rubric, []);
  const current = rubric.total * 5;
  const maximum = rubric.ceiling * 5;
  const gap = maximum - current;

  // AC4 — D's invariant, encoded: "We should always be able to improve the ATS
  // score unless it is already in the 90s." A zero gap below 90 is therefore a
  // DEFECT SIGNAL, not a verdict. The endpoint previously returned ATS 55,
  // Max 55, gap 0, zero proposed changes — and reported success.
  //
  // It is a flag rather than a throw: the scores themselves are still the best
  // information available, and refusing to answer would be worse than answering
  // with the caveat attached. But it must never render as "already maximal".
  const attributionFailures = bounded.filter((d) => d.attributionFailed).map((d) => d.dimension);
  const suspect = gap === 0 && maximum < 90;

  // D's ruling: THROW, do not flag. A flag can be ignored, and this state was
  // served as a confident "Already maximal" for weeks. The legitimate exception
  // is max >= 90 — a résumé genuinely at the ceiling may have gap 0 — and
  // excluding it is what keeps this an assertion rather than a coercion.
  if (suspect) {
    throw new AtsHeadroomUnverifiedError(current, maximum, attributionFailures);
  }

  // Below 90, a zero gap is unreachable past this point: `suspect` threw. So the
  // only states left are a real gap, or a genuine ceiling at 90+.
  const gapLine =
    gap === 0
      ? 'Already maximal: the résumé states all truthfully supportable evidence.'
      : maximum >= 90
        ? 'Tailoring pays: true career evidence can reach the ATS (Max) target of 90.'
        : 'Structural mismatch: true career evidence cannot reach the ATS (Max) target of 90.';

  return {
    current: { total: current, breakdown: bounded },
    max: { total: maximum, breakdown: bounded, reachesTarget90: maximum >= 90 },
    gap,
    gapLine,
    attributionFailures,
    // AC6: `resumeGap` shipped {null, null, null} on every response since ENG-1996.
    // Derived here from the rubric's own addressable/structural split so it has a
    // real producer rather than a placeholder.
    // `achievable` IS the addressable sum — ceilingFor() sums ceilingScore, so
    // the two were the same number reported twice. Kept as the headline value
    // with `closeable` naming the same thing per-dimension, and `structural`
    // the part no rewrite reaches.
    resumeGap: {
      achievable: gap,
      closeable: bounded
        .filter((d) => RUBRIC_DIMENSIONS.find((r) => r.key === d.dimension)?.ceiling === 'addressable')
        .reduce((n, d) => n + (d.ceilingScore - d.score) * 5, 0),
      structural: bounded
        .filter((d) => RUBRIC_DIMENSIONS.find((r) => r.key === d.dimension)?.ceiling === 'structural')
        .reduce((n, d) => n + (MAX_DIMENSION_SCORE - d.score) * 5, 0),
    },
  };
}
