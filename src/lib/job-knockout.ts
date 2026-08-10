/**
 * Job Knockout Gate — hard must-have filtering, applied BEFORE scoring.
 *
 * ENG-1564: the current /api/v1/score-job scorer is keyword-density-heavy,
 * optimizing for a signal the major ATS vendors document they do NOT use.
 * Peer-reviewed evidence (ConFit v2, ACL 2025) shows pure embeddings miss
 * 16.7% of cases on hard-requirement knockouts — hence keeping a rule-based
 * gate for exactly the requirements that are genuinely binary (title level,
 * location policy, clearance), and leaving everything gradient (fit quality)
 * to the scoring layer downstream.
 *
 * Rules per Clara Nova's DD ruling (fit-criteria owner; Dara owns
 * implementation) — Linear ENG-1564 comment, 2026-08-10:
 *  - Hard knockout: IC-only title (Staff/Principal/Distinguished, no
 *    management scope) — no exceptions.
 *  - Hard knockout: fully on-site with zero remote/hybrid path. NOT
 *    "not Denver" alone — an SF/Seattle 25%-hybrid req stays in-lane.
 *  - Hard knockout: clearance-required (D holds none, not pursuing one).
 *  - Scope floor: EM / Sr EM / Director Eng. A straight EM req is in-lane.
 *    VP Eng is a stretch, flagged but not knocked out.
 *  - Soft penalty (NOT a knockout): base comp below $230K.
 *
 * This module is intentionally scoped to the knockout gate only. It does
 * not touch src/lib/readiness-scorer.ts (shared with /score-resume,
 * /resume-generator, and the legacy /api/resume-generator route) — those
 * are a different consumer answering a different question ("how well does
 * D's resume match this JD"), not "is this role in D's lane."
 */

export interface JobKnockoutInput {
  title: string;
  jobDescription: string;
}

export type HardKnockoutReason =
  | 'ic_only_title'
  | 'onsite_only_no_remote_path'
  | 'clearance_required';

export type SoftPenaltyReason = 'comp_below_floor';

export type StretchFlag = 'vp_stretch';

export interface JobKnockoutResult {
  knockedOut: boolean;
  hardReasons: HardKnockoutReason[];
  softPenalties: SoftPenaltyReason[];
  stretchFlags: StretchFlag[];
}

const COMP_FLOOR = 230_000;

// In-lane management titles (scope floor: EM and above). Checked first so an
// explicit management title always wins over an incidental IC-keyword match
// in the same string (e.g. "Engineering Manager, Staff Platform Team").
const MANAGEMENT_TITLE_PATTERN =
  /\b(engineering manager|em\b|director[- ]?(of)?\s*engineering|head of (engineering|platform)|senior engineering manager|sr\.?\s*engineering manager|group engineering manager|senior manager|sr\.?\s*manager)\b/i;

const VP_TITLE_PATTERN = /\bvp\b|\bvice president\b/i;

// Hard-out per Clara's ruling: "any IC title (Staff/Principal/Distinguished)".
// Broadened slightly to catch the common synonyms for the same IC tracks.
const IC_TITLE_PATTERN =
  /\b(staff|principal|distinguished)\s+(software\s+)?engineer\b|\bindividual contributor\b/i;

const ONSITE_ONLY_PATTERN =
  /\b(100%\s*on[- ]?site|fully\s+on[- ]?site|fully\s+in[- ]?office|on[- ]?site\s+(only|required|five days|5 days)|no\s+remote\s+work|not\s+a\s+remote\s+(position|role)|in[- ]?office\s+(only|five days|5 days))\b/i;

const REMOTE_OR_HYBRID_ESCAPE_PATTERN =
  /\b(hybrid|remote[- ]?friendly|remote[- ]?flexible|fully remote|remote position|work from (home|anywhere)|flexible (work|schedule))\b/i;

const CLEARANCE_PATTERN =
  /\b(security clearance|active clearance|ts\/sci|top secret clearance|obtain(?:ing)?\s+(?:and\s+maintain(?:ing)?\s+)?a?\s*(?:u\.?s\.?\s*government\s*)?(?:security\s*)?clearance|polygraph)\b/i;

// $180,000 / $180K / $180,000-$210,000 / $180k-$210k — captures every number
// token so the caller can take the max across a stated range.
const SALARY_TOKEN_PATTERN = /\$\s?(\d{2,3}(?:,\d{3})?)(k)?/gi;

function classifyTitle(title: string): {
  isManagement: boolean;
  isIcOnly: boolean;
  isVpStretch: boolean;
} {
  const isManagement = MANAGEMENT_TITLE_PATTERN.test(title);
  const isVpStretch = !isManagement && VP_TITLE_PATTERN.test(title);
  // IC-only fires only when the title carries an IC signal and no
  // management/VP signal — a title like "Staff Engineering Manager" (rare,
  // some orgs use it for a senior IC-adjacent management role) should not
  // be knocked out just because "staff" appears somewhere in the string.
  const isIcOnly = IC_TITLE_PATTERN.test(title) && !isManagement && !isVpStretch;
  return { isManagement, isIcOnly, isVpStretch };
}

function checkOnsiteOnly(jobDescription: string): boolean {
  if (!ONSITE_ONLY_PATTERN.test(jobDescription)) return false;
  // "Not Denver alone" clause: any hybrid/remote escape language anywhere in
  // the JD means this is not a zero-remote-path posting, even if an on-site
  // phrase also appears (e.g. "hybrid — 3 days on-site per week").
  if (REMOTE_OR_HYBRID_ESCAPE_PATTERN.test(jobDescription)) return false;
  return true;
}

function extractMaxStatedSalary(jobDescription: string): number | null {
  const matches = [...jobDescription.matchAll(SALARY_TOKEN_PATTERN)];
  if (matches.length === 0) return null;

  const values = matches
    .map(([, digits, kSuffix]) => {
      const numeric = Number(digits.replace(/,/g, ''));
      if (!Number.isFinite(numeric)) return null;
      // "$180k" -> 180 * 1000. "$180,000" already has the full magnitude, and
      // a bare "$180" with no k-suffix and no thousands-comma is too small to
      // be a plausible annual base salary token — skip it rather than treat
      // it as $180.
      if (kSuffix) return numeric * 1000;
      if (numeric >= 1000) return numeric;
      return null;
    })
    .filter((n): n is number => n !== null);

  if (values.length === 0) return null;
  return Math.max(...values);
}

export function evaluateJobKnockout(input: JobKnockoutInput): JobKnockoutResult {
  const title = input.title ?? '';
  const jobDescription = input.jobDescription ?? '';

  const hardReasons: HardKnockoutReason[] = [];
  const softPenalties: SoftPenaltyReason[] = [];
  const stretchFlags: StretchFlag[] = [];

  const { isIcOnly, isVpStretch } = classifyTitle(title);
  if (isIcOnly) hardReasons.push('ic_only_title');
  if (isVpStretch) stretchFlags.push('vp_stretch');

  if (checkOnsiteOnly(jobDescription)) hardReasons.push('onsite_only_no_remote_path');

  if (CLEARANCE_PATTERN.test(jobDescription)) hardReasons.push('clearance_required');

  const maxSalary = extractMaxStatedSalary(jobDescription);
  if (maxSalary !== null && maxSalary < COMP_FLOOR) softPenalties.push('comp_below_floor');

  return {
    knockedOut: hardReasons.length > 0,
    hardReasons,
    softPenalties,
    stretchFlags,
  };
}
