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
  it('§4.1 Anthropic "Engineering Manager, Enterprise" scores 83', () => {
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

    expect(result.gateFailed).toEqual([]);
    expect(result.breakdown).toEqual({
      level: 21,
      scope: 9,
      strategy: 9,
      impact: 10,
      comp: 12,
      company: 10,
      location: 4,
      domain: 8,
    });
    expect(result.score).toBe(83);
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

  it('§4.4 Airbnb "Engineering Manager, UI Tooling" scores 81', () => {
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
      scope: 9,
      strategy: 9,
      impact: 7,
      comp: 9,
      company: 10,
      location: 8,
      domain: 8,
    });
    expect(result.score).toBe(81);
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
});

describe('evaluateRoleFit — comp scoring', () => {
  it('an absent comp band scores neutral (8), not a knockout', () => {
    const result = evaluateRoleFit(
      { title: 'Engineering Manager', jobDescription: 'Lead a team of engineers. No comp stated.' },
      'Acme Corp'
    );
    expect(result.gateFailed).toEqual([]);
    expect(result.breakdown.comp).toBe(8);
  });

  it('a stated band below the $230K floor scores 2', () => {
    const result = evaluateRoleFit(
      { title: 'Engineering Manager', jobDescription: 'Lead a team of engineers. Salary: $180,000 - $210,000.' },
      'Acme Corp'
    );
    expect(result.breakdown.comp).toBe(2);
  });
});
