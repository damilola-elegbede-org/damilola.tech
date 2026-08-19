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
 *  - Hard knockout: fully on-site with zero remote/hybrid path. NOT
 *    "not Denver" alone — an SF/Seattle 25%-hybrid req stays in-lane.
 *  - Hard knockout: clearance-required (D holds none, not pursuing one).
 *  - Scope floor: EM / Sr EM / Director Eng. A straight EM req is in-lane.
 *    VP Eng is a stretch, flagged but not knocked out.
 *  - Soft penalty (NOT a knockout): base comp below $230K.
 *
 *  - Hard knockout: title-default inverted (D ruling, 2026-08-18; Linear
 *    ENG-1564 comment 2026-08-19). The original design required an explicit
 *    IC-level keyword (Staff/Principal/Distinguished) to knock a title out,
 *    which let numbered IC levels ("Distributed Systems Engineer 4") and
 *    non-technical titles ("Admin Assistant") pass through unflagged into
 *    the scorer — both outranked genuine EM-fit roles on live telemetry
 *    (edb-snapshot.json, n=137, max score 61 vs digest bar 80). Design (b):
 *    any title with no explicit management/VP signal is knocked out, not
 *    just titles matching an explicit IC keyword.
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
//
// The director/engineering branches tolerate comma/hyphen separators, reversed
// word order ("Engineering Director"), and one domain word between "of" and
// "engineering" ("Director of Software Engineering") — non-canonical phrasing
// CodeRabbit flagged (PR#226) as falsely knocking out genuine Director-of-Eng
// roles under the inverted default. Deliberately does NOT cover "Head of
// Infrastructure" or other non-engineering/platform "head of" domains — D's
// 2026-08-18 ruling scopes in-lane "head of" titles to Eng/Platform only.
const MANAGEMENT_TITLE_PATTERN =
  /\b(engineering manager|em\b|director[\s,-]*(?:of\s+)?(?:\w+\s+)?engineering|engineering[\s,-]*director|head of (engineering|platform)|senior engineering manager|sr\.?\s*engineering manager|group engineering manager|senior manager|sr\.?\s*manager)\b/i;

const VP_TITLE_PATTERN = /\bvp\b|\bvice president\b/i;

const ONSITE_ONLY_PATTERN =
  /\b(100%\s*on[- ]?site|fully\s+on[- ]?site|fully\s+in[- ]?office|on[- ]?site\s+(only|required|five days|5 days)|no\s+remote\s+work|not\s+a\s+remote\s+(position|role)|in[- ]?office\s+(only|five days|5 days))\b/i;

// "days? (of) remote" (e.g. "two days of remote work", "2 remote days per
// week") is deliberately NOT anchored to "no" — a negated case like "no
// remote work available" has no "days" token at all, so it can't collide
// with this alternative.
const REMOTE_OR_HYBRID_ESCAPE_PATTERN =
  /\b(hybrid|remote[- ]?friendly|remote[- ]?flexible|fully remote|remote position|work from (home|anywhere)|flexible (work|schedule)|\w+\s+remote\s+days?\b|\w+\s+days?\s+(?:of\s+)?remote\b)\b/i;

// Qualified clearance-type phrases — deliberately requires a qualifying word
// (not bare "clearance", which shows up in unrelated contexts like "customs
// clearance" or "medical clearance") so the KNOCKOUT match itself stays
// precise. "secret clearance" also covers "top secret clearance" as a
// substring, kept explicit for readability.
const CLEARANCE_TERM =
  '(?:security clearance|active clearance|ts\\/sci|top secret clearance|secret clearance|public trust clearance|polygraph)';
const CLEARANCE_PATTERN = new RegExp(
  `\\b(${CLEARANCE_TERM}|obtain(?:ing)?\\s+(?:and\\s+maintain(?:ing)?\\s+)?a?\\s*(?:u\\.?s\\.?\\s*government\\s*)?(?:security\\s*)?clearance)\\b`,
  'i'
);

// Negation lookback/lookahead windows (characters), used to associate a
// negation marker with ONE SPECIFIC clearance mention rather than a whole
// clause or sentence — see hasAffirmativeClearanceRequirement below. A
// clause-level check let one negated mention ("No clearance is needed to
// apply") suppress a separate, affirmative mention later in the SAME clause
// ("...but the hire must obtain a security clearance"); per-match proximity
// doesn't have that failure mode because each mention is judged on its own
// immediately-local context.
const NEGATION_LOOKBACK_CHARS = 40;
const NEGATION_LOOKAHEAD_CHARS = 25;
const NEGATION_BEFORE_PATTERN = /\b(no|without|does\s*n[o']t\s+require)\b/i;
const NEGATION_AFTER_PATTERN = /^\s*(?:is\s+)?not\s+required\b/i;

// $180,000 / $180K — a single figure. Range endpoints that drop their own
// leading '$' (e.g. the "260k" in "$220k–260k") are handled separately in
// extractMaxStatedSalary, which also infers a missing 'k' on a range's
// second endpoint from the first.
const SALARY_TOKEN_PATTERN = /\$\s?(\d{2,3}(?:,\d{3})?)(k)?/gi;

// A compensation range where the second endpoint may omit '$' and/or 'k'
// because it's understood to inherit both from the first (e.g. "$220k–260k",
// "$180,000 - $210,000", "$180K to $210K").
const SALARY_RANGE_PATTERN =
  /\$\s?(\d{1,3}(?:,\d{3})*)(k)?\s*(?:-|–|—|to)\s*\$?\s?(\d{1,3}(?:,\d{3})*)(k)?/gi;

// Naive clause splitter used to scope negation/escape checks to the same
// clause as the triggering phrase, instead of testing the whole document or
// even the whole sentence — a document/sentence-wide test lets an unrelated
// negation elsewhere ("no clearance needed to apply") suppress a real,
// separately stated requirement in the SAME sentence ("...; candidates must
// obtain and maintain a security clearance"). Splits on '.', '!', '?', ';',
// and newlines.
function splitClauses(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).filter((s) => s.trim().length > 0);
}

function classifyTitle(title: string): {
  isManagement: boolean;
  isIcOnly: boolean;
  isVpStretch: boolean;
} {
  const isManagement = MANAGEMENT_TITLE_PATTERN.test(title);
  const isVpStretch = !isManagement && VP_TITLE_PATTERN.test(title);
  // Inverted default (design (b), D ruling 2026-08-18): any title that
  // doesn't carry an explicit management/VP signal is IC-only, regardless of
  // whether it also carries an explicit IC-level keyword. A title like
  // "Staff Engineering Manager" is exempt because it matches
  // MANAGEMENT_TITLE_PATTERN, not because it lacks an IC keyword.
  const isIcOnly = !isManagement && !isVpStretch;
  return { isManagement, isIcOnly, isVpStretch };
}

function checkOnsiteOnly(jobDescription: string): boolean {
  if (!ONSITE_ONLY_PATTERN.test(jobDescription)) return false;
  // "Not Denver alone" clause: hybrid/remote escape language in the SAME
  // sentence as the on-site claim (e.g. "hybrid — 3 days on-site per week")
  // means this is not a zero-remote-path posting. Scoped to the sentence,
  // not the whole document, so an unrelated "our other teams work hybrid"
  // aside elsewhere can't paper over an explicit on-site-only requirement
  // for THIS role — an affirmative on-site claim wins unless the same
  // clause also carries the escape language.
  const onsiteSentences = splitClauses(jobDescription).filter((s) => ONSITE_ONLY_PATTERN.test(s));
  const anyUnescaped = onsiteSentences.some((s) => !REMOTE_OR_HYBRID_ESCAPE_PATTERN.test(s));
  return anyUnescaped;
}

// A clearance mention is an affirmative requirement only if at least one
// OCCURRENCE of it in the text is not itself locally negated — judged
// per-match (a small window immediately around that specific mention), not
// per-clause or per-document. That's what lets "No clearance is needed to
// apply, but the hire must obtain a security clearance" correctly knock out
// (the second mention is unnegated in its own local context) while "No
// security clearance is required" and "No TS/SCI required" correctly don't
// (the negation is immediately local to the only mention present).
function hasAffirmativeClearanceRequirement(jobDescription: string): boolean {
  const globalPattern = new RegExp(CLEARANCE_PATTERN.source, 'gi');
  for (const match of jobDescription.matchAll(globalPattern)) {
    if (match.index === undefined) continue;
    const before = jobDescription.slice(Math.max(0, match.index - NEGATION_LOOKBACK_CHARS), match.index);
    const after = jobDescription.slice(
      match.index + match[0].length,
      Math.min(jobDescription.length, match.index + match[0].length + NEGATION_LOOKAHEAD_CHARS)
    );
    const negated = NEGATION_BEFORE_PATTERN.test(before) || NEGATION_AFTER_PATTERN.test(after);
    if (!negated) return true;
  }
  return false;
}

function parseAmount(digits: string, hasK: boolean): number | null {
  const numeric = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  // "180k" -> 180 * 1000. "180,000" already has the full magnitude, and a
  // bare "180" with no k-suffix and no thousands-comma is too small to be a
  // plausible annual base salary token — skip it rather than treat it as $180.
  if (hasK) return numeric * 1000;
  if (numeric >= 1000) return numeric;
  return null;
}

function extractMaxStatedSalary(jobDescription: string): number | null {
  const values: number[] = [];

  // Range form first, so a second endpoint that dropped its own '$' and/or
  // 'k' (e.g. the "260k" in "$220k–260k", or the "260,000" in "$220,000 -
  // 260,000") is still captured, inheriting scale from the first endpoint.
  for (const [, startDigits, startK, endDigits, endK] of jobDescription.matchAll(SALARY_RANGE_PATTERN)) {
    const startHasK = Boolean(startK);
    const endRawNumeric = Number(endDigits.replace(/,/g, ''));
    // Inherit the first endpoint's 'k' scale when the second omits it and its
    // bare digits are too small to be a real salary on their own (e.g. the
    // "260" in "$220k–260k" is 260, not 260000, until we apply this).
    const endHasK = Boolean(endK) || (startHasK && endRawNumeric < 1000);
    const start = parseAmount(startDigits, startHasK);
    const end = parseAmount(endDigits, endHasK);
    if (start !== null) values.push(start);
    if (end !== null) values.push(end);
  }

  // Single-figure form, e.g. "$195,000 base" with no range. Duplicate hits on
  // numbers already captured by the range pass above are harmless — the
  // final result is a max(), which duplicates cannot change.
  for (const [, digits, kSuffix] of jobDescription.matchAll(SALARY_TOKEN_PATTERN)) {
    const val = parseAmount(digits, Boolean(kSuffix));
    if (val !== null) values.push(val);
  }

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

  if (hasAffirmativeClearanceRequirement(jobDescription)) {
    hardReasons.push('clearance_required');
  }

  const maxSalary = extractMaxStatedSalary(jobDescription);
  if (maxSalary !== null && maxSalary < COMP_FLOOR) softPenalties.push('comp_below_floor');

  return {
    knockedOut: hardReasons.length > 0,
    hardReasons,
    softPenalties,
    stretchFlags,
  };
}
