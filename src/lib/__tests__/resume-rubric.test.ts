import { describe, it, expect } from 'vitest';
import {
  RUBRIC_DIMENSIONS, RUBRIC_VERSION, MAX_TOTAL, MAX_DIMENSION_SCORE,
  permuteBands, citationAppearsIn, ceilingFor, buildDimensionCall,
  scoreDimension, assembleRubric, type DimensionResult, type Band,
} from '../resume-rubric';

const RESUME = `Damilola Elegbede — Senior Engineering Manager.
Led a platform organisation of 42 engineers across four teams, including two engineering managers.
Reduced p99 checkout latency from 1.8s to 340ms, worth $4.1M in recovered conversion.
Hired 19 engineers and promoted 4 into staff roles over two years.`;

const JD = `Director, Platform Engineering. You will lead a multi-layer organisation
of 40+ engineers and own our checkout reliability. Must have experience managing managers.`;

describe('locked rubric (ENG-1565)', () => {
  it('is versioned and fixed in size', () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(RUBRIC_DIMENSIONS).toHaveLength(5);
    expect(MAX_TOTAL).toBe(RUBRIC_DIMENSIONS.length * MAX_DIMENSION_SCORE);
  });

  it('scores each dimension in its own call — criteria-order bias has nothing to order', () => {
    const calls = RUBRIC_DIMENSIONS.map((d) => buildDimensionCall(d, RESUME, JD, 'seed'));
    expect(calls).toHaveLength(5);
    for (const c of calls) {
      const others = RUBRIC_DIMENSIONS.filter((d) => d.key !== c.dimension.key);
      // no other dimension's question may leak into this call's prompt
      for (const o of others) expect(c.prompt).not.toContain(o.question);
    }
  });
});

describe('position-bias mitigation', () => {
  it('permutes the option order per dimension', () => {
    const orders = RUBRIC_DIMENSIONS.map((d) => permuteBands(d.key, 'seed').join(','));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed, so a run is reproducible', () => {
    expect(permuteBands('scope_evidence', 's1')).toEqual(permuteBands('scope_evidence', 's1'));
  });

  it('differs across seeds, so bias cannot align with the scale every run', () => {
    const a = RUBRIC_DIMENSIONS.map((d) => permuteBands(d.key, 'run-a').join(','));
    const b = RUBRIC_DIMENSIONS.map((d) => permuteBands(d.key, 'run-b').join(','));
    expect(a).not.toEqual(b);
  });

  it('always presents every band exactly once', () => {
    const o = permuteBands('impact_evidence', 'x');
    expect([...o].sort()).toEqual(['absent', 'exemplary', 'partial', 'strong', 'weak']);
  });
});

describe('evidence-grounding — an uncited score is not evidence', () => {
  const call = buildDimensionCall(RUBRIC_DIMENSIONS[1], RESUME, JD, 'seed');

  it('accepts a verbatim citation', () => {
    const r = scoreDimension(call, {
      band: 'strong',
      resumeQuote: 'Led a platform organisation of 42 engineers across four teams',
      jdQuote: 'lead a multi-layer organisation',
    }, RESUME, JD);
    expect(r.score).toBe(3);
    expect(r.evidenceRejected).toBe(false);
    expect(r.resumeQuote).not.toBeNull();
  });

  it('clamps a confident score whose citation is not in the resume', () => {
    // The brief's hallucinated-requirements failure (n=35): a plausible quote
    // the resume never contained.
    const r = scoreDimension(call, {
      band: 'exemplary',
      resumeQuote: 'Scaled the organisation to 300 engineers across nine countries',
      jdQuote: null,
    }, RESUME, JD);
    expect(r.score).toBe(0);
    expect(r.band).toBe('absent');
    expect(r.evidenceRejected).toBe(true);
  });

  it('clamps a high band with no citation at all', () => {
    const r = scoreDimension(call, { band: 'strong', resumeQuote: null }, RESUME, JD);
    expect(r.score).toBe(0);
    expect(r.evidenceRejected).toBe(true);
  });

  it('does not flag an honest absent', () => {
    const r = scoreDimension(call, { band: 'absent', resumeQuote: null }, RESUME, JD);
    expect(r.score).toBe(0);
    expect(r.evidenceRejected).toBe(false);
  });

  it('tolerates re-wrapped whitespace but not paraphrase', () => {
    expect(citationAppearsIn('Led a platform   organisation\n  of 42 engineers', RESUME)).toBe(true);
    expect(citationAppearsIn('Led a big platform team of about 42 people', RESUME)).toBe(false);
  });

  it('rejects a citation too short to mean anything', () => {
    expect(citationAppearsIn('engineers', RESUME)).toBe(false);
  });
});

describe('ceiling is arithmetic, not generated', () => {
  const dims = (scores: number[]): DimensionResult[] =>
    RUBRIC_DIMENSIONS.map((d, i) => ({
      dimension: d.key, score: scores[i], band: 'partial' as Band,
      resumeQuote: 'x', jdQuote: null, evidenceRejected: false, optionOrder: [], ceilingScore: 4,
    }));

  it('lifts addressable dimensions to full marks and leaves structural ones alone', () => {
    // requirement_coverage, leadership_evidence, impact_evidence are addressable (3 × 4 = 12)
    // scope_evidence, domain_evidence are structural and stay at 1 + 2 = 3
    expect(ceilingFor(dims([2, 1, 2, 1, 0]))).toBe(15);
  });

  it('never reports a ceiling below the current total', () => {
    for (const s of [[0,0,0,0,0], [4,4,4,4,4], [1,3,2,4,0]]) {
      const d = dims(s);
      const r = assembleRubric(d);
      expect(r.ceiling).toBeGreaterThanOrEqual(r.total);
    }
  });

  it('does not price fabrication into an addressable requirement', () => {
    const d = dims([0, 2, 2, 1, 1]);
    // The requirement is not evidenced anywhere in the corpus. It is
    // addressable only when a truthful corpus citation supports a better band.
    for (const dimension of d) dimension.ceilingScore = dimension.score;
    expect(ceilingFor(d)).toBe(6);
  });

  it('is stable across repeated calls — the defect that motivated this ticket', () => {
    // readiness-scorer's LLM-generated maxPossibleScore returned 58 and 78 for
    // the same posting on the same day.
    const d = dims([2, 1, 2, 1, 0]);
    const runs = Array.from({ length: 20 }, () => ceilingFor(d));
    expect(new Set(runs).size).toBe(1);
  });

  it('cannot exceed the rubric maximum', () => {
    expect(ceilingFor(dims([4, 4, 4, 4, 4]))).toBe(MAX_TOTAL);
  });
});

describe('assembled result carries what ENG-1566 consumes', () => {
  it('emits per-dimension score plus citations, not a bare total', () => {
    const call = buildDimensionCall(RUBRIC_DIMENSIONS[0], RESUME, JD, 'seed');
    const r = assembleRubric([
      scoreDimension(call, {
        band: 'strong',
        resumeQuote: 'Hired 19 engineers and promoted 4 into staff roles',
        jdQuote: 'Must have experience managing managers',
      }, RESUME, JD),
    ]);
    expect(r.rubricVersion).toBe(RUBRIC_VERSION);
    const d = r.dimensions[0];
    expect(d).toHaveProperty('dimension');
    expect(d).toHaveProperty('score');
    expect(d).toHaveProperty('resumeQuote');
    expect(d.optionOrder.length).toBeGreaterThan(0);
  });
});
