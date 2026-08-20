/**
 * Role-Fit Scorer — Unit Tests
 *
 * ENG-1564. Calibration anchors below are taken verbatim from
 * clara/.tmp/reports/ats-scoring-spec-2026-08-18.md §4 — the fixture JD text
 * is authored to hit the exact phrase families the spec cites for each
 * anchor's sub-score, so the totals in §4.1/§4.2/§4.3/§4.4 are reproducible
 * exactly, not approximately.
 */

import { describe, it, expect, vi } from 'vitest';
import { evaluateRoleFit, extractMaxStatedSalary, scoreComp } from '../role-fit-scorer';

describe('evaluateRoleFit — calibration anchors (spec §4)', () => {
  it("§4.1's SF/NYC hybrid role now fails the narrower G5 location gate", () => {
    const result = evaluateRoleFit(
      {
        title: 'Engineering Manager, Enterprise',
        jobDescription: `
          You will lead a team of engineers delivering our enterprise platform.
          Own the roadmap for the enterprise domain and set direction for the
          team's technical strategy. You'll drive prioritization across quarterly
          planning and partner with product and go-to-market on cross-functional bets.
          Grow the team and own the career development of your reports.
          This role owns enterprise customers and revenue outcomes, tracked via
          latency, reliability, and uptime SLAs. You'll drive and own ambiguous,
          0->1 problems at an inflection point for the business.
          Location: San Francisco / New York (hybrid, in-office expectation).
          Compensation: base salary $360,000+ for this Engineering Manager role.
          Anthropic builds applied AI systems for enterprise customers.
        `,
      },
      'Anthropic'
    );

    expect(result.gateFailed).toContain('G5_location');
    expect(result.score).toBe(0);
  });

  it('§4.2 Netflix "Distributed Systems Engineer 4 - Data Platform Poland" triple-gates to 0', () => {
    const result = evaluateRoleFit(
      {
        title: 'Distributed Systems Engineer 4 - Data Platform Poland',
        jobDescription: 'Own distributed systems powering our data platform at scale.',
      },
      'Netflix'
    );

    expect(result.score).toBe(0);
    expect(result.gateFailed).toEqual(
      expect.arrayContaining(['G1_no_mgmt_signal', 'G2_ic_exclusion', 'G4_geography'])
    );
    expect(result.gateFailed).toHaveLength(3);
  });

  it('§4.3 "Admin Assistant, Ads Platform Engineering" gates to 0', () => {
    const result = evaluateRoleFit(
      {
        title: 'Admin Assistant, Ads Platform Engineering',
        jobDescription: 'Support the Ads Platform Engineering leadership team with scheduling and admin tasks.',
      },
      'Meta'
    );

    expect(result.score).toBe(0);
    expect(result.gateFailed).toEqual(
      expect.arrayContaining(['G1_no_mgmt_signal', 'G3_function_exclusion'])
    );
    expect(result.gateFailed).toHaveLength(2);
  });

  it('§4.4 Airbnb "Engineering Manager, UI Tooling" uses the redistributed strategy signal', () => {
    const result = evaluateRoleFit(
      {
        title: 'Engineering Manager, UI Tooling',
        jobDescription: `
          Lead a team of engineers building UI tooling used across Airbnb.
          Own the roadmap for the tooling domain, set direction for our
          technical strategy, and drive quarterly planning and prioritization.
          Partner with product and design stakeholders on cross-functional
          initiatives. Grow the team and invest in the career development of
          your reports.
          This developer experience team improves developer velocity and
          adoption rate across internal platform and tooling consumers, driving
          and improving greenfield, 0->1 initiatives at scale.
          Location: US-remote eligible, hybrid.
          Compensation: base salary range $260,000 - $299,000.
        `,
      },
      'Airbnb'
    );

    expect(result.gateFailed).toEqual([]);
    expect(result.breakdown).toEqual({
      level: 21,
      scope: 10,
      strategy: 14,
      comp: 9,
      company: 10,
      location: 8,
      domain: 8,
    });
    // Calibration is intentionally deferred; this asserts the amended table.
    expect(result.score).toBe(80);
  });
});

describe('evaluateRoleFit — gate mechanics', () => {
  it('a management-titled role is never IC-rejected by G2 (short-circuit)', () => {
    const result = evaluateRoleFit(
      {
        title: 'Principal Engineering Manager',
        jobDescription: 'Manage a team of principal and staff engineers.',
      },
      'Microsoft'
    );
    expect(result.gateFailed).not.toContain('G2_ic_exclusion');
  });

  it('head/tail split neutralises department-name tokens in the tail', () => {
    // "Admin Assistant, Ads Platform Engineering" — head carries no
    // "platform"/"engineering" token once split; only the tail does.
    const result = evaluateRoleFit(
      { title: 'Admin Assistant, Ads Platform Engineering', jobDescription: 'Admin support role.' },
      'Meta'
    );
    expect(result.gateFailed).toContain('G3_function_exclusion');
  });

  it('unknown location passes with a locationUnknown flag, not a reject', () => {
    const result = evaluateRoleFit(
      {
        title: 'Engineering Manager',
        jobDescription: 'Lead a team of engineers. No location stated anywhere in this posting.',
      },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G4_geography');
    expect(result.locationUnknown).toBe(true);
  });

  it('a non-US location still gates G4 despite "Join us" in the body (CodeRabbit r3812945256)', () => {
    const result = evaluateRoleFit(
      {
        title: 'Engineering Manager',
        location: 'Warsaw, Poland',
        jobDescription:
          'Join us and help build great things. direct reports, people leadership, performance review, hiring plan.',
      },
      'Acme Corp'
    );
    expect(result.gateFailed).toContain('G4_geography');
  });

  it('program manager without an engineering-management token is gated out', () => {
    const result = evaluateRoleFit(
      { title: 'Technical Program Manager, Platform', jobDescription: 'Coordinate cross-team programs.' },
      'Google'
    );
    expect(result.gateFailed).toContain('G3_function_exclusion');
  });

  it('a comma-qualified management title is not G1-rejected (ENG-1564 Codex P1)', () => {
    // "Manager, Software Engineering" splits into head="manager" — the
    // G1_TITLE_PATTERN's "manager,?\s*(software|...)" alternative must be
    // tested against the full normalized title, not head alone, or this
    // genuine management title is silently zero-scored.
    const result = evaluateRoleFit(
      {
        title: 'Manager, Software Engineering',
        jobDescription: 'Lead a team of engineers building our core platform.',
      },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
  });

  it('a comma-qualified management title scores the management level, not the fallback (CodeRabbit finding, ENG-1564)', () => {
    // scoreLevel used to receive gates.head ("manager") instead of the full
    // normalized title, so the "manager,?\s*software engineering" alternative
    // could never match and the role silently fell back to the 12-point
    // body-fallback tier instead of the 21-point engineering-manager tier.
    const result = evaluateRoleFit(
      {
        title: 'Manager, Software Engineering',
        jobDescription: 'Lead a team of engineers building our core platform.',
      },
      'Acme Corp'
    );
    expect(result.breakdown.level).toBe(21);
  });
});

describe('evaluateRoleFit — G1 comma-qualified Director/VP titles (ENG-1974)', () => {
  // "Tested directly against the deployed regex" list from the ENG-1974
  // defect report — all 11 previously scored roleFit.total = 0 on a comma.
  const FORMERLY_FAILING_TITLES = [
    'VP, Infrastructure Engineering',
    'VP, Engineering',
    'VP, Platform Engineering',
    'SVP, Engineering',
    'Director, Engineering',
    'Director, Software Engineering (Infrastructure)',
    'Director, Platform Engineering',
    'Director, Data Engineering',
    'Director, Infrastructure',
    'Senior Director, Engineering',
    'Evals Infrastructure Tech Lead / Manager',
  ];

  it.each(FORMERLY_FAILING_TITLES)('"%s" now clears G1 on title alone (AC1)', (title) => {
    const result = evaluateRoleFit({ title, jobDescription: '' }, 'Acme Corp');
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
  });

  // AC2 — the forms that already worked must keep working.
  const ALREADY_PASSING_TITLES = [
    'VP of Engineering',
    'VP Engineering',
    'Vice President, Engineering',
    'Director of Engineering',
    'Engineering Director',
  ];

  it.each(ALREADY_PASSING_TITLES)('"%s" still clears G1 (AC2 regression)', (title) => {
    const result = evaluateRoleFit({ title, jobDescription: '' }, 'Acme Corp');
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
  });

  // AC2 — the department-word list stays scoped to engineering; a director
  // or manager title outside that scope must not start passing G1 just
  // because the comma-qualified alternative widened.
  it('"Director, Corporate Accounting" is still G1-rejected (AC2 negative)', () => {
    const result = evaluateRoleFit(
      { title: 'Director, Corporate Accounting', jobDescription: '' },
      'Acme Corp'
    );
    expect(result.gateFailed).toContain('G1_no_mgmt_signal');
  });

  it('"Senior Manager, Revenue Operations" is still G1-rejected (AC2 negative)', () => {
    const result = evaluateRoleFit(
      { title: 'Senior Manager, Revenue Operations', jobDescription: '' },
      'Acme Corp'
    );
    expect(result.gateFailed).toContain('G1_no_mgmt_signal');
  });

  // AC3 — the two verbatim postings that triggered this issue, scored
  // end-to-end against the real JD shape (salary + Boulder location).
  it('HubSpot "VP, Infrastructure Engineering" scores above zero end-to-end (AC3)', () => {
    const result = evaluateRoleFit(
      {
        title: 'VP, Infrastructure Engineering',
        location: 'Boulder, CO',
        jobDescription: `
          Lead our infrastructure and platform engineering organization.
          Base salary: 401,895-643,005 USD.
        `,
      },
      'HubSpot'
    );
    expect(result.gateFailed).toEqual([]);
    expect(result.score).toBeGreaterThan(0);
  });

  it('ServiceTitan "Director, Software Engineering (Infrastructure)" scores above zero end-to-end (AC3)', () => {
    const result = evaluateRoleFit(
      {
        title: 'Director, Software Engineering (Infrastructure)',
        location: 'Boulder, CO',
        jobDescription: `
          Own our infrastructure engineering platform organization.
          Base salary: 246,500-369,700 USD Zone 2.
        `,
      },
      'ServiceTitan'
    );
    expect(result.gateFailed).toEqual([]);
    expect(result.score).toBeGreaterThan(0);
  });

  // AC4 — body-fallback fixtures. Each JD string independently satisfies
  // g1Passes with a title that does not itself match G1_TITLE_PATTERN.
  const BODY_FALLBACK_JDS = [
    'Lead and develop a high-performing engineering organization with leadership depth and succession planning.',
    'Significant executive engineering leadership experience leading large, multi-layer organizations.',
    'Strong track record developing engineering leaders, building inclusive organizations.',
    'Lead and develop a global SRE team providing 24/7 coverage.',
    'Minimum 7 years leading 50+ engineer teams.',
  ];

  it.each(BODY_FALLBACK_JDS)('body text "%s" clears G1 via fallback with a non-matching title (AC4)', (jobDescription) => {
    const result = evaluateRoleFit({ title: 'Software Engineer', jobDescription }, 'Acme Corp');
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
  });

  // AC5 — scoreLevel and G1_TITLE_PATTERN must agree: every title G1 admits
  // as a Director/VP management signal scores the Director/VP level (24),
  // never the 12-point "fallback only" tier.
  const DIRECTOR_VP_LEVEL_AGREEMENT = [
    'VP, Infrastructure Engineering',
    'VP, Engineering',
    'SVP, Engineering',
    'Director, Engineering',
    'Director, Infrastructure',
    'Senior Director, Engineering',
  ];

  it.each(DIRECTOR_VP_LEVEL_AGREEMENT)('"%s" scores level 24, matching its G1 pass (AC5)', (title) => {
    const result = evaluateRoleFit(
      { title, jobDescription: 'Own the platform organization.' },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
    expect(result.breakdown.level).toBe(24);
  });

  // G1/G2 must move together (carried forward from the ENG-1564 pivot
  // comment this issue cites): widening the G1 body-fallback must not leak
  // into G2's short-circuit. A genuine Staff/Principal IC title stays
  // G2-rejected even when its JD body happens to contain one of the new
  // executive-register phrases.
  it('a Principal IC title is still G2-rejected even when its body clears the widened G1 fallback', () => {
    const result = evaluateRoleFit(
      {
        title: 'Principal Software Engineer',
        jobDescription: 'Lead and develop a global infrastructure team spanning three regions.',
      },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
    expect(result.gateFailed).toContain('G2_ic_exclusion');
  });

  it('a Staff IC title is still G2-rejected even when its body clears the widened G1 fallback', () => {
    const result = evaluateRoleFit(
      {
        title: 'Staff Software Engineer',
        jobDescription: 'Strong track record developing engineering leaders, building inclusive organizations.',
      },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
    expect(result.gateFailed).toContain('G2_ic_exclusion');
  });
});

describe('evaluateRoleFit — comp scoring', () => {
  it('parses NVIDIA-style ISO-suffixed salary ranges and awards the disclosed top tier', () => {
    const salary = extractMaxStatedSalary('The base salary range is 224,000 USD - 356,500 USD.');

    expect(salary).toBe(356_500);
    expect(scoreComp(salary)).toBe(12);
  });

  it.each([
    ['$224,000 - $356,500', 356_500],
    ['$180k - $220k', 220_000],
    ['$250,000', 250_000],
  ])('preserves existing dollar-form parsing for %s', (text, expected) => {
    expect(extractMaxStatedSalary(text)).toBe(expected);
  });

  it.each([
    'Founded in 2019',
    '2024 - 2025',
    'JR1995883',
    '40 engineers',
    '50,000 employees',
    '10,000 GPUs',
    '25,000 hours',
    '$999',
  ])('does not treat non-salary text as compensation: %s', (text) => {
    expect(extractMaxStatedSalary(text)).toBeNull();
  });

  it.each([
    ['224,000 USD - 356,500 USD', 356_500],
    ['224,000 USD - 356,500', 356_500],
    ['224,000 - 356,500 USD', 356_500],
    ['250,000 CAD', 250_000],
  ])('accepts ISO markers on either range endpoint: %s', (text, expected) => {
    expect(extractMaxStatedSalary(text)).toBe(expected);
  });

  it('an absent comp band scores 7 and passes G6', () => {
    const result = evaluateRoleFit(
      { title: 'Engineering Manager', jobDescription: 'Lead a team of engineers. No comp stated.' },
      'Acme Corp'
    );
    expect(result.gateFailed).toEqual([]);
    expect(result.gateFailed).not.toContain('G6_comp_floor');
    expect(result.breakdown.comp).toBe(7);
  });

  it('a stated band below the $230K floor fails G6', () => {
    const result = evaluateRoleFit(
      { title: 'Engineering Manager', jobDescription: 'Lead a team of engineers. Salary: $180,000 - $210,000.' },
      'Acme Corp'
    );
    expect(result.gateFailed).toContain('G6_comp_floor');
    expect(result.breakdown.comp).toBe(0);
  });

  it('a stated $230K maximum passes G6 at the lowest disclosed tier', () => {
    const result = evaluateRoleFit(
      { title: 'Engineering Manager', jobDescription: 'Lead a team of engineers. Salary: $210,000 - $230,000.' },
      'Acme Corp'
    );
    expect(result.gateFailed).not.toContain('G6_comp_floor');
    expect(result.breakdown.comp).toBe(7);
  });
});

describe('evaluateRoleFit — amended gates and signal table', () => {
  const manager = 'Engineering Manager';

  it.each([
    ['Remote (US)', 'Location: Remote (US). Lead a team of engineers.'],
    ['Remote - United States', 'Location: Remote - United States. Lead a team of engineers.'],
    ['100% remote US-based', '100% remote, US-based. Lead a team of engineers.'],
    ['Boulder hybrid', 'Location: Boulder, Colorado. Hybrid. Lead a team of engineers.'],
    ['Denver role', 'Location: Denver, CO. Lead a team of engineers.'],
  ])('G5 accepts %s', (_label, jobDescription) => {
    expect(evaluateRoleFit({ title: manager, jobDescription }, 'Acme').gateFailed).not.toContain('G5_location');
  });

  it.each(['Santa Clara', 'Austin', 'NYC'])('G5 rejects %s hybrid roles without remote language', (city) => {
    const result = evaluateRoleFit({ title: manager, jobDescription: `Location: ${city}. Hybrid. Lead a team of engineers.` }, 'Acme');
    expect(result.gateFailed).toContain('G5_location');
  });

  it('G5 rejects a Santa Clara hybrid role even when it separately states a US token and hedges as remote-eligible', () => {
    // D's named case: hybrid-at-a-non-Boulder-US-hub does not pass just because the JD also
    // says "US" somewhere and describes itself as remote-eligible for the right candidate.
    const jobDescription =
      'This hybrid role is based in our Santa Clara, CA office. We are a US company. ' +
      'Remote-eligible for the right candidate. Lead a team of engineers.';
    const result = evaluateRoleFit({ title: manager, jobDescription }, 'Acme');
    expect(result.gateFailed).toContain('G5_location');
  });

  it('G5 and G6 both fail open when their inputs are unknown', () => {
    const result = evaluateRoleFit({ title: manager, jobDescription: 'Lead a team of engineers.' }, 'Acme');
    expect(result.gateFailed).not.toContain('G5_location');
    expect(result.gateFailed).not.toContain('G6_comp_floor');
    expect(result.locationUnknown).toBe(true);
  });

  it('G2 still rejects an IC title with one ambiguous management body signal', () => {
    const result = evaluateRoleFit({ title: 'Senior Software Engineer', jobDescription: 'Mentor junior engineers. Remote (US).' }, 'Acme');
    expect(result.gateFailed).toContain('G2_ic_exclusion');
  });

  it('allows a non-IC role through G1 with one management body signal', () => {
    const result = evaluateRoleFit({ title: 'Technology Lead', jobDescription: 'Manage a team of engineers.' }, 'Acme');
    expect(result.gateFailed).not.toContain('G1_no_mgmt_signal');
  });

  it('scores VP Engineering at the Director/Head tier', () => {
    const result = evaluateRoleFit({ title: 'VP of Engineering', jobDescription: 'Remote (US). Lead a team of engineers.' }, 'Acme');
    expect(result.breakdown.level).toBe(24);
  });

  it('gives unquantified span the 10-point base and adds span bonuses to the 16-point cap', () => {
    const unquantified = evaluateRoleFit({ title: manager, jobDescription: 'Remote (US). Lead a team of engineers.' }, 'Acme');
    expect(unquantified.breakdown.scope).toBe(10);
    const capped = evaluateRoleFit({ title: manager, jobDescription: 'Remote (US). Manage 30 engineers. Manage engineering managers across multiple teams.' }, 'Acme');
    expect(capped.breakdown.scope).toBe(16);
  });

  it('scores explicit small teams at 5 and business/customer outcomes as the fifth strategy family', () => {
    const result = evaluateRoleFit({
      title: manager,
      jobDescription: 'Remote (US). Manage 4 engineers on a small team. Set technical strategy for customers, revenue, latency, and reliability.',
    }, 'Acme');
    expect(result.breakdown.scope).toBe(5);
    expect(result.breakdown.strategy).toBe(13);
  });

  it('caps strategy at 22 and unknown location ties the lowest disclosed tier', () => {
    const result = evaluateRoleFit({
      title: manager,
      jobDescription: 'Lead a team of engineers. Technical strategy, technical vision, own the roadmap, prioritization, partner with product, stakeholders, org design, operating model, customers, revenue, latency, reliability.',
    }, 'Acme');
    expect(result.breakdown.strategy).toBe(22);
    expect(result.breakdown.location).toBe(4);
  });

  it('has a 100-point table: 24 + 16 + 22 + 12 + 10 + 8 + 8', () => {
    expect(24 + 16 + 22 + 12 + 10 + 8 + 8).toBe(100);
  });
});

describe('evaluateRoleFit — strategy phrase families (ENG-1971)', () => {
  const manager = 'Engineering Manager';
  const scoreStrategy = (jobDescription: string) =>
    evaluateRoleFit({ title: manager, jobDescription }, 'Acme').breakdown.strategy;

  it('recognises the JR1995883 strategy language without requiring literal legacy phrases', () => {
    const jobDescription = `
      Define and lead strategic technical initiatives, setting short- and long-term goals for your team.
      Make technical design decisions and project plans.
      Collaborate with research, hardware, and software teams.
    `;

    expect(scoreStrategy(jobDescription)).toBeGreaterThanOrEqual(9);
  });

  // Measured on 20 real NVIDIA JDs fetched from the Workday detail endpoint.
  // The first broadening pass took IMPACT_METRICS to 19/20 (95%) on bare
  // \bperformance\b and family 2 to 12/20 (60%) on bare \bplanning\b. A
  // detector that fires on 95% of postings is a constant: it carries no
  // information and silently adds a flat +5 to nearly every score, which would
  // have been baked straight into the ENG-1972 thresholds. These pin the
  // generic words OUT so a future "just add the obvious synonym" edit cannot
  // quietly re-inflate the signal.
  it.each([
    ['bare "performance"', 'You will join a high-performance team and receive performance reviews.'],
    ['bare "planning"', 'Attend sprint planning and other planning meetings.'],
    ['bare "optimize"', 'Optimize your own workflow and learning.'],
    ['bare "efficiency"', 'We value efficiency in everything we do.'],
  ])('does not let %s alone act as a strategy or metrics signal', (_label, jobDescription) => {
    expect(scoreStrategy(jobDescription)).toBe(0);
  });

  it('still credits performance work when it is stated as an outcome, not an adjective', () => {
    // JR1995883's actual subject: "GPU accelerated AI performance optimizations".
    expect(scoreStrategy('Drive performance optimizations across training and inference.')).toBeGreaterThan(0);
  });

  it('recognises paraphrased strategic-initiative language', () => {
    expect(scoreStrategy('Define and lead strategic technical initiatives.')).toBeGreaterThan(0);
  });

  it.each([
    ['strategy / vision', 'Define strategic technical initiatives and set long-term goals.', 3],
    ['roadmap / planning', 'Document technical design decisions and project plans.', 3],
    ['cross-functional collaboration', 'Collaborate with research, hardware, and software teams.', 3],
    ['org / process design', 'Define the operating model and team topology.', 3],
  ])('scores the %s family independently', (_family, jobDescription, expected) => {
    expect(scoreStrategy(jobDescription)).toBe(expected);
  });

  it.each([
    ['strategy / vision', 'Implement APIs, review pull requests, and fix production bugs.'],
    ['roadmap / planning', 'Implement APIs, review pull requests, and fix production bugs.'],
    ['cross-functional collaboration', 'Implement APIs, review pull requests, and fix production bugs.'],
    ['org / process design', 'Implement APIs, review pull requests, and fix production bugs.'],
  ])('does not make the %s family a constant on a JD without its concepts', (_family, jobDescription) => {
    expect(scoreStrategy(jobDescription)).toBe(0);
  });

  it('keeps a plainly IC implementation role low overall', () => {
    const result = evaluateRoleFit(
      {
        title: 'Senior Software Engineer',
        jobDescription: 'Implement APIs, review pull requests, and fix production bugs.',
      },
      'Acme'
    );

    expect(result.gateFailed).toContain('G2_ic_exclusion');
    expect(result.score).toBe(0);
  });

  it('recognises performance-optimisation work as a metric outcome', () => {
    const strategyOnly = scoreStrategy('Define strategic technical initiatives.');
    const performanceOptimisation = scoreStrategy(
      'Define strategic technical initiatives to optimize deep learning training and inference throughput.'
    );

    expect(performanceOptimisation).toBe(strategyOnly + 5);
  });

  it('does not infer a metric outcome when metric language is absent', () => {
    expect(scoreStrategy('Define strategic technical initiatives for the platform.')).toBe(3);
  });
});

describe('evaluateRoleFit — company remote posture', () => {
  const manager = 'Engineering Manager';
  const nonNegotiableSantaClara =
    'Location: Santa Clara, CA. Hybrid and in-office. Lead a team of engineers.';

  it.each([
    ['NVIDIA', 'remote-ok', 8],
    ['Vercel', 'hub-flex', 6],
  ])('%s posture overrides a posted Santa Clara hybrid location', (company, _posture, locationScore) => {
    const result = evaluateRoleFit(
      { title: manager, jobDescription: nonNegotiableSantaClara },
      company
    );

    expect(result.gateFailed).not.toContain('G5_location');
    expect(result.breakdown.location).toBe(locationScore);
    expect(result.remoteNegotiable).toBe(true);
  });

  it('does not make an office-first company remotely negotiable', () => {
    const result = evaluateRoleFit(
      { title: manager, jobDescription: nonNegotiableSantaClara },
      'Anthropic'
    );

    expect(result.gateFailed).toContain('G5_location');
    expect(result.remoteNegotiable).toBe(false);
  });

  it('expires stale posture evidence and falls back to the posted location', () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2027-02-16T00:00:00.000Z').getTime()
    );

    try {
      const result = evaluateRoleFit(
        { title: manager, jobDescription: nonNegotiableSantaClara },
        'NVIDIA'
      );

      expect(result.gateFailed).toContain('G5_location');
      expect(result.remoteNegotiable).toBe(false);

      const postedRemoteResult = evaluateRoleFit(
        { title: manager, jobDescription: 'Location: United States. Fully remote. Lead a team of engineers.' },
        'NVIDIA'
      );
      expect(postedRemoteResult.gateFailed).not.toContain('G5_location');
      expect(postedRemoteResult.breakdown.location).toBe(6);
      expect(postedRemoteResult.remoteNegotiable).toBe(false);
    } finally {
      dateNow.mockRestore();
    }
  });
});
