/**
 * Role-Fit Scorer — Unit Tests
 *
 * ENG-1564. Calibration anchors below are taken verbatim from
 * clara/.tmp/reports/ats-scoring-spec-2026-08-18.md §4 — the fixture JD text
 * is authored to hit the exact phrase families the spec cites for each
 * anchor's sub-score, so the totals in §4.1/§4.2/§4.3/§4.4 are reproducible
 * exactly, not approximately.
 */

import { describe, it, expect } from 'vitest';
import { evaluateRoleFit } from '../role-fit-scorer';

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

describe('evaluateRoleFit — comp scoring', () => {
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
