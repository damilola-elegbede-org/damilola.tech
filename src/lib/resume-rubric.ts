/**
 * Stage C — evidence-grounded resume↔JD rubric (ENG-1565).
 *
 * Evidence brief: Clara vault `Career/Consulting/2026-07-23-ats-scoring-algorithm-dd.md`
 * (deep-research, 28 sources, 25 claims adversarially verified).
 *
 * The brief's finding 4 is the design constraint: GPT-4-class rubric scores are
 * NOT trustworthy as absolute numbers. Pearson 0.57 at best, Fleiss' kappa ≈ 0,
 * and the errors are *systematic and directional* — lenient on skills, strict on
 * certifications, hallucinated requirements (n=35), inferred skills (n=31).
 * Repeated runs do not average that away. So every mechanism here exists to
 * constrain the model rather than to average it:
 *
 *  - the rubric is LOCKED — fixed dimensions, fixed wording, versioned. Nothing
 *    is regenerated per call, so a score means the same thing across runs.
 *  - each dimension is its own call, which is what kills criteria-order bias
 *    (finding 5: criteria order shifts results, direction varies by model, and
 *    there is no universal correction to apply after the fact).
 *  - the score options are permuted per call against a deterministic seed, so
 *    position bias cannot align with the scale the same way twice, and the run
 *    is still reproducible.
 *  - a score must cite VERBATIM text, and we verify the citation appears in the
 *    source. An uncited score is not a low-confidence score, it is not evidence
 *    at all, and it is clamped to zero.
 *
 * The ceiling is arithmetic, never generated. `readiness-scorer`'s LLM-produced
 * `maxPossibleScore` returned 58 and 78 for the same posting on the same day —
 * a ceiling that moves 20 points on re-ask is not a ceiling. Here it is derived
 * from which dimensions a rewrite can actually move.
 */

export const RUBRIC_VERSION = '1.0.0';

export type DimensionKey =
  | 'requirement_coverage'
  | 'scope_evidence'
  | 'domain_evidence'
  | 'leadership_evidence'
  | 'impact_evidence';

/** A dimension a rewrite can move, versus one bounded by biography. */
export type CeilingKind = 'addressable' | 'structural';

export interface RubricDimension {
  readonly key: DimensionKey;
  readonly label: string;
  /** Locked. Editing this is a RUBRIC_VERSION bump, not a tweak. */
  readonly question: string;
  readonly ceiling: CeilingKind;
}

export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  {
    key: 'requirement_coverage',
    label: 'Requirement coverage',
    question:
      'Does the resume evidence the explicit must-have requirements stated in the job description?',
    // A real requirement that is met but unstated can be surfaced by rewriting.
    ceiling: 'addressable',
  },
  {
    key: 'scope_evidence',
    label: 'Scope evidence',
    question:
      'Does the resume evidence leading an organisation of the size and number of layers this role describes?',
    // You cannot rewrite your way into having run a larger org.
    ceiling: 'structural',
  },
  {
    key: 'domain_evidence',
    label: 'Domain evidence',
    question:
      'Does the resume evidence hands-on depth in the technical domain this role is accountable for?',
    ceiling: 'structural',
  },
  {
    key: 'leadership_evidence',
    label: 'Leadership evidence',
    question:
      'Does the resume evidence hiring, developing, performance-managing and retaining engineers and engineering leaders?',
    // Almost always present in a senior EM career and almost always under-stated.
    ceiling: 'addressable',
  },
  {
    key: 'impact_evidence',
    label: 'Impact evidence',
    question:
      'Does the resume evidence outcomes with named, quantified business or systems impact?',
    ceiling: 'addressable',
  },
] as const;

/** Locked band language. The model picks a band; it never invents a number. */
export const RUBRIC_BANDS = [
  { band: 'absent', score: 0, text: 'No evidence in the resume.' },
  { band: 'weak', score: 1, text: 'Adjacent evidence only; a reader must infer it.' },
  { band: 'partial', score: 2, text: 'Directly relevant evidence, but narrower than the role asks.' },
  { band: 'strong', score: 3, text: 'Directly relevant evidence at the scale the role asks.' },
  { band: 'exemplary', score: 4, text: 'Evidence exceeding what the role asks, stated explicitly.' },
] as const;

export type Band = (typeof RUBRIC_BANDS)[number]['band'];
export const MAX_DIMENSION_SCORE = 4;
export const MAX_TOTAL = RUBRIC_DIMENSIONS.length * MAX_DIMENSION_SCORE;

export interface DimensionResult {
  dimension: DimensionKey;
  score: number;
  band: Band;
  /** Verbatim from the resume. null when the model cited nothing verifiable. */
  resumeQuote: string | null;
  /** Verbatim from the job description. */
  jdQuote: string | null;
  /** True when a nonzero score was clamped for citing text we could not find. */
  evidenceRejected: boolean;
  /** The band order actually presented, so a run can be reproduced exactly. */
  optionOrder: Band[];
  /** Highest band supported by a separately cited career-corpus observation. */
  ceilingScore?: number;
}

export interface RubricResult {
  rubricVersion: string;
  total: number;
  maxTotal: number;
  /** Arithmetic, not generated. See ceilingFor(). */
  ceiling: number;
  dimensions: DimensionResult[];
}

/**
 * Deterministic permutation. Seeded from the dimension key and a per-run seed so
 * two runs of the same pair present options identically — position bias is
 * mitigated across dimensions without making the run irreproducible, which is
 * what the AC's repeatability check needs.
 */
export function permuteBands(key: string, seed: string): Band[] {
  const bands = RUBRIC_BANDS.map((b) => b.band);
  let h = 2166136261;
  for (const ch of `${key}:${seed}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Fisher-Yates driven by the hash — no Math.random, so no hidden nondeterminism.
  for (let i = bands.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
    const j = h % (i + 1);
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }
  return bands;
}

/** Whitespace-insensitive containment — models re-wrap quotes they copied faithfully. */
export function citationAppearsIn(quote: string | null | undefined, source: string): boolean {
  if (!quote) return false;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const q = norm(quote);
  if (q.length < 12) return false; // too short to be evidence of anything
  return norm(source).includes(q);
}

/**
 * The ceiling a truthful rewrite could reach.  Addressable does not mean
 * imaginable: it is bounded by a separately cited career-corpus observation.
 *
 * This is the number D asked for — "what is the maximum I can get to" — and it
 * is deliberately arithmetic. Asking a model for it produced 58 and 78 for the
 * same posting on the same day.
 */
export function ceilingFor(dimensions: DimensionResult[]): number {
  return dimensions.reduce((sum, d) => {
    const spec = RUBRIC_DIMENSIONS.find((x) => x.key === d.dimension);
    if (!spec) return sum + d.score;
    const supported = Math.max(d.score, Math.min(MAX_DIMENSION_SCORE, d.ceilingScore ?? d.score));
    return sum + (spec.ceiling === 'addressable' ? supported : d.score);
  }, 0);
}

export interface DimensionCall {
  dimension: RubricDimension;
  optionOrder: Band[];
  prompt: string;
}

/** One locked prompt per dimension. Nothing here varies but the permuted options. */
export function buildDimensionCall(
  dimension: RubricDimension,
  resumeText: string,
  jobDescription: string,
  seed: string
): DimensionCall {
  const optionOrder = permuteBands(dimension.key, seed);
  const options = optionOrder
    .map((b) => `- ${b}: ${RUBRIC_BANDS.find((x) => x.band === b)!.text}`)
    .join('\n');
  const prompt = [
    `Assess ONE dimension. Ignore every other aspect of fit.`,
    ``,
    `Dimension: ${dimension.label}`,
    `Question: ${dimension.question}`,
    ``,
    `Choose exactly one band:`,
    options,
    ``,
    `You MUST quote verbatim from the resume to support the band. Copy the text`,
    `exactly; do not paraphrase, summarise or repair it. If the resume contains`,
    `no supporting text, choose "absent" and return null for resumeQuote. Never`,
    `infer a capability the resume does not state.`,
    ``,
    `Return JSON only: {"band":"<band>","resumeQuote":<string|null>,"jdQuote":<string|null>}`,
    ``,
    `<resume>${resumeText}</resume>`,
    `<job_description>${jobDescription}</job_description>`,
  ].join('\n');
  return { dimension, optionOrder, prompt };
}

export interface RawDimensionReply {
  band?: string;
  resumeQuote?: string | null;
  jdQuote?: string | null;
}

/**
 * Turn one model reply into a scored dimension, enforcing evidence-grounding.
 *
 * A nonzero band whose citation we cannot find in the resume is clamped to zero
 * and flagged. This is the brief's hallucinated-requirements finding made
 * operational: the failure mode is not a wrong number, it is a confident number
 * with nothing under it, and only the citation check can tell them apart.
 */
export function scoreDimension(
  call: DimensionCall,
  reply: RawDimensionReply,
  resumeText: string,
  jobDescription: string
): DimensionResult {
  const chosen = RUBRIC_BANDS.find((b) => b.band === reply.band);
  const band: Band = chosen ? chosen.band : 'absent';
  const rawScore = chosen ? chosen.score : 0;

  const resumeQuote = citationAppearsIn(reply.resumeQuote, resumeText)
    ? (reply.resumeQuote as string)
    : null;
  const jdQuote = citationAppearsIn(reply.jdQuote, jobDescription)
    ? (reply.jdQuote as string)
    : null;

  const evidenceRejected = rawScore > 0 && resumeQuote === null;
  return {
    dimension: call.dimension.key,
    score: evidenceRejected ? 0 : rawScore,
    band: evidenceRejected ? 'absent' : band,
    resumeQuote,
    jdQuote,
    evidenceRejected,
    optionOrder: call.optionOrder,
  };
}

export function assembleRubric(dimensions: DimensionResult[]): RubricResult {
  return {
    rubricVersion: RUBRIC_VERSION,
    total: dimensions.reduce((s, d) => s + d.score, 0),
    maxTotal: MAX_TOTAL,
    ceiling: ceilingFor(dimensions),
    dimensions,
  };
}
