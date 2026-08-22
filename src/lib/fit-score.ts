/**
 * Fit Score — "should D apply to this role", on one 0-100 scale (ENG-1995).
 *
 * D ratified this rubric on 2026-08-22. It replaces `role-fit-scorer.ts`'s
 * seven-signal weighted table wholesale:
 *
 *   1. Experience match      40  does D's career history evidence this JD's work
 *   2. Title / level         25  graded, not binary
 *   3. Compensation          20  undisclosed takes full credit, flagged
 *   4. Remote friendliness   15  Colorado always full marks
 *
 * Deleted outright: company tier, org scope / span / team size, years of
 * experience, the role-strategy signal, and domain as a separate signal —
 * domain folds into experience match.
 *
 * Naming, so it stays consistent in code and comments: **Fit Score** = should D
 * apply. **ATS Score** = will his resume get through. Nothing else gets a score.
 * `resume-anchoring.ts` and `resume-rubric.ts`'s `scope_evidence` dimension
 * belong to the ATS Score and are deliberately not on this path.
 *
 * ## Why a title miss self-enforces
 *
 * Perfect on everything except title scores 40 + 20 + 15 = 75. That is below the
 * 80 surface threshold on the arithmetic alone, which is exactly what D asked
 * for — no separate title gate is needed, and a strong adjacent title ("Head of
 * Infrastructure", 20) still reaches 95 rather than being thrown away.
 *
 * ## Gate set — what changed and what did not
 *
 * D's ruling: "Gates unchanged — non-US geography, non-engineering function,
 * IC-only. A gate failure scores 0. Gates are not weights."
 *
 * G1 (management signal), G2 (IC exclusion), G3 (function exclusion) and G4
 * (geography) carry over unmodified from `role-fit-scorer.ts`.
 *
 * **G5 (location) is deleted.** It rejected any US role that was not Remote-US
 * or Colorado. The new remote component grades exactly that space — 12 for a
 * remote-ok company with an onsite req, 8 for hub-flex, 3 for office-first — so
 * keeping G5 would make every one of those tiers dead code. A component and a
 * gate cannot both own the same question.
 *
 * **G6 (comp floor, $230K) is kept.** Nothing in the new table contradicts it:
 * the component's lowest scoring band starts at $250K, so G6 shadows no band it
 * could disagree with. It only rejects roles the component would score 0
 * anyway — and without it, a sub-floor role perfect on the other three
 * components lands on exactly 40 + 25 + 0 + 15 = 80 and surfaces. Flagged for D
 * on ENG-1995: the floor and the component's "below floor" band are $20K apart
 * ($230K vs $250K), and it is his call whether they should be the same number.
 */

import type { DimensionKey, DimensionResult } from '@/lib/resume-rubric';
import { MAX_DIMENSION_SCORE } from '@/lib/resume-rubric';

// ---------------------------------------------------------------------------
// Component weights + the single surface threshold
// ---------------------------------------------------------------------------

export const FIT_EXPERIENCE_MAX = 40;
export const FIT_TITLE_MAX = 25;
export const FIT_COMP_MAX = 20;
export const FIT_REMOTE_MAX = 15;

/**
 * One threshold, one answer: surface it or don't. Replaces the pipeline's
 * `SCORE_HIGH = 85` / `SCORE_DIGEST = 80` two-tier split (ENG-1994 collapses the
 * Python side onto this number).
 */
export const FIT_SCORE_SURFACE = 80;

export type FitFlag =
  | 'comp_undisclosed'
  | 'remote_negotiable'
  | 'posture_unknown'
  | 'span_unquantified';

export type GateFailedReason =
  | 'G1_no_mgmt_signal'
  | 'G2_ic_exclusion'
  | 'G3_function_exclusion'
  | 'G4_geography'
  | 'G6_comp_floor';

export interface FitScoreInput {
  title: string;
  jobDescription: string;
  /** Structured location, when the caller has it. */
  location?: string;
  /** Structured comp range text, when the caller has it. */
  compRange?: string;
}

export interface FitBreakdown {
  experience: number;
  title: number;
  comp: number;
  remote: number;
}

export interface FitScoreResult {
  total: number;
  gateFailed: GateFailedReason[];
  gateEvidence: Record<string, string>;
  breakdown: FitBreakdown;
  flags: FitFlag[];
  /** Which title tier matched, for auditing a score without re-running it. */
  titleTier: TitleTier;
  /** Resolved company remote posture, `unknown` when the map has no entry. */
  remotePosture: CompanyRemotePosture;
  /** Raw rubric total (0-12) behind the experience component; null when gated. */
  experienceRaw: number | null;
}

// ---------------------------------------------------------------------------
// Title normalisation + head/tail split (carried over unchanged)
// ---------------------------------------------------------------------------

function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics after NFKD decomposition
    .toLowerCase()
    .replace(/[–—/|·]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

interface HeadTail {
  head: string;
  tail: string;
}

// Split at the FIRST ',' or ' - ' (the normaliser already turns '|' into
// '-', so the tail split only needs to watch for ',' and ' - ').
function splitHeadTail(normalizedTitle: string): HeadTail {
  const match = normalizedTitle.match(/^(.*?)(?:,| - )(.*)$/);
  if (!match) return { head: normalizedTitle, tail: '' };
  return { head: match[1].trim(), tail: match[2].trim() };
}

// ---------------------------------------------------------------------------
// G1 — management signal required
//
// The title primitives below are the SINGLE source of truth for which words
// name an engineering-leadership title. ENG-1995 AC4: the graded title
// component composes these same primitives rather than introducing a third
// parallel title regex — `G1_TITLE_PATTERN` and the old `scoreLevel` were two,
// and they disagreed with each other twice (ENG-1974, ENG-1985).
// ---------------------------------------------------------------------------

/**
 * A short, bounded span of qualifier words between a comma and the domain token
 * ("Manager, Cloud Infrastructure", "Manager, CI/CD Infrastructure"). Bounded so
 * it cannot swallow an unrelated title into a false match (ENG-1985).
 */
const G1_QUALIFIER_SPAN = '(?:[a-z0-9&/+ -]{0,28}\\s)?';

/**
 * `technical` excludes a following "program management": "Manager, Technical
 * Program Management" is a TPM title, not an engineering-management one.
 */
const G1_DOMAIN_WORDS =
  '(software|engineering|platform|infrastructure|data|ml|machine learning|security|developer|devops|site reliability|technical(?!\\s*program(?:\\s|-)*management))';

/** The domain token that makes a comma form the *exact* title rather than a domain variant. */
const CORE_ENGINEERING_DOMAIN = '(?:software\\s+)?engineering';

const G1_TITLE_PATTERN = new RegExp(
  '\\b(engineering manager|senior engineering manager|sr\\.?\\s*engineering manager|group engineering manager|engineering director|director of engineering' +
    '|manager,?\\s*' +
    G1_QUALIFIER_SPAN +
    G1_DOMAIN_WORDS +
    '|(director|senior director|sr\\.?\\s*director|svp|vp),?\\s*(of\\s*)?' +
    G1_QUALIFIER_SPAN +
    G1_DOMAIN_WORDS +
    '|head of\\s*(engineering|software|platform|infrastructure|technology|developer)|vp\\s*(of\\s*)?engineering|vice president,?\\s*(of\\s*)?engineering|tech(nical)? lead\\s*-?\\s*manager|engineering lead|head of technical)\\b'
);

const G1_BODY_SIGNALS = [
  'direct reports',
  'people manage',
  'people leadership',
  'performance review',
  'hiring plan',
  'manage a team of',
  'lead a team of',
  'coach and mentor engineers',
  '1:1s',
  'one-on-ones',
  'headcount',
  'career development of',
  'grow and develop engineers',
  'manage engineering managers',
  'succession planning',
  'multi-layer organization',
];

// Executive-register phrasing the literal substrings above either can't express
// (a variable headcount, a team noun) or would false-positive on: "engineering
// leaders" as a bare `.includes()` needle also matches inside "engineering
// leadership" (ENG-1974).
const G1_BODY_PATTERNS: RegExp[] = [
  /\blead(?:ing)?\s+(?:and\s+develop\s+)?(?:a\s+)?(?:global\s+|regional\s+|distributed\s+)?\S+\s+team\b/i,
  /\bleading\s+\d+\+\s+engineers?\b/i,
  /\bengineering leaders\b/i,
];

function countMatches(haystack: string, needles: string[]): number {
  return needles.filter((n) => haystack.includes(n)).length;
}

function g1BodySignalCount(jobDescription: string): number {
  const body = jobDescription.toLowerCase();
  const literal = countMatches(body, G1_BODY_SIGNALS);
  const pattern = G1_BODY_PATTERNS.filter((p) => p.test(jobDescription)).length;
  return literal + pattern;
}

function g1Passes(normalizedTitle: string, jobDescription: string): boolean {
  if (G1_TITLE_PATTERN.test(normalizedTitle)) return true;
  return g1BodySignalCount(jobDescription) >= 1;
}

// ---------------------------------------------------------------------------
// G2 — IC exclusion (only evaluated when G1's title regex did not match)
// ---------------------------------------------------------------------------

const G2_NUMERIC_LEVEL =
  /\b(engineer|developer|scientist|architect|programmer)\s*#?\s*(\d{1,2}|i{1,3}|iv|vi{0,3}|ix|x)\b|\bl[3-9]\b|\bl1[0-2]\b|\bsde\s*(i{1,3}|[1-3])\b|\bswe\s*(i{1,3}|[1-3])\b|\be[3-9]\b/;

const G2_IC_SENIORITY_NOUN =
  /\b(staff|senior staff|principal|senior principal|distinguished|fellow|member of technical staff|mts|smts|architect)\b/;

const G2_BARE_IC_ROLE =
  /\b(software|systems|distributed systems|platform|infrastructure|security|data|ml|machine learning|research|backend|front[- ]?end|full[- ]?stack|mobile|ios|android|site reliability|network|firmware|embedded)\s+engineer\b/;

function g2Rejects(normalizedTitle: string): boolean {
  return (
    G2_NUMERIC_LEVEL.test(normalizedTitle) ||
    G2_IC_SENIORITY_NOUN.test(normalizedTitle) ||
    G2_BARE_IC_ROLE.test(normalizedTitle)
  );
}

// ---------------------------------------------------------------------------
// G3 — function exclusion (head only)
// ---------------------------------------------------------------------------

const G3_EXCLUDED_FUNCTION =
  /\b(admin(istrative)? assistant|executive assistant|office manager|receptionist|coordinator|recruiter|recruiting|technical recruiter|sourcer|talent|sales|account executive|account manager|business development|customer success|solutions consultant|marketing|brand|content|communications|counsel|attorney|paralegal|compliance officer|accountant|controller|finance manager|bookkeeper|hr|human resources|people operations|facilities|designer|ux researcher|design manager|data analyst|business analyst|financial analyst)\b/;

const G3_PROGRAM_PRODUCT_MGMT =
  /\b(technical )?(program|product) manager\b|\btpm\b|\b(program|product) management\b/;

function g3Rejects(head: string, jobDescription: string): boolean {
  if (G3_EXCLUDED_FUNCTION.test(head)) return true;
  if (G3_PROGRAM_PRODUCT_MGMT.test(head)) {
    const hasG1Title = G1_TITLE_PATTERN.test(head);
    const bodySignals = g1BodySignalCount(jobDescription);
    if (!(hasG1Title && bodySignals >= 1)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// G4 — geography
// ---------------------------------------------------------------------------

const US_HUBS = [
  'san francisco', 'sf', 'bay area', 'new york', 'nyc', 'brooklyn', 'seattle',
  'bellevue', 'redmond', 'austin', 'dallas', 'houston', 'denver', 'boulder',
  'chicago', 'boston', 'cambridge ma', 'los angeles', 'la', 'san jose',
  'mountain view', 'sunnyvale', 'palo alto', 'santa clara', 'san diego', 'atlanta',
  'portland', 'phoenix', 'miami', 'nashville', 'pittsburgh', 'raleigh',
  'salt lake city', 'minneapolis', 'philadelphia', 'washington',
];
const US_TOKENS = [
  'united states', 'usa', 'u.s.', 'us-remote', 'remote - us',
  'remote (united states)', 'washington dc',
];
const NON_US_REGIONS = ['emea', 'apac', 'latam', 'eu', 'uk', 'europe', 'asia'];
const NON_US_COUNTRIES = [
  'poland', 'germany', 'france', 'spain', 'italy', 'portugal', 'netherlands',
  'belgium', 'switzerland', 'austria', 'sweden', 'norway', 'denmark',
  'finland', 'ireland', 'iceland', 'czech republic', 'slovakia', 'hungary',
  'romania', 'bulgaria', 'greece', 'croatia', 'serbia', 'ukraine',
  'india', 'china', 'japan', 'south korea', 'singapore', 'philippines',
  'vietnam', 'thailand', 'indonesia', 'malaysia', 'israel', 'united arab emirates',
  'canada', 'mexico', 'brazil', 'argentina', 'chile', 'colombia', 'peru',
  'australia', 'new zealand', 'south africa', 'nigeria', 'kenya', 'egypt',
];
const NON_US_HUBS = [
  'london', 'dublin', 'edinburgh', 'manchester', 'warsaw', 'krakow', 'gdansk',
  'wroclaw', 'berlin', 'munich', 'hamburg', 'amsterdam', 'paris', 'zurich',
  'geneva', 'milan', 'madrid', 'barcelona', 'lisbon', 'stockholm',
  'copenhagen', 'oslo', 'helsinki', 'prague', 'budapest', 'bucharest',
  'sofia', 'tel aviv', 'dubai', 'bangalore', 'bengaluru', 'hyderabad', 'pune',
  'mumbai', 'delhi', 'gurgaon', 'chennai', 'singapore', 'tokyo', 'seoul',
  'shanghai', 'beijing', 'shenzhen', 'hong kong', 'taipei', 'sydney',
  'melbourne', 'auckland', 'toronto', 'vancouver', 'montreal', 'ottawa',
  'mexico city', 'guadalajara', 'sao paulo', 'buenos aires', 'bogota',
  'santiago', 'lima', 'cape town', 'lagos', 'nairobi',
];

export type GeoVerdict = 'us' | 'non_us' | 'unknown';

// Word-boundary containment, not substring `includes` — short tokens ('la')
// otherwise false-positive inside unrelated words ('poland', 'atlanta').
function containsToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

function resolveGeography(
  tail: string,
  jobDescription: string,
  structuredLocation?: string
): GeoVerdict {
  const sources = [structuredLocation ?? '', tail, jobDescription.slice(0, 1500)].map((s) =>
    s.toLowerCase()
  );
  const bodyLocationLine = jobDescription
    .split(/\r?\n/)
    .find((line) => /^\s*(location|office|locations|based in|work location|country)\s*[:\-]/i.test(line));
  if (bodyLocationLine) sources.push(bodyLocationLine.toLowerCase());

  const first1500 = jobDescription.slice(0, 1500).toLowerCase();
  const remoteAmericas = /\bremote\b/.test(first1500) && /\bamericas\b/.test(first1500);

  let sawUs = remoteAmericas;
  let sawNonUs = false;

  for (const s of sources) {
    if (!s) continue;
    if (US_TOKENS.some((t) => containsToken(s, t)) || US_HUBS.some((h) => containsToken(s, h))) {
      sawUs = true;
    }
    if (
      NON_US_REGIONS.some((r) => containsToken(s, r)) ||
      NON_US_HUBS.some((h) => containsToken(s, h)) ||
      NON_US_COUNTRIES.some((c) => containsToken(s, c))
    ) {
      sawNonUs = true;
    }
  }

  if (sawUs) return 'us';
  if (sawNonUs) return 'non_us';
  return 'unknown';
}

function locationSources(tail: string, jobDescription: string, structuredLocation?: string): string {
  return [structuredLocation ?? '', tail, jobDescription.slice(0, 1500)].join(' ').toLowerCase();
}

/**
 * Explicitly US-scoped, genuinely remote work — not a hybrid role that merely
 * mentions "remote-eligible" alongside a US token.
 */
function isRemoteUS(jobDescription: string, tail: string, structuredLocation?: string): boolean {
  const source = locationSources(tail, jobDescription, structuredLocation);
  const hasUsToken = /\b(?:us|usa|united states|us-based)\b|\bu\.s\.(?=\W|$)/.test(source);
  if (!hasUsToken) return false;

  const hasStrongRemoteSignal = /\bfully remote\b|\b100%\s*remote\b|\bremote[- ]first\b|\bremote\s*\(us\)|\bus[- ]remote\b|\bremote\s*-\s*(?:us|united states)\b/.test(source);
  if (hasStrongRemoteSignal) return true;

  const isHedgedOrHybrid = /\bhybrid\b|\bremote[- ]eligible\b|\bremote[- ]friendly\b|\bremote[- ]optional\b/.test(source);
  if (isHedgedOrHybrid) return false;

  return /\bremote\b/.test(source);
}

function isColorado(jobDescription: string, tail: string, structuredLocation?: string): boolean {
  return /\bboulder\b|\bcolorado\b|\bdenver\b/.test(locationSources(tail, jobDescription, structuredLocation));
}

// ---------------------------------------------------------------------------
// Component 2 — Title / level, graded 25 / 20 / 18 / 10 / 0
// ---------------------------------------------------------------------------

export type TitleTier = 'exact' | 'equivalent' | 'domain_qualified' | 'ambiguous_lead' | 'none';

/**
 * The comma form of an exact title is the exact title. "Director, Engineering"
 * and "Director of Engineering" are the same job; scoring them 18 and 25 would
 * reintroduce exactly the gate/score disagreement ENG-1974 and ENG-1985 fixed.
 * The 18-point tier is for a comma form whose domain is a *sub*-domain
 * ("Director, Infrastructure"), which is what D's table names.
 */
const TITLE_EXACT: RegExp[] = [
  new RegExp('\\b(senior|sr\\.?)\\s*engineering manager\\b'),
  new RegExp('\\bengineering manager\\b'),
  new RegExp('\\bmanager,\\s*' + CORE_ENGINEERING_DOMAIN + '\\b'),
  new RegExp('\\b(engineering director|director of engineering)\\b'),
  new RegExp('\\bdirector,\\s*' + CORE_ENGINEERING_DOMAIN + '\\b'),
  new RegExp('\\bvp\\s*(of\\s+)?engineering\\b'),
  new RegExp('\\bvice president,?\\s*(of\\s+)?engineering\\b'),
  new RegExp('\\b(vp|svp),\\s*' + CORE_ENGINEERING_DOMAIN + '\\b'),
];

/**
 * D's named equivalents, plus "Head of <domain>" — his own worked example is
 * "Head of Infrastructure" graded at 20, which reaches 95 rather than being
 * discarded at 75.
 */
const TITLE_EQUIVALENT: RegExp[] = [
  new RegExp('\\bgroup engineering manager\\b'),
  new RegExp('\\b(senior|sr\\.?)\\s*manager,?\\s*' + G1_QUALIFIER_SPAN + G1_DOMAIN_WORDS + '\\b'),
  new RegExp('\\bhead of\\s*(engineering|software|platform|infrastructure|technology|developer|data|security|devops|site reliability)\\b'),
];

/** `Manager, <domain>` / `Director, <domain>` / `VP, <domain>` — a sub-domain after the comma. */
const TITLE_DOMAIN_QUALIFIED = new RegExp(
  '\\b(manager|director|senior director|sr\\.?\\s*director|vp|svp),\\s*' +
    G1_QUALIFIER_SPAN +
    G1_DOMAIN_WORDS +
    '\\b'
);

/** Lead titles that carry a management hint but do not name a level. */
const TITLE_AMBIGUOUS_LEAD: RegExp[] = [
  /\btech(nical)? lead\s*-?\s*manager\b/,
  /\bengineering lead\b/,
  /\bhead of technical\b/,
  /\b(technology|technical|team|delivery) lead\b/,
];

const TITLE_TIER_POINTS: Record<TitleTier, number> = {
  exact: 25,
  equivalent: 20,
  domain_qualified: 18,
  ambiguous_lead: 10,
  none: 0,
};

/**
 * Tiers are evaluated most-specific first: "group engineering manager" and
 * "senior manager, engineering" both contain a substring that a lower-precedence
 * exact pattern would otherwise claim.
 */
export function resolveTitleTier(normalizedTitle: string): TitleTier {
  if (TITLE_EQUIVALENT.some((p) => p.test(normalizedTitle))) return 'equivalent';
  if (TITLE_EXACT.some((p) => p.test(normalizedTitle))) return 'exact';
  if (TITLE_DOMAIN_QUALIFIED.test(normalizedTitle)) return 'domain_qualified';
  if (TITLE_AMBIGUOUS_LEAD.some((p) => p.test(normalizedTitle))) return 'ambiguous_lead';
  return 'none';
}

export function scoreTitle(normalizedTitle: string): { pts: number; tier: TitleTier } {
  const tier = resolveTitleTier(normalizedTitle);
  return { pts: TITLE_TIER_POINTS[tier], tier };
}

// ---------------------------------------------------------------------------
// Component 3 — Compensation, 20 points
// ---------------------------------------------------------------------------

const SALARY_RANGE = /\$\s?(\d{1,3}(?:,\d{3})*)(k)?\s*(?:-|–|—|to)\s*\$?\s?(\d{1,3}(?:,\d{3})*)(k)?/gi;
const SALARY_SINGLE = /\$\s?(\d{2,3}(?:,\d{3})?)(k)?/gi;
const SALARY_RANGE_ISO_AT_START = /\b(\d{1,3}(?:,\d{3})*)(k)?\s*(?:USD|CAD|EUR|GBP)\b\s*(?:-|–|—|to)\s*(\d{1,3}(?:,\d{3})*)(k)?(?:\s*(?:USD|CAD|EUR|GBP)\b)?/gi;
const SALARY_RANGE_ISO_AT_END = /\b(\d{1,3}(?:,\d{3})*)(k)?(?:\s*(?:USD|CAD|EUR|GBP)\b)?\s*(?:-|–|—|to)\s*(\d{1,3}(?:,\d{3})*)(k)?\s*(?:USD|CAD|EUR|GBP)\b/gi;
const SALARY_SINGLE_ISO = /\b(\d{2,3}(?:,\d{3})?)(k)?\s*(?:USD|CAD|EUR|GBP)\b/gi;

function parseAmount(digits: string, hasK: boolean): number | null {
  const numeric = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  if (hasK) return numeric * 1000;
  if (numeric >= 1000) return numeric;
  return null;
}

export function extractMaxStatedSalary(text: string): number | null {
  const values: number[] = [];
  for (const pattern of [SALARY_RANGE, SALARY_RANGE_ISO_AT_START, SALARY_RANGE_ISO_AT_END]) {
    for (const [, sd, sk, ed, ek] of text.matchAll(pattern)) {
      const startHasK = Boolean(sk);
      const endRaw = Number(ed.replace(/,/g, ''));
      const endHasK = Boolean(ek) || (startHasK && endRaw < 1000);
      const s = parseAmount(sd, startHasK);
      const e = parseAmount(ed, endHasK);
      if (s !== null) values.push(s);
      if (e !== null) values.push(e);
    }
  }
  for (const pattern of [SALARY_SINGLE, SALARY_SINGLE_ISO]) {
    for (const [, d, k] of text.matchAll(pattern)) {
      const v = parseAmount(d, Boolean(k));
      if (v !== null) values.push(v);
    }
  }
  return values.length ? Math.max(...values) : null;
}

/** Below this, G6 rejects outright. See the module header on why it survives. */
export const COMP_GATE_FLOOR = 230_000;

/**
 * Undisclosed takes full credit, flagged. D chose this over penalising silence:
 * Google publishes no band on its own careers pages and NVIDIA states none, so a
 * penalty would suppress his best targets. The flag carries the risk to him.
 */
export function scoreComp(max: number | null): { pts: number; flag?: FitFlag } {
  if (max === null) return { pts: 20, flag: 'comp_undisclosed' };
  if (max >= 350_000) return { pts: 20 };
  if (max >= 300_000) return { pts: 16 };
  if (max >= 250_000) return { pts: 8 };
  return { pts: 0 };
}

// ---------------------------------------------------------------------------
// Component 4 — Remote friendliness, 15 points
// ---------------------------------------------------------------------------

export type CompanyRemotePosture = 'remote-ok' | 'hub-flex' | 'office-first' | 'unknown';

interface CompanyRemotePostureRecord {
  posture: Exclude<CompanyRemotePosture, 'unknown'>;
  source: string;
  checkedOn: string;
}

/**
 * Interim source of truth. ENG-1977 replaces this literal with a self-maintaining
 * company record ({board, posture}) that resolves an unseen company once and
 * persists the answer; until it lands, this map is what the remote component
 * reads. Do not grow it by hand beyond a correction — that ticket exists because
 * a hand-maintained list is the failure mode.
 */
const COMPANY_REMOTE_POSTURE: Record<string, CompanyRemotePostureRecord> = {
  nvidia: { posture: 'remote-ok', source: 'No RTO mandate; manager/team location discretion', checkedOn: '2026-08-19' },
  airbnb: { posture: 'remote-ok', source: 'Company remote-work policy', checkedOn: '2026-08-19' },
  'sprout social': { posture: 'remote-ok', source: 'Company remote-work policy', checkedOn: '2026-08-19' },
  vercel: { posture: 'hub-flex', source: 'Hub-flex work model', checkedOn: '2026-08-19' },
  anthropic: { posture: 'office-first', source: 'Office-first work model', checkedOn: '2026-08-19' },
  netflix: { posture: 'office-first', source: 'Office-first work model', checkedOn: '2026-08-19' },
};

const POSTURE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export function resolveCompanyRemotePosture(company: string): CompanyRemotePosture {
  const c = company.toLowerCase();
  const entry = Object.entries(COMPANY_REMOTE_POSTURE).find(([name]) => c.includes(name))?.[1];
  if (!entry) return 'unknown';

  const checkedOn = Date.parse(`${entry.checkedOn}T00:00:00.000Z`);
  if (!Number.isFinite(checkedOn) || Date.now() - checkedOn > POSTURE_MAX_AGE_MS) return 'unknown';
  return entry.posture;
}

/**
 * Colorado always scores full marks regardless of posture. D lives in Boulder;
 * an on-site Boulder role is the best case, not a compromise. Posture only
 * decides roles outside Colorado.
 *
 * `unknown` scores 3 AND raises `posture_unknown` — it never silently takes a
 * middle value. Escalating that flag to D is the pipeline's job, not a pure
 * scoring function's.
 */
export function scoreRemote(
  posture: CompanyRemotePosture,
  jobDescription: string,
  tail: string,
  structuredLocation: string | undefined
): { pts: number; flag?: FitFlag } {
  if (isColorado(jobDescription, tail, structuredLocation)) return { pts: 15 };
  if (isRemoteUS(jobDescription, tail, structuredLocation)) return { pts: 15 };
  if (posture === 'remote-ok') return { pts: 12, flag: 'remote_negotiable' };
  if (posture === 'hub-flex') return { pts: 8 };
  if (posture === 'office-first') return { pts: 3 };
  return { pts: 3, flag: 'posture_unknown' };
}

// ---------------------------------------------------------------------------
// Component 1 — Experience match, 40 points
// ---------------------------------------------------------------------------

/**
 * The three `resume-rubric.ts` dimensions that answer "does D's history evidence
 * the work this JD describes".
 *
 * `scope_evidence` is deliberately ABSENT. It asks whether the resume evidences
 * leading an organisation of a given size and layer count, and D explicitly
 * removed org size and team size from fit scoring — it must not influence whether
 * a role surfaces. It stays in the rubric for the ATS Score, where "can I rewrite
 * my way to this" is the right question.
 *
 * `impact_evidence` is likewise absent: it measures whether the RESUME states
 * quantified outcomes, which is a document-quality question, not a fit question.
 */
export const FIT_EXPERIENCE_DIMENSIONS: readonly DimensionKey[] = [
  'requirement_coverage',
  'domain_evidence',
  'leadership_evidence',
] as const;

export const FIT_EXPERIENCE_RAW_MAX = FIT_EXPERIENCE_DIMENSIONS.length * MAX_DIMENSION_SCORE; // 12

/**
 * Equal weights across the three dimensions — the rubric gives no intra-component
 * weighting, so the plain reading is equal. Rounded to an integer because
 * `job_pipeline.py` rejects a non-integer total as schema drift.
 */
export function scoreExperienceMatch(dimensions: DimensionResult[]): { pts: number; raw: number } {
  const raw = dimensions
    .filter((d) => (FIT_EXPERIENCE_DIMENSIONS as readonly string[]).includes(d.dimension))
    .reduce((sum, d) => sum + d.score, 0);
  const clamped = Math.max(0, Math.min(FIT_EXPERIENCE_RAW_MAX, raw));
  return { pts: Math.round((FIT_EXPERIENCE_MAX * clamped) / FIT_EXPERIENCE_RAW_MAX), raw: clamped };
}

// ---------------------------------------------------------------------------
// Gate evaluation
// ---------------------------------------------------------------------------

export interface FitGateResult {
  failed: GateFailedReason[];
  evidence: Record<string, string>;
  normalized: string;
  head: string;
  tail: string;
  geo: GeoVerdict;
  maxStatedSalary: number | null;
  posture: CompanyRemotePosture;
}

/**
 * Gates are pure and cheap, and they run BEFORE the experience component's model
 * calls. A role D cannot take should not consume three LLM calls to prove it
 * would have scored well.
 */
export function evaluateFitGates(input: FitScoreInput, company: string): FitGateResult {
  const normalized = normalizeTitle(input.title ?? '');
  const { head, tail } = splitHeadTail(normalized);
  const jobDescription = input.jobDescription ?? '';
  const posture = resolveCompanyRemotePosture(company ?? '');

  const failed: GateFailedReason[] = [];
  const evidence: Record<string, string> = {};

  // Tested against the pre-split normalized title, not `head` — the head/tail
  // split has already moved everything after the first comma into `tail`, which
  // made the comma alternatives permanently dead code (ENG-1564 Codex P1).
  const hasG1TitleMatch = G1_TITLE_PATTERN.test(normalized);
  if (!g1Passes(normalized, jobDescription)) {
    failed.push('G1_no_mgmt_signal');
    evidence.G1_no_mgmt_signal = `no management-title match in title="${normalized}" and body fallback signals < 1`;
  }

  // G2 short-circuits on a G1 title match — never IC-rejects a management title.
  if (!hasG1TitleMatch && g2Rejects(normalized)) {
    failed.push('G2_ic_exclusion');
    evidence.G2_ic_exclusion = `title="${normalized}" matches an IC-level/numeric/bare-engineer pattern`;
  }

  if (g3Rejects(head, jobDescription)) {
    failed.push('G3_function_exclusion');
    evidence.G3_function_exclusion = `head="${head}" matches an excluded function`;
  }

  const geo = resolveGeography(tail, jobDescription, input.location);
  if (geo === 'non_us') {
    failed.push('G4_geography');
    evidence.G4_geography = `tail="${tail}" resolves non-US with no US token present`;
  }

  const maxStatedSalary = extractMaxStatedSalary(input.compRange ?? jobDescription);
  if (maxStatedSalary !== null && maxStatedSalary < COMP_GATE_FLOOR) {
    failed.push('G6_comp_floor');
    evidence.G6_comp_floor = `stated maximum base salary $${maxStatedSalary.toLocaleString()} is below $${COMP_GATE_FLOOR.toLocaleString()}`;
  }

  return { failed, evidence, normalized, head, tail, geo, maxStatedSalary, posture };
}

/** Informational only — org span no longer scores, but D still wants it surfaced. */
function spanUnquantified(jobDescription: string): boolean {
  const jd = jobDescription.toLowerCase();
  if (/\b(\d{1,3})\+?\s*(?:engineers|people)\b|\borg of\s*(\d{1,3})\b/.test(jd)) return false;
  if (/\bsmall team\b|\bfirst em hire\b|\bfirst engineering manager hire\b/.test(jd)) return false;
  return true;
}

export function gatedFitResult(gates: FitGateResult): FitScoreResult {
  return {
    total: 0,
    gateFailed: gates.failed,
    gateEvidence: gates.evidence,
    breakdown: { experience: 0, title: 0, comp: 0, remote: 0 },
    flags: [],
    titleTier: 'none',
    remotePosture: gates.posture,
    experienceRaw: null,
  };
}

/**
 * Assemble the Fit Score from pre-computed gates plus the experience component's
 * rubric dimensions. Split from the gate pass so the caller can skip the model
 * calls entirely on a gated role.
 */
export function assembleFitScore(
  input: FitScoreInput,
  gates: FitGateResult,
  experienceDimensions: DimensionResult[]
): FitScoreResult {
  if (gates.failed.length > 0) return gatedFitResult(gates);

  const jobDescription = input.jobDescription ?? '';
  const flags: FitFlag[] = [];

  const experience = scoreExperienceMatch(experienceDimensions);
  const title = scoreTitle(gates.normalized);
  const comp = scoreComp(gates.maxStatedSalary);
  const remote = scoreRemote(gates.posture, jobDescription, gates.tail, input.location);

  if (comp.flag) flags.push(comp.flag);
  if (remote.flag) flags.push(remote.flag);
  if (spanUnquantified(jobDescription)) flags.push('span_unquantified');

  const breakdown: FitBreakdown = {
    experience: experience.pts,
    title: title.pts,
    comp: comp.pts,
    remote: remote.pts,
  };

  return {
    total: Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)),
    gateFailed: [],
    gateEvidence: {},
    breakdown,
    flags,
    titleTier: title.tier,
    remotePosture: gates.posture,
    experienceRaw: experience.raw,
  };
}

/** One-shot entry point for callers that already hold the rubric dimensions. */
export function evaluateFitScore(
  input: FitScoreInput,
  company: string,
  experienceDimensions: DimensionResult[]
): FitScoreResult {
  return assembleFitScore(input, evaluateFitGates(input, company), experienceDimensions);
}
