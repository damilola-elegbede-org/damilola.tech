/**
 * Stage C — pairwise anchoring and calibration (ENG-1566).
 *
 * Evidence brief: Clara vault `Career/Consulting/2026-07-23-ats-scoring-algorithm-dd.md`.
 *
 * Two findings shape this file, and one of them is a refusal.
 *
 * Finding 5: raw absolute 0-100 LLM scores are the least reliable format;
 * anchored comparison against exemplar pairs is comparatively more consistent.
 * Note "comparatively" — the stronger claim that pairwise is UNIVERSALLY most
 * consistent was killed 0-3 during verification, so nothing here treats
 * anchoring as correct, only as better-behaved than a bare number.
 *
 * Finding 6 is the refusal. ConFit v2's error analysis found 43% of ranking
 * errors come from factors invisible in resume+JD text at all, and a further
 * 33% from the competing-candidate pool we cannot see. No calibration recovers
 * those. A point score gating an 85 threshold is therefore false precision, and
 * this module will not emit one until a calibration has been validated against
 * real outcomes. Until then callers get a band and an explicit `calibrated:
 * false`.
 *
 * The exemplar set does not exist yet — that is ENG-1567, validating against D's
 * real application and callback history. The machinery is here so that when the
 * exemplars land, validating is a function call rather than a project. The
 * brief also records that "~100 anchors suffice" was REFUTED (1-2), so the
 * required set size is genuinely unknown; nothing here assumes a number.
 */

import { MAX_TOTAL, type RubricResult } from './resume-rubric';

export const CALIBRATION_VERSION = '0.0.0-uncalibrated';

/** Application gates these scores ultimately feed (ENG-1972 owns their values). */
export const GATE_HIGH = 85;
export const GATE_DIGEST = 80;

export interface ExemplarPair {
  id: string;
  /** Rubric total for the exemplar, produced by the same locked rubric. */
  rubricTotal: number;
  /** Observed outcome. This is the ground truth calibration needs. */
  outcome: 'callback' | 'no_callback';
}

export type FitBand = 'unlikely' | 'possible' | 'likely' | 'strong';

export interface AnchoredResult {
  /** Where the candidate sits against the exemplars, 0..1. Null with no exemplars. */
  percentile: number | null;
  band: FitBand;
  /** How many exemplars the band rests on. Zero means the band is prior-only. */
  anchorCount: number;
  /** False until a calibration passes all three metrics. Never fake this. */
  calibrated: boolean;
  calibrationVersion: string;
  /**
   * A point score, ONLY when calibrated. Null otherwise — deliberately not an
   * uncalibrated approximation, because a number downstream can compare against
   * 85 is exactly what finding 6 says we must not hand out.
   */
  pointScore: number | null;
  /** Plain-language reason the number is or is not trustworthy. */
  caveat: string;
}

/** Band thresholds on the rubric's own scale, used while uncalibrated. */
function priorBand(total: number): FitBand {
  const pct = total / MAX_TOTAL;
  if (pct >= 0.8) return 'strong';
  if (pct >= 0.6) return 'likely';
  if (pct >= 0.35) return 'possible';
  return 'unlikely';
}

/**
 * Rank the candidate against exemplars rather than scoring it absolutely.
 * With no exemplars this degrades to the rubric's own band and says so — it does
 * not invent a percentile.
 */
export function anchor(rubric: RubricResult, exemplars: ExemplarPair[]): AnchoredResult {
  const usable = exemplars.filter((e) => Number.isFinite(e.rubricTotal));
  if (usable.length === 0) {
    return {
      percentile: null,
      band: priorBand(rubric.total),
      anchorCount: 0,
      calibrated: false,
      calibrationVersion: CALIBRATION_VERSION,
      pointScore: null,
      caveat:
        'No calibrated exemplars yet (ENG-1567). Band is the rubric prior only; ' +
        'no point score is emitted because an uncalibrated number invites comparison ' +
        'against the 85 gate it has not earned.',
    };
  }
  const below = usable.filter((e) => e.rubricTotal < rubric.total).length;
  const percentile = below / usable.length;
  return {
    percentile,
    band: priorBand(rubric.total),
    anchorCount: usable.length,
    calibrated: false,
    calibrationVersion: CALIBRATION_VERSION,
    pointScore: null,
    caveat:
      `Ranked against ${usable.length} exemplar(s), but the calibration mapping ` +
      'is not validated. Treat the band as ordinal, not as a score.',
  };
}

export interface CalibrationMetrics {
  /** Does the corrector recover the mean of the observed distribution? */
  meanRecovery: { predicted: number; observed: number; absError: number; pass: boolean };
  /** Per-item agreement. A corrector can fix the mean and still be wrong per item. */
  perItem: { mae: number; pearson: number; pass: boolean };
  /** Shape. A corrector can match mean AND per-item and still collapse the spread. */
  distribution: { predictedStdev: number; observedStdev: number; ratio: number; pass: boolean };
  /** All three, because passing one proves nothing about the others. */
  pass: boolean;
}

export const MEAN_RECOVERY_MAX_ABS_ERROR = 5;
export const PER_ITEM_MAX_MAE = 8;
export const PER_ITEM_MIN_PEARSON = 0.5;
export const DISTRIBUTION_MIN_RATIO = 0.7;
export const DISTRIBUTION_MAX_RATIO = 1.4;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
export function pearson(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/**
 * Validate a calibration on all three metrics.
 *
 * The brief is explicit that a corrector can nail one metric and fail another,
 * so `pass` is the AND of three independent checks, never any one of them. A
 * corrector that recovers the mean while collapsing the spread would look
 * perfect on metric one and be useless for ranking.
 */
export function validateCalibration(predicted: number[], observed: number[]): CalibrationMetrics {
  const usable = predicted.length === observed.length && predicted.length >= 2;

  const mp = usable ? mean(predicted) : 0;
  const mo = usable ? mean(observed) : 0;
  const absError = Math.abs(mp - mo);
  const meanRecovery = {
    predicted: mp,
    observed: mo,
    absError,
    pass: usable && absError <= MEAN_RECOVERY_MAX_ABS_ERROR,
  };

  const mae = usable
    ? mean(predicted.map((p, i) => Math.abs(p - observed[i])))
    : Number.POSITIVE_INFINITY;
  const r = usable ? pearson(predicted, observed) : 0;
  const perItem = {
    mae,
    pearson: r,
    pass: usable && mae <= PER_ITEM_MAX_MAE && r >= PER_ITEM_MIN_PEARSON,
  };

  const sp = usable ? stdev(predicted) : 0;
  const so = usable ? stdev(observed) : 0;
  const ratio = so === 0 ? 0 : sp / so;
  const distribution = {
    predictedStdev: sp,
    observedStdev: so,
    ratio,
    pass: usable && ratio >= DISTRIBUTION_MIN_RATIO && ratio <= DISTRIBUTION_MAX_RATIO,
  };

  return {
    meanRecovery,
    perItem,
    distribution,
    pass: meanRecovery.pass && perItem.pass && distribution.pass,
  };
}
