import { describe, it, expect } from 'vitest';
import {
  anchor, validateCalibration, pearson, CALIBRATION_VERSION,
  MEAN_RECOVERY_MAX_ABS_ERROR, type ExemplarPair,
} from '../resume-anchoring';
import { assembleRubric, RUBRIC_DIMENSIONS, type DimensionResult, type Band } from '../resume-rubric';

const rubric = (scores: number[]) =>
  assembleRubric(RUBRIC_DIMENSIONS.map((d, i) => ({
    dimension: d.key, score: scores[i], band: 'partial' as Band,
    resumeQuote: 'evidence', jdQuote: null, evidenceRejected: false, optionOrder: [],
  } as DimensionResult)));

describe('no point score while uncalibrated (ENG-1566 AC4)', () => {
  it('refuses a point score with no exemplars, and says why', () => {
    const r = anchor(rubric([3, 3, 3, 3, 3]), []);
    expect(r.pointScore).toBeNull();
    expect(r.calibrated).toBe(false);
    expect(r.anchorCount).toBe(0);
    expect(r.percentile).toBeNull();
    expect(r.caveat).toMatch(/ENG-1567/);
  });

  it('still refuses a point score once exemplars exist but calibration is unvalidated', () => {
    // Having anchors is not the same as having a validated mapping. This is the
    // step where false precision would sneak back in.
    const ex: ExemplarPair[] = [
      { id: 'a', rubricTotal: 8, outcome: 'no_callback' },
      { id: 'b', rubricTotal: 14, outcome: 'callback' },
    ];
    const r = anchor(rubric([3, 3, 3, 3, 3]), ex);
    expect(r.anchorCount).toBe(2);
    expect(r.percentile).toBeGreaterThan(0);
    expect(r.pointScore).toBeNull();
    expect(r.calibrated).toBe(false);
  });

  it('carries an uncalibrated version marker', () => {
    expect(CALIBRATION_VERSION).toMatch(/uncalibrated/);
  });

  it('ranks ordinally against exemplars rather than scoring absolutely', () => {
    const ex: ExemplarPair[] = [4, 8, 12, 16].map((t, i) => ({
      id: String(i), rubricTotal: t, outcome: 'no_callback' as const,
    }));
    expect(anchor(rubric([1, 1, 0, 0, 0]), ex).percentile).toBe(0);
    expect(anchor(rubric([4, 4, 4, 4, 4]), ex).percentile).toBe(1);
  });

  it('degrades to a prior band without inventing a percentile', () => {
    const r = anchor(rubric([0, 0, 0, 0, 0]), []);
    expect(r.band).toBe('unlikely');
    expect(r.percentile).toBeNull();
  });
});

describe('calibration must pass all three metrics (AC3)', () => {
  const observed = [40, 52, 61, 68, 74, 81, 88, 93];

  it('passes when the corrector agrees on mean, per item, and shape', () => {
    const predicted = observed.map((o) => o + 2);
    const m = validateCalibration(predicted, observed);
    expect(m.meanRecovery.pass).toBe(true);
    expect(m.perItem.pass).toBe(true);
    expect(m.distribution.pass).toBe(true);
    expect(m.pass).toBe(true);
  });

  it('fails a corrector that recovers the mean but collapses the spread', () => {
    // The exact trap the brief names: metric one is perfect, the result is
    // useless for ranking because every candidate looks the same.
    const mu = observed.reduce((a, b) => a + b, 0) / observed.length;
    const predicted = observed.map(() => mu);
    const m = validateCalibration(predicted, observed);
    expect(m.meanRecovery.pass).toBe(true);
    expect(m.distribution.pass).toBe(false);
    expect(m.pass).toBe(false);
  });

  it('fails a corrector with the right shape but the wrong offset', () => {
    const predicted = observed.map((o) => o + 30);
    const m = validateCalibration(predicted, observed);
    expect(m.distribution.pass).toBe(true);
    expect(m.meanRecovery.pass).toBe(false);
    expect(m.pass).toBe(false);
  });

  it('fails a corrector that matches the distribution but not the individuals', () => {
    const predicted = [...observed].reverse();
    const m = validateCalibration(predicted, observed);
    expect(m.meanRecovery.pass).toBe(true);
    expect(m.distribution.pass).toBe(true);
    expect(m.perItem.pass).toBe(false);
    expect(m.pass).toBe(false);
  });

  it('refuses to pass on too little data', () => {
    expect(validateCalibration([50], [50]).pass).toBe(false);
    expect(validateCalibration([], []).pass).toBe(false);
  });

  it('refuses mismatched lengths rather than truncating', () => {
    expect(validateCalibration([1, 2, 3], [1, 2]).pass).toBe(false);
  });

  it('computes pearson correctly at the extremes', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 6);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('states its own mean tolerance rather than hiding it', () => {
    expect(MEAN_RECOVERY_MAX_ABS_ERROR).toBeGreaterThan(0);
  });
});
