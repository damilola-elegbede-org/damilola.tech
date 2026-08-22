import { describe, it, expect } from 'vitest';
import {
  evaluateFitScore,
  evaluateFitGates,
  assembleFitScore,
  resolveTitleTier,
  scoreTitle,
  scoreComp,
  scoreRemote,
  scoreExperienceMatch,
  extractMaxStatedSalary,
  FIT_EXPERIENCE_MAX,
  FIT_TITLE_MAX,
  FIT_COMP_MAX,
  FIT_REMOTE_MAX,
  FIT_SCORE_SURFACE,
  FIT_EXPERIENCE_DIMENSIONS,
  FIT_EXPERIENCE_RAW_MAX,
} from '@/lib/fit-score';
import type { DimensionKey, DimensionResult } from '@/lib/resume-rubric';

/** Build rubric dimension results at a uniform band score. */
function dims(score: number, keys: readonly DimensionKey[] = FIT_EXPERIENCE_DIMENSIONS): DimensionResult[] {
  return keys.map((dimension) => ({
    dimension,
    score,
    band: 'strong' as const,
    resumeQuote: 'evidence',
    jdQuote: 'requirement',
    evidenceRejected: false,
    optionOrder: [],
  }));
}

/** Full marks on every rubric dimension the Fit path reads. */
const PERFECT_EXPERIENCE = dims(4);
const NO_EXPERIENCE = dims(0);

const manager = 'Engineering Manager, Platform';

describe('the 100-point table', () => {
  it('is 40 + 25 + 20 + 15', () => {
    expect(FIT_EXPERIENCE_MAX + FIT_TITLE_MAX + FIT_COMP_MAX + FIT_REMOTE_MAX).toBe(100);
  });

  it('surfaces at one threshold, not two tiers', () => {
    expect(FIT_SCORE_SURFACE).toBe(80);
  });
});

describe('component 1 — experience match (40)', () => {
  it('reads exactly three rubric dimensions, and scope_evidence is not one of them', () => {
    expect([...FIT_EXPERIENCE_DIMENSIONS]).toEqual([
      'requirement_coverage',
      'domain_evidence',
      'leadership_evidence',
    ]);
    expect(FIT_EXPERIENCE_DIMENSIONS).not.toContain('scope_evidence');
    expect(FIT_EXPERIENCE_RAW_MAX).toBe(12);
  });

  it('ignores a scope_evidence result even when one is supplied — D removed org size from fit', () => {
    const withScope = [...PERFECT_EXPERIENCE, ...dims(4, ['scope_evidence'])];
    expect(scoreExperienceMatch(withScope)).toEqual({ pts: 40, raw: 12 });
  });

  it('ignores impact_evidence — resume quality is an ATS Score question', () => {
    const withImpact = [...NO_EXPERIENCE, ...dims(4, ['impact_evidence'])];
    expect(scoreExperienceMatch(withImpact)).toEqual({ pts: 0, raw: 0 });
  });

  it('scales the 0-12 rubric total onto 0-40 and returns an integer', () => {
    expect(scoreExperienceMatch(NO_EXPERIENCE).pts).toBe(0);
    expect(scoreExperienceMatch(dims(3)).pts).toBe(30);
    expect(scoreExperienceMatch(PERFECT_EXPERIENCE).pts).toBe(40);
    // 3 + 2 + 1 = 6 raw -> 20. Integer, because job_pipeline.py rejects a
    // non-integer total as schema drift.
    const mixed: DimensionResult[] = [
      ...dims(3, ['requirement_coverage']),
      ...dims(2, ['domain_evidence']),
      ...dims(1, ['leadership_evidence']),
    ];
    const result = scoreExperienceMatch(mixed);
    expect(result).toEqual({ pts: 20, raw: 6 });
    expect(Number.isInteger(result.pts)).toBe(true);
  });
});

describe('component 2 — title / level (25), graded not binary', () => {
  const cases: Array<[string, number, string]> = [
    ['Engineering Manager', 25, 'exact'],
    ['Senior Engineering Manager', 25, 'exact'],
    ['Director of Engineering', 25, 'exact'],
    ['Engineering Director', 25, 'exact'],
    ['VP of Engineering', 25, 'exact'],
    ['Vice President, Engineering', 25, 'exact'],
    // The comma form of an exact title IS the exact title — scoring
    // "Director, Engineering" below "Director of Engineering" would rebuild the
    // gate/score disagreement ENG-1974 and ENG-1985 fixed.
    ['Director, Engineering', 25, 'exact'],
    ['Manager, Software Engineering', 25, 'exact'],
    ['Head of Engineering', 20, 'equivalent'],
    ['Head of Infrastructure', 20, 'equivalent'],
    ['Group Engineering Manager', 20, 'equivalent'],
    ['Senior Manager, Engineering', 20, 'equivalent'],
    ['Sr. Manager, Developer Platforms', 20, 'equivalent'],
    ['Manager, Cloud Infrastructure', 18, 'domain_qualified'],
    ['Manager, CI/CD Infrastructure', 18, 'domain_qualified'],
    ['Director, Infrastructure', 18, 'domain_qualified'],
    ['VP, Infrastructure Engineering', 18, 'domain_qualified'],
    ['Engineering Lead', 10, 'ambiguous_lead'],
    ['Technical Lead Manager', 10, 'ambiguous_lead'],
    ['Technology Lead', 10, 'ambiguous_lead'],
    ['Senior Software Engineer', 0, 'none'],
    ['Staff Software Engineer', 0, 'none'],
  ];

  it.each(cases)('scores %s at %i (%s)', (title, pts, tier) => {
    const normalized = title.toLowerCase();
    expect(resolveTitleTier(normalized)).toBe(tier);
    expect(scoreTitle(normalized).pts).toBe(pts);
  });

  it("D's worked example: a title miss self-enforces at 75, and grading it 20 reaches 95", () => {
    const jobDescription = 'Remote (US). Lead a team of engineers. $400,000 - $450,000.';
    const graded = evaluateFitScore(
      { title: 'Head of Infrastructure', jobDescription },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    expect(graded.breakdown).toEqual({ experience: 40, title: 20, comp: 20, remote: 15 });
    expect(graded.total).toBe(95);

    // Same role with a title the table does not recognise: 40 + 0 + 20 + 15.
    const unrecognised = evaluateFitScore(
      { title: 'Technology Chief', jobDescription },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    expect(unrecognised.breakdown.title).toBe(0);
    expect(unrecognised.total).toBe(75);
    expect(unrecognised.total).toBeLessThan(FIT_SCORE_SURFACE);
  });
});

describe('component 3 — compensation (20)', () => {
  it('gives undisclosed comp full credit and flags it', () => {
    expect(scoreComp(null)).toEqual({ pts: 20, flag: 'comp_undisclosed' });
  });

  it.each([
    [500_000, 20],
    [350_000, 20],
    [349_999, 16],
    [300_000, 16],
    [299_999, 8],
    [250_000, 8],
    [249_999, 0],
  ])('scores a $%i stated maximum at %i', (max, pts) => {
    expect(scoreComp(max).pts).toBe(pts);
  });

  it('parses NVIDIA-style ISO-suffixed bands', () => {
    expect(extractMaxStatedSalary('base salary range is 272,000 USD - 425,500 USD')).toBe(425_500);
  });

  it('does not read a non-USD band as dollars', () => {
    // 350,000 CAD is roughly $255K. Scoring it at the top USD tier overstates
    // comp in D's most decision-heavy field.
    expect(extractMaxStatedSalary('salary range 300,000 CAD - 350,000 CAD')).toBeNull();
    expect(extractMaxStatedSalary('£180,000 - £220,000 GBP')).toBeNull();
  });

  it('falls back to the job description when compRange parses to nothing', () => {
    const jobDescription = 'Remote (US). Lead a team of engineers. $400,000 - $450,000.';
    const withJunkRange = evaluateFitGates(
      { title: manager, jobDescription, compRange: 'Competitive' },
      'Acme Corp'
    );
    expect(withJunkRange.maxStatedSalary).toBe(450_000);
  });

  it('still prefers a structured compRange when it parses', () => {
    const gates = evaluateFitGates(
      {
        title: manager,
        jobDescription: 'Remote (US). Lead a team of engineers. $400,000 - $450,000.',
        compRange: '$260,000 - $280,000',
      },
      'Acme Corp'
    );
    expect(gates.maxStatedSalary).toBe(280_000);
  });

  it('flags comp_undisclosed on the assembled result, not just the component', () => {
    const result = evaluateFitScore(
      { title: manager, jobDescription: 'Remote (US). Lead a team of engineers.' },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    expect(result.flags).toContain('comp_undisclosed');
    expect(result.breakdown.comp).toBe(20);
  });
});

describe('component 4 — remote friendliness (15)', () => {
  it('scores Colorado 15 regardless of an office-first posture', () => {
    expect(scoreRemote('office-first', 'Onsite in Boulder, CO.', '', undefined).pts).toBe(15);
    expect(scoreRemote('unknown', '', '', 'Denver, CO').pts).toBe(15);
  });

  it('scores Remote-US 15', () => {
    expect(scoreRemote('unknown', 'Fully remote (US).', '', undefined).pts).toBe(15);
  });

  it('scores a remote-ok company with an onsite req 12 and flags it negotiable', () => {
    expect(scoreRemote('remote-ok', 'Onsite in Santa Clara.', '', undefined)).toEqual({
      pts: 12,
      flag: 'remote_negotiable',
    });
  });

  it('scores hub-flex 8 and office-first 3', () => {
    expect(scoreRemote('hub-flex', 'Onsite in Austin.', '', undefined).pts).toBe(8);
    expect(scoreRemote('office-first', 'Onsite in Austin.', '', undefined).pts).toBe(3);
  });

  it("scores a JD that says it is remote at 15, with no country named — D's ruling", () => {
    // Measured on his own ideal-role fixture: "Remote friendly." carries no US
    // token, so posture-only scoring gave it 3/15 and put a hand-built perfect
    // role at 84 — dropping to 74 the moment the model returned band 3.
    expect(scoreRemote('unknown', 'Remote friendly.', '', undefined, 'unknown').pts).toBe(15);
    expect(scoreRemote('office-first', 'This role is remote.', '', undefined, 'us').pts).toBe(15);
  });

  it('does not treat a hybrid or on-site posting as remote', () => {
    expect(scoreRemote('unknown', 'Hybrid, 3 days in office. Remote-eligible.', '', undefined).pts).toBe(3);
    expect(scoreRemote('unknown', 'Onsite in Austin, remote considered later.', '', undefined).pts).toBe(3);
  });

  it('does not award a JD-stated remote signal to a non-US role', () => {
    expect(scoreRemote('unknown', 'Fully remote across Europe.', 'warsaw', undefined, 'non_us').pts).toBe(3);
  });

  it('scores unknown 3 and flags it — never a silent middle value', () => {
    expect(scoreRemote('unknown', 'Onsite in Austin.', '', undefined)).toEqual({
      pts: 3,
      flag: 'posture_unknown',
    });
  });

  it('resolves posture from the company name end-to-end', () => {
    const jobDescription = 'Onsite in Santa Clara. Lead a team of engineers. $400,000.';
    expect(
      evaluateFitScore({ title: manager, jobDescription }, 'NVIDIA', PERFECT_EXPERIENCE)
    ).toEqual(expect.objectContaining({ remotePosture: 'remote-ok', breakdown: expect.objectContaining({ remote: 12 }) }));
    expect(
      evaluateFitScore({ title: manager, jobDescription }, 'Netflix', PERFECT_EXPERIENCE)
    ).toEqual(expect.objectContaining({ remotePosture: 'office-first', breakdown: expect.objectContaining({ remote: 3 }) }));
  });
});

describe('gates', () => {
  it('gates a role to 0 with an empty breakdown, not a low score', () => {
    const result = evaluateFitScore(
      { title: 'Administrative Assistant, Ads Platform Engineering', jobDescription: 'Remote (US). Lead a team of engineers.' },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    expect(result.total).toBe(0);
    expect(result.gateFailed).toContain('G3_function_exclusion');
    expect(result.breakdown).toEqual({ experience: 0, title: 0, comp: 0, remote: 0 });
    expect(result.experienceRaw).toBeNull();
  });

  it('G1 rejects a title with no management signal and no body fallback', () => {
    const result = evaluateFitGates({ title: 'Warehouse Associate', jobDescription: 'Stack pallets.' }, 'Acme');
    expect(result.failed).toContain('G1_no_mgmt_signal');
  });

  it('G1 admits a comma-qualified management title (ENG-1564 / ENG-1974 / ENG-1985)', () => {
    for (const title of ['Manager, Software Engineering', 'VP, Infrastructure Engineering', 'Manager, CI/CD Infrastructure']) {
      expect(evaluateFitGates({ title, jobDescription: '' }, 'Acme').failed).not.toContain('G1_no_mgmt_signal');
    }
  });

  it('G1 still rejects a comma-qualified NON-engineering title', () => {
    expect(
      evaluateFitGates({ title: 'Director, Corporate Accounting', jobDescription: 'Own the ledger.' }, 'Acme').failed
    ).toContain('G1_no_mgmt_signal');
    expect(
      evaluateFitGates({ title: 'Senior Manager, Revenue Operations', jobDescription: 'Own the funnel.' }, 'Acme').failed
    ).toContain('G1_no_mgmt_signal');
  });

  it('G2 never IC-rejects a management title, and still rejects a Principal IC with a management-ish body', () => {
    expect(
      evaluateFitGates({ title: 'Engineering Manager, Distributed Systems', jobDescription: 'Lead a team of engineers.' }, 'Acme').failed
    ).not.toContain('G2_ic_exclusion');
    expect(
      evaluateFitGates({ title: 'Principal Software Engineer', jobDescription: 'Lead a team of engineers.' }, 'Acme').failed
    ).toContain('G2_ic_exclusion');
  });

  it('G3 gates a program manager with no engineering-management token', () => {
    expect(
      evaluateFitGates({ title: 'Technical Program Manager', jobDescription: 'Run the program.' }, 'Acme').failed
    ).toContain('G3_function_exclusion');
  });

  it('G4 gates a non-US posting even when the body says "Join us"', () => {
    expect(
      evaluateFitGates(
        { title: 'Distributed Systems Engineer 4 - Data Platform Poland', jobDescription: 'Join us in Warsaw.' },
        'Netflix'
      ).failed
    ).toContain('G4_geography');
  });

  it('G6 gates a stated band below the $230K floor, and passes at exactly $230K', () => {
    expect(
      evaluateFitGates({ title: manager, jobDescription: 'Remote (US). $150,000 - $180,000.' }, 'Acme').failed
    ).toContain('G6_comp_floor');
    expect(
      evaluateFitGates({ title: manager, jobDescription: 'Remote (US). $200,000 - $230,000.' }, 'Acme').failed
    ).not.toContain('G6_comp_floor');
  });

  it('G5 (location) is gone — a Santa Clara hybrid role is now scored, not rejected', () => {
    const gates = evaluateFitGates(
      { title: manager, jobDescription: 'Hybrid in Santa Clara, CA, United States. Remote-eligible. Lead a team of engineers.' },
      'Acme Corp'
    );
    expect(gates.failed).toEqual([]);
    const result = assembleFitScore(
      { title: manager, jobDescription: 'Hybrid in Santa Clara, CA, United States. Remote-eligible. Lead a team of engineers.' },
      gates,
      PERFECT_EXPERIENCE
    );
    // Scored down by posture rather than thrown away: 40 + 25 + 20 + 3.
    expect(result.breakdown.remote).toBe(3);
    expect(result.total).toBe(88);
  });

  it('gates run before the experience component so a gated role costs no model calls', () => {
    // The route relies on this split; evaluateFitGates must be a pure function
    // of its inputs and take no rubric dimensions at all.
    expect(evaluateFitGates.length).toBe(2);
  });
});

describe('flags', () => {
  it('reports span_unquantified as information only — org span no longer scores', () => {
    const unquantified = evaluateFitScore(
      { title: manager, jobDescription: 'Remote (US). Lead a team of engineers. $400,000.' },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    const quantified = evaluateFitScore(
      { title: manager, jobDescription: 'Remote (US). Manage 30 engineers. $400,000.' },
      'Acme Corp',
      PERFECT_EXPERIENCE
    );
    expect(unquantified.flags).toContain('span_unquantified');
    expect(quantified.flags).not.toContain('span_unquantified');
    expect(unquantified.total).toBe(quantified.total);
  });
});
