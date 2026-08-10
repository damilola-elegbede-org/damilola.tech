/**
 * Job Knockout Gate — Unit Tests
 *
 * Rules per Clara Nova's DD ruling (Linear ENG-1564, 2026-08-10, Slack #clara-dara):
 *  - Hard knockouts: IC-only titles, fully on-site with zero remote/hybrid path,
 *    clearance-required roles, and out-of-scope (below EM) management level.
 *  - Soft penalty (not a knockout): base comp below $230K.
 *  - In-lane titles: Director of Eng, Head of Eng/Platform, Sr EM, Group EM,
 *    manager-of-managers Sr Manager. Stretch: VP Eng. Hard-out: any IC title
 *    (Staff/Principal/Distinguished).
 *
 * Applied BEFORE scoring — this is the one place keyword matching is
 * evidence-backed to earn its keep (ConFit v2 hybrid design, ACL 2025).
 */

import { describe, it, expect } from 'vitest';
import { evaluateJobKnockout } from '../job-knockout';

describe('evaluateJobKnockout', () => {
  describe('IC-only title knockout', () => {
    it('knocks out a Staff Engineer title with no management language', () => {
      const result = evaluateJobKnockout({
        title: 'Staff Software Engineer',
        jobDescription: 'We are looking for a Staff Software Engineer to join our platform team.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('ic_only_title');
    });

    it('knocks out a Principal Engineer title', () => {
      const result = evaluateJobKnockout({
        title: 'Principal Engineer, Infrastructure',
        jobDescription: 'Own the technical direction for our infra platform as an individual contributor.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('ic_only_title');
    });

    it('knocks out a Distinguished Engineer title', () => {
      const result = evaluateJobKnockout({
        title: 'Distinguished Engineer',
        jobDescription: 'A senior technical leadership role, individual contributor track.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('ic_only_title');
    });

    it('does not knock out a straight Engineering Manager title (scope floor)', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Lead a team of 8 engineers building our checkout platform.',
      });
      expect(result.hardReasons).not.toContain('ic_only_title');
    });

    it('does not knock out Director of Engineering', () => {
      const result = evaluateJobKnockout({
        title: 'Director of Engineering',
        jobDescription: 'Own engineering strategy across three teams.',
      });
      expect(result.knockedOut).toBe(false);
    });

    it('does not knock out Senior Engineering Manager', () => {
      const result = evaluateJobKnockout({
        title: 'Senior Engineering Manager, Platform',
        jobDescription: 'Manage 2-3 engineering managers and their teams.',
      });
      expect(result.knockedOut).toBe(false);
    });

    it('does not knock out Head of Platform Engineering', () => {
      const result = evaluateJobKnockout({
        title: 'Head of Platform Engineering',
        jobDescription: 'Lead the platform engineering org.',
      });
      expect(result.knockedOut).toBe(false);
    });

    it('flags VP Engineering as stretch, not a hard knockout', () => {
      const result = evaluateJobKnockout({
        title: 'VP, Engineering',
        jobDescription: 'Own the entire engineering org.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.stretchFlags).toContain('vp_stretch');
    });

    it('knocks out IC title variants with a role word between the level and Engineer', () => {
      expect(
        evaluateJobKnockout({ title: 'Staff Platform Engineer', jobDescription: '' }).hardReasons
      ).toContain('ic_only_title');
      expect(
        evaluateJobKnockout({ title: 'Principal Data Engineer', jobDescription: '' }).hardReasons
      ).toContain('ic_only_title');
      expect(
        evaluateJobKnockout({ title: 'Distinguished Systems Engineer', jobDescription: '' }).hardReasons
      ).toContain('ic_only_title');
    });

    it('knocks out IC-level titles beyond the Engineer track', () => {
      expect(
        evaluateJobKnockout({ title: 'Staff Software Architect', jobDescription: '' }).hardReasons
      ).toContain('ic_only_title');
      expect(
        evaluateJobKnockout({ title: 'Principal Product Manager', jobDescription: '' }).hardReasons
      ).toContain('ic_only_title');
    });

    it('does not hard-knock an unclear/ambiguous title on title alone', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Lead',
        jobDescription: 'Lead a small team, hands-on and people management mixed.',
      });
      expect(result.hardReasons).not.toContain('ic_only_title');
    });
  });

  describe('fully on-site / no remote-hybrid knockout', () => {
    it('knocks out a role requiring 100% on-site with no remote language', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription:
          'This is a 100% on-site position. Candidates must work from our office five days a week. No remote work is available for this role.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('onsite_only_no_remote_path');
    });

    it('does not knock out a hybrid role even without Denver location', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription:
          'This role is based in our Seattle office with a hybrid schedule — 25% in-office, the rest remote-flexible.',
      });
      expect(result.hardReasons).not.toContain('onsite_only_no_remote_path');
    });

    it('does not knock out a fully remote role', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'This is a fully remote position, open to candidates anywhere in the US.',
      });
      expect(result.knockedOut).toBe(false);
    });

    it('does not knock out a role with no location language at all', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Lead the payments engineering team and drive technical strategy.',
      });
      expect(result.hardReasons).not.toContain('onsite_only_no_remote_path');
    });

    it('does not knock out a role with ordinary partial remote-work wording', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Fully on-site, with up to two days of remote work per week.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.hardReasons).not.toContain('onsite_only_no_remote_path');
    });

    it('knocks out an on-site-only role even when hybrid is mentioned for a different team', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription:
          'This role is 100% on-site, five days a week in our downtown office. Note: our design org offers hybrid schedules, but engineering does not.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('onsite_only_no_remote_path');
    });
  });

  describe('clearance-required knockout', () => {
    it('knocks out a role requiring an active security clearance', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Candidates must hold an active TS/SCI security clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('knocks out a role requiring ability to obtain a clearance', () => {
      const result = evaluateJobKnockout({
        title: 'Director of Engineering',
        jobDescription: 'Must be able to obtain and maintain a U.S. government security clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('knocks out a role requiring a generic Secret clearance (not just Top Secret)', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Candidates must hold a Secret clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('does not knock out a role with no clearance language', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Lead a distributed team building consumer-facing products.',
      });
      expect(result.hardReasons).not.toContain('clearance_required');
    });

    it('does not knock out a role that explicitly states no clearance is required', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'No security clearance is required for this commercial role.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.hardReasons).not.toContain('clearance_required');
    });

    it('does not knock out when clearance is explicitly stated as not required', () => {
      const result = evaluateJobKnockout({
        title: 'Director of Engineering',
        jobDescription: 'Security clearance is not required for this position.',
      });
      expect(result.hardReasons).not.toContain('clearance_required');
    });

    it('does not let an unrelated negation suppress a separately stated affirmative requirement', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription:
          'No clearance is required to apply. Hires must obtain and maintain a security clearance within 90 days of starting.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('scopes negation to its own clause across a semicolon, not the whole sentence', () => {
      // Two distinct clauses in ONE sentence: the first negates active
      // clearance, the second affirmatively requires security clearance.
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription:
          'No active clearance is required; candidates must obtain and maintain a security clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('detects an affirmative requirement even when an earlier negation shares the same clause', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'No clearance is needed to apply, but the hire must obtain a security clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toContain('clearance_required');
    });

    it('negates a non-"clearance"-worded requirement like TS/SCI correctly', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'No TS/SCI required for this role.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.hardReasons).not.toContain('clearance_required');
    });
  });

  describe('soft penalty: base comp below $230K', () => {
    it('flags a soft penalty when the top of the stated range is below $230K', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Base salary range: $180,000 - $210,000 depending on experience.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.softPenalties).toContain('comp_below_floor');
    });

    it('does not flag a soft penalty when the range clears $230K', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Base salary range: $220,000 - $260,000 depending on experience.',
      });
      expect(result.softPenalties).not.toContain('comp_below_floor');
    });

    it('does not flag a penalty when no compensation is stated', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Lead the platform team. Compensation discussed during the interview process.',
      });
      expect(result.softPenalties).not.toContain('comp_below_floor');
    });

    it('handles a single-figure salary below the floor', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'This role pays $195,000 base.',
      });
      expect(result.softPenalties).toContain('comp_below_floor');
    });

    it('handles k-notation salary figures', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Salary: $180k - $210k',
      });
      expect(result.softPenalties).toContain('comp_below_floor');
    });

    it('parses a range where only the first endpoint carries a dollar sign', () => {
      const clearsFloor = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Base salary: $220k–260k',
      });
      expect(clearsFloor.softPenalties).not.toContain('comp_below_floor');

      const belowFloor = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Base salary: $180k–210k',
      });
      expect(belowFloor.softPenalties).toContain('comp_below_floor');
    });

    it('parses a range where only the first endpoint carries a dollar sign, full digits', () => {
      const result = evaluateJobKnockout({
        title: 'Engineering Manager',
        jobDescription: 'Base salary: $220,000-260,000',
      });
      expect(result.softPenalties).not.toContain('comp_below_floor');
    });
  });

  describe('combined / real-world shaped postings', () => {
    it('passes a clean in-lane hybrid EM posting with no penalties', () => {
      const result = evaluateJobKnockout({
        title: 'Senior Engineering Manager',
        jobDescription:
          'Lead a team of engineering managers building our platform. Hybrid schedule, 3 days/week in our SF office. Base salary $250,000 - $290,000.',
      });
      expect(result.knockedOut).toBe(false);
      expect(result.hardReasons).toHaveLength(0);
      expect(result.softPenalties).toHaveLength(0);
    });

    it('accumulates multiple hard reasons when more than one rule fires', () => {
      const result = evaluateJobKnockout({
        title: 'Staff Software Engineer',
        jobDescription:
          'Fully on-site, no remote work available. Must hold an active security clearance.',
      });
      expect(result.knockedOut).toBe(true);
      expect(result.hardReasons).toEqual(
        expect.arrayContaining(['ic_only_title', 'onsite_only_no_remote_path', 'clearance_required'])
      );
    });

    it('is case-insensitive across all rules', () => {
      const result = evaluateJobKnockout({
        title: 'STAFF SOFTWARE ENGINEER',
        jobDescription: 'MUST HOLD AN ACTIVE SECURITY CLEARANCE.',
      });
      expect(result.knockedOut).toBe(true);
    });

    it('handles empty job description text without throwing', () => {
      const result = evaluateJobKnockout({ title: 'Engineering Manager', jobDescription: '' });
      expect(result.knockedOut).toBe(false);
      expect(result.hardReasons).toEqual([]);
    });

    it('handles a missing title without throwing', () => {
      const result = evaluateJobKnockout({
        title: '',
        jobDescription: 'Lead the platform engineering team.',
      });
      expect(result.knockedOut).toBe(false);
    });
  });
});
