/**
 * D's acceptance test for the Fit Score, as a test rather than a claim.
 *
 * Clara probed production on 2026-08-21 with a job description written to be D's
 * ideal role. The seven-signal table returned **78 with all six gates passing** —
 * two points under the surfacing bar. A hand-built perfect role would not have
 * reached him. This file is that measurement, inverted into a guard.
 *
 * The pastry-chef fixture is the negative control and is not optional: the
 * cheapest way to pass the first test is to loosen the gates, and this is what
 * makes that fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { evaluateFitGates, assembleFitScore, FIT_SCORE_SURFACE } from '@/lib/fit-score';
import type { DimensionResult } from '@/lib/resume-rubric';
import { FIT_EXPERIENCE_DIMENSIONS } from '@/lib/fit-score';
import { IDEAL_JD, IDEAL_TITLE, PASTRY_JD, PASTRY_TITLE } from './fixtures/probe-jds';

/** Rubric results at a uniform band, standing in for the model. */
function dims(score: number): DimensionResult[] {
  return FIT_EXPERIENCE_DIMENSIONS.map((dimension) => ({
    dimension,
    score,
    band: 'strong' as const,
    resumeQuote: 'evidence',
    jdQuote: 'requirement',
    evidenceRejected: false,
    optionOrder: [],
  }));
}

function scoreIdeal(band: number) {
  const input = { title: IDEAL_TITLE, jobDescription: IDEAL_JD };
  return assembleFitScore(input, evaluateFitGates(input, 'ProbeCo'), dims(band));
}

describe('IDEAL fixture — D\'s perfect role must surface', () => {
  it('passes every gate', () => {
    const gates = evaluateFitGates(
      { title: IDEAL_TITLE, jobDescription: IDEAL_JD },
      'ProbeCo'
    );
    expect(gates.failed).toEqual([]);
  });

  it('clears the surface threshold at full experience marks', () => {
    const result = scoreIdeal(4);
    expect(result.total).toBeGreaterThanOrEqual(FIT_SCORE_SURFACE);
  });

  it('still clears the threshold when the model returns band 3, not band 4', () => {
    // The measurement that drove D's remote ruling. Under posture-only remote
    // scoring this fixture scored 84 at band 4 and 74 at band 3 — the
    // acceptance test passed only when the model was perfect, which is not a
    // property to depend on.
    const result = scoreIdeal(3);
    expect(result.total).toBeGreaterThanOrEqual(FIT_SCORE_SURFACE);
  });

  it('scores the components the way D ratified them', () => {
    const result = scoreIdeal(4);
    expect(result.breakdown).toEqual({
      experience: 40,
      title: 25,
      // $250,000 - $320,000 sits in the $300-349K band, not the top one.
      // This fixture's ceiling is 96, not 100, and that is the table working.
      comp: 16,
      // "Remote friendly." names no country. D's ruling: the posting's own
      // statement is evidence; posture decides a posting that says nothing.
      remote: 15,
    });
    expect(result.titleTier).toBe('exact');
    expect(result.total).toBe(96);
  });
});

describe('PASTRY fixture — the negative control', () => {
  it('gate-fails G1 and scores zero', () => {
    const input = { title: PASTRY_TITLE, jobDescription: PASTRY_JD };
    const result = assembleFitScore(input, evaluateFitGates(input, 'ProbeCo'), dims(4));
    expect(result.gateFailed).toContain('G1_no_mgmt_signal');
    expect(result.total).toBe(0);
  });

  it('stays at zero even with a perfect experience match — a gate is not a weight', () => {
    const input = { title: PASTRY_TITLE, jobDescription: PASTRY_JD };
    const result = assembleFitScore(input, evaluateFitGates(input, 'ProbeCo'), dims(4));
    expect(result.breakdown).toEqual({ experience: 0, title: 0, comp: 0, remote: 0 });
  });

  it('is separated from the ideal role by the full width of the scale', () => {
    const pastryInput = { title: PASTRY_TITLE, jobDescription: PASTRY_JD };
    const pastry = assembleFitScore(
      pastryInput,
      evaluateFitGates(pastryInput, 'ProbeCo'),
      dims(4)
    );
    // The old resume-match field put these 16 points apart (66 vs 50) on a
    // 100-point scale with a floor of ~50. Fit separates them by 96.
    expect(scoreIdeal(4).total - pastry.total).toBe(96);
  });
});
