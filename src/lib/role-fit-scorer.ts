/**
 * Role-Fit Scorer — hybrid knockout gates + weighted signal table.
 *
 * ENG-1564. Spec: clara/.tmp/reports/ats-scoring-spec-2026-08-18.md (Clara Nova,
 * OPS-397). Supersedes job-knockout.ts (the 2026-08-10 binary gate) and, for
 * /api/v1/score-job only, supplies a distinct roleFit result alongside the
 * readiness-based currentScore. Does NOT touch readiness-scorer.ts — that
 * module stays the /score-resume and /resume-generator scorer, a different
 * question ("does D's resume match this JD") from this one ("is this role in
 * D's lane, and how good a fit is it").
 *
 * v1 scope decision (2026-08-19, logged on ENG-1564): signals 3/4/8 are
 * spec'd as semantic/LLM-judged (S). This v1 implements them as deterministic
 * phrase-family detection instead — the spec's own §3.3/§3.4/§3.8 phrase
 * lists are exactly what a v1 detector needs, and using them keeps this
 * scorer a pure function of its inputs, which SCORE_CANARY_MAX_DRIFT's
 * zero-noise assumption (job_pipeline.py) depends on. True paraphrase-level
 * semantic matching is deferred to ENG-1565 (evidence-grounded LLM rubric
 * layer) / ENG-1566 (pairwise anchoring + calibration) — that is a
 * numeric-drift-tolerant redesign, not a drop-in swap, so it is out of scope
 * here.
 */

export interface RoleFitInput {
  title: string;
  jobDescription: string;
  /** Structured location, when the caller has it (§7 — not yet wired from scrapers). */
  location?: string;
  /** Structured comp range text, when the caller has it (§7). */
  compRange?: string;
}

export type GateFailedReason =
  | 'G1_no_mgmt_signal'
  | 'G2_ic_exclusion'
  | 'G3_function_exclusion'
  | 'G4_geography'
  | 'G5_location'
  | 'G6_comp_floor';

export interface SignalBreakdown {
  level: number;
  scope: number;
  strategy: number;
  comp: number;
  company: number;
  location: number;
  domain: number;
}

export interface RoleFitResult {
  score: number;
  gateFailed: GateFailedReason[];
  gateEvidence: Record<string, string>;
  breakdown: SignalBreakdown;
  locationUnknown: boolean;
  remoteNegotiable: boolean;
}

// ---------------------------------------------------------------------------
// §2 — Title normalisation + head/tail split
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
// ---------------------------------------------------------------------------

// Director/VP/SVP comma-qualified forms ("Director, Engineering", "VP,
// Infrastructure Engineering", "SVP, Engineering") are the two most common
// senior-leadership title conventions in tech and previously had no comma
// alternative — only the spelled-out "vice president,? ... engineering" form
// did (ENG-1974). Department word list mirrors the existing "manager,?" alt
// so a non-engineering director ("Director, Corporate Accounting") still
// does not match.
const G1_TITLE_PATTERN =
  /\b(engineering manager|senior engineering manager|sr\.?\s*engineering manager|group engineering manager|engineering director|director of engineering|manager,?\s*(software|engineering|platform|infrastructure|data|ml|machine learning|security|developer|devops|site reliability|technical)|(director|senior director|sr\.?\s*director|svp|vp),?\s*(of\s*)?(software|engineering|platform|infrastructure|data|ml|machine learning|security|developer|devops|site reliability|technical)|head of\s*(engineering|software|platform|infrastructure|technology|developer)|vp\s*(of\s*)?engineering|vice president,?\s*(of\s*)?engineering|tech(nical)? lead\s*-?\s*manager|engineering lead|head of technical)\b/;

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

// Executive-register phrasing that the literal G1_BODY_SIGNALS substrings
// either can't express (a variable headcount number, a team noun) or would
// false-positive on as a plain substring (ENG-1974). "engineering leaders"
// as a bare `.includes()` needle also matches inside "engineering
// leadership" — "leadership" contains "leaders" as its first seven
// characters — so it needs a word boundary a plain substring can't give it.
const G1_BODY_PATTERNS: RegExp[] = [
  // "Lead and develop a global SRE team", "lead a distributed platform team"
  /\blead(?:ing)?\s+(?:and\s+develop\s+)?(?:a\s+)?(?:global\s+|regional\s+|distributed\s+)?\S+\s+team\b/i,
  // "leading 50+ engineers", "leading 50+ engineer teams"
  /\bleading\s+\d+\+\s+engineers?\b/i,
  // "developing engineering leaders" — NOT "engineering leadership"
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

function g1Passes(head: string, jobDescription: string): boolean {
  if (G1_TITLE_PATTERN.test(head)) return true;
  return g1BodySignalCount(jobDescription) >= 1;
}

// ---------------------------------------------------------------------------
// G2 — IC exclusion (only evaluated when G1's title regex did not match —
// short-circuit per spec: a management-token title is never IC-rejected)
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
    // Preserved unless the title also carries a G1 management-of-engineers
    // token AND the body clears the G1 body fallback (>=1 signal).
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
// Common country names (§4.2 requires this list, not just hub cities — a
// tail like "Data Platform Poland" carries a country name, no city token).
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

type GeoVerdict = 'us' | 'non_us' | 'unknown';

// Word-boundary containment, not substring `includes` — a plain substring
// test lets short tokens false-positive inside unrelated words (the 'la'
// abbreviation for Los Angeles is a substring of "poland", "cleveland",
// "atlanta", etc.). Escapes regex metacharacters so literal tokens like
// "u.s." match themselves, not "any char" + "s" + "any char".
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

// ---------------------------------------------------------------------------
// Gate evaluation — evaluate all four, OR the failures.
// ---------------------------------------------------------------------------

interface GateResult {
  failed: GateFailedReason[];
  evidence: Record<string, string>;
  normalized: string;
  head: string;
  tail: string;
  geo: GeoVerdict;
  maxStatedSalary: number | null;
}

function locationSources(tail: string, jobDescription: string, structuredLocation?: string): string {
  return [structuredLocation ?? '', tail, jobDescription.slice(0, 1500)].join(' ').toLowerCase();
}

/**
 * G5 accepts explicitly US-scoped, genuinely remote work — not a hybrid role that merely
 * mentions "remote-eligible"/"remote-friendly" alongside a US token. D's ruling names this
 * exact case: a role anchored hybrid in Santa Clara or Austin does not pass, even when the
 * JD separately states "US" and describes itself as remote-eligible for the right candidate.
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

function isBoulderColorado(jobDescription: string, tail: string, structuredLocation?: string): boolean {
  return /\bboulder\b|\bcolorado\b|\bdenver\b/.test(locationSources(tail, jobDescription, structuredLocation));
}

function evaluateGates(input: RoleFitInput, companyRemotePosture: CompanyRemotePosture): GateResult {
  const normalized = normalizeTitle(input.title ?? '');
  const { head, tail } = splitHeadTail(normalized);
  const jobDescription = input.jobDescription ?? '';

  const failed: GateFailedReason[] = [];
  const evidence: Record<string, string> = {};

  // Tested against the pre-split normalized title, not just `head` — G1_TITLE_PATTERN's
  // own `manager,?\s*(software|...)` alternative exists to match comma-qualified titles
  // like "Manager, Software Engineering", but the head/tail split (line 79) already moved
  // everything after the first comma into `tail` by this point, so testing against `head`
  // alone made that alternative permanently dead code (ENG-1564 Codex P1 finding).
  const hasG1TitleMatch = G1_TITLE_PATTERN.test(normalized);
  const g1Ok = g1Passes(normalized, jobDescription);
  if (!g1Ok) {
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

  if (
    geo === 'us' &&
    companyRemotePosture !== 'remote-ok' &&
    companyRemotePosture !== 'hub-flex' &&
    !isRemoteUS(jobDescription, tail, input.location) &&
    !isBoulderColorado(jobDescription, tail, input.location)
  ) {
    failed.push('G5_location');
    evidence.G5_location = `tail="${tail}" is US-based but not Remote-US or Boulder/Denver/Colorado`;
  }

  const maxStatedSalary = extractMaxStatedSalary(input.compRange ?? jobDescription);
  if (maxStatedSalary !== null && maxStatedSalary < 230_000) {
    failed.push('G6_comp_floor');
    evidence.G6_comp_floor = `stated maximum base salary $${maxStatedSalary.toLocaleString()} is below $230,000`;
  }

  return { failed, evidence, normalized, head, tail, geo, maxStatedSalary };
}

// ---------------------------------------------------------------------------
// §3 — Stage B weighted signal table
// ---------------------------------------------------------------------------

function scoreLevel(title: string): number {
  // Bare "director" already catches every comma-qualified director form
  // ("Director, Engineering", "Director, Infrastructure") as a standalone
  // word match. VP/SVP needed the same comma+department alternative
  // G1_TITLE_PATTERN gained (ENG-1974) — without it, "VP, Infrastructure
  // Engineering" passed G1 as a management title but scored the 12-point
  // fallback tier here, contradicting its own gate result.
  if (
    /\b(director|sr\.? director|senior director|head of engineering|head of platform engineering|vp\s*(of\s*)?engineering|vice president,?\s*(of\s*)?engineering|(svp|vp),?\s*(of\s*)?(software|engineering|platform|infrastructure|data|ml|machine learning|security|developer|devops|site reliability|technical))\b/.test(
      title
    )
  ) {
    return 24;
  }
  if (/\b(senior engineering manager|sr\.?\s*manager,?\s*(software|engineering|platform|infrastructure)|group engineering manager|em ?2|m ?2)\b/.test(title)) {
    return 23;
  }
  if (/\b(engineering manager|manager,?\s*software engineering)\b/.test(title)) {
    return 21;
  }
  return 12; // management signal present only via body fallback (G1 already confirmed it)
}

function scopeBasePts(jd: string): { pts: number; flag?: 'span_unquantified' } {
  const explicit = jd.match(/\b(\d{1,3})\+?\s*(?:engineers|people)\b|\borg of\s*(\d{1,3})\b/);
  if (explicit) {
    const count = Number(explicit[1] ?? explicit[2]);
    return { pts: count >= 6 ? 10 : 5 };
  }
  if (/\bsmall team\b|\bfirst em hire\b|\bfirst engineering manager hire\b/.test(jd)) return { pts: 5 };
  return { pts: 10, flag: 'span_unquantified' };
}

function scopeBonusPts(jd: string): number {
  let bonus = 0;
  if (/\bmanag\w+ (engineering )?managers\b|\bleaders? of leaders\b|\bmanagers report to\b|\bsecond[- ]line\b|\blead(ing)? engineering managers\b/.test(jd)) bonus += 3;
  if (/\bmultiple teams\b|\b\d+ teams\b|\bthe organi[sz]ation\b|\bacross teams\b|\ba group of teams\b|\bsub-?teams\b/.test(jd) || /\b(?:2[5-9]|[3-9]\d|\d{3,})\+?\s*(?:engineers|people)\b|\borg of\s*(?:2[5-9]|[3-9]\d|\d{3,})\b/.test(jd)) bonus += 3;
  return bonus;
}

function scoreScope(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  return Math.min(16, scopeBasePts(jd).pts + scopeBonusPts(jd));
}

const STRATEGY_FAMILIES: RegExp[] = [
  /\bstrateg\w+\b.{0,40}\b(?:initiatives?|direction|priorit\w*|goals?)\b|\blong-?term goals?\b|\bset .{0,15}\bvision\b|\btechnical strategy\b|\btechnical vision\b|\blong-term architecture\b|\bwhere we invest\b/,
  /\bproject plans?\b|\broadmap\b|\bprioriti[sz]\w*\b|\bplanning cycles?\b|\bquarterly planning\b|\bcapacity planning\b|\btradeoffs\b/,
  /\bcollaborat\w*\s+with\b.{0,40}\b(?:teams?|research|hardware|software|product|design|science)\b|\bcross-functional\b|\bpartner with\b|\bdata science\b|\bgo-to-market\b|\bpeer leaders\b|\bstakeholders\b/,
  /\borg design\b|\boperating model\b|\bteam topology\b|\brestructur\w*\b|\bscale the org\b|\bdefine how the team works\b/,
];

function scoreStrategy(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  const hits = STRATEGY_FAMILIES.filter((f) => f.test(jd)).length;
  let outcomes = 0;
  if (IMPACT_CUSTOMER.test(jd)) outcomes += 5;
  if (IMPACT_METRICS.test(jd)) outcomes += 5;
  return Math.min(22, hits * 3 + outcomes);
}

// "adoption" alone is a customer/business-outcome signal (§3.4 sub-signal 1);
// "adoption rate" is a named metric (sub-signal 2). The negative lookahead
// keeps the two mutually exclusive on the same token instead of double
// counting one mention across both sub-signals.
const IMPACT_CUSTOMER = /\bcustomers\b|\brevenue\b|\bbusiness impact\b|\bp&l\b|\benterprise customers\b|\badoption\b(?!\s*rate)/;
const IMPACT_METRICS = /\blatency\b|\breliability\b|\buptime\b|\bdora\b|\bdeveloper velocity\b|\badoption rate\b|\bsla\b|\bthroughput\b|\bbenchmark\w*\b|\bperformance\s+(?:optimi\w+|regression|target|benchmark|tuning|profiling)\b|\b(?:optimi\w+|improv\w+|reduc\w+|increas\w+)\s+(?:\w+\s+){0,2}performance\b/;
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

export function scoreComp(max: number | null): number {
  if (max === null) return 7; // silence ties the lowest passing disclosed tier
  if (max >= 350_000) return 12;
  if (max >= 300_000) return 11;
  if (max >= 260_000) return 9;
  if (max >= 230_000) return 7;
  return 2;
}

// Sourced from career-intelligence/SKILL.md Operation Ascent targets — kept
// as a literal duplicate for now (importing across the fleet/repo boundary
// isn't wired here); a drift check belongs on the ENG-1565 follow-up, not
// this PR.
const ASCENT_TARGETS = ['anthropic', 'netflix', 'nvidia', 'airbnb', 'vercel', 'sprout social'];
const FRONTIER_TIER = ['openai', 'stripe', 'databricks', 'figma'];

type CompanyRemotePosture = 'remote-ok' | 'hub-flex' | 'office-first' | 'unknown';

interface CompanyRemotePostureRecord {
  posture: Exclude<CompanyRemotePosture, 'unknown'>;
  source: string;
  checkedOn: string;
}

// Evidence-backed company posture is deliberately distinct from a posting's
// location tag: some companies under-tag negotiable remote work in their JDs.
const COMPANY_REMOTE_POSTURE: Record<string, CompanyRemotePostureRecord> = {
  nvidia: { posture: 'remote-ok', source: 'No RTO mandate; manager/team location discretion', checkedOn: '2026-08-19' },
  airbnb: { posture: 'remote-ok', source: 'Company remote-work policy', checkedOn: '2026-08-19' },
  'sprout social': { posture: 'remote-ok', source: 'Company remote-work policy', checkedOn: '2026-08-19' },
  vercel: { posture: 'hub-flex', source: 'Hub-flex work model', checkedOn: '2026-08-19' },
  anthropic: { posture: 'office-first', source: 'Office-first work model', checkedOn: '2026-08-19' },
  netflix: { posture: 'office-first', source: 'Office-first work model', checkedOn: '2026-08-19' },
};

const POSTURE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function resolveCompanyRemotePosture(company: string): CompanyRemotePosture {
  const c = company.toLowerCase();
  const entry = Object.entries(COMPANY_REMOTE_POSTURE).find(([name]) => c.includes(name))?.[1];
  if (!entry) return 'unknown';

  const checkedOn = Date.parse(`${entry.checkedOn}T00:00:00.000Z`);
  if (!Number.isFinite(checkedOn) || Date.now() - checkedOn > POSTURE_MAX_AGE_MS) return 'unknown';
  return entry.posture;
}

function scoreCompany(company: string): number {
  const c = company.toLowerCase();
  if (ASCENT_TARGETS.some((t) => c.includes(t))) return 10;
  if (FRONTIER_TIER.some((t) => c.includes(t))) return 9;
  return 7; // conservative default for an unclassified public/large company
}

function scoreLocation(
  geo: GeoVerdict,
  jobDescription: string,
  companyRemotePosture: CompanyRemotePosture
): { pts: number; unknown: boolean } {
  if (companyRemotePosture === 'remote-ok') return { pts: 8, unknown: false };
  if (companyRemotePosture === 'hub-flex') return { pts: 6, unknown: false };

  const jd = jobDescription.toLowerCase();
  if (geo === 'unknown') return { pts: 4, unknown: true };
  // geo === 'us' at this point (non_us already gated out before signals run)
  if (/\bboulder\b|\bcolorado\b|\bdenver\b/.test(jd) || (/\bremote\b/.test(jd) && /\bus\b|\bunited states\b/.test(jd) && /\bremote[- ]eligible\b/.test(jd))) {
    return { pts: 8, unknown: false };
  }
  if (/\bhybrid\b/.test(jd) && /\bremote[- ]eligible\b|\bremote friendly\b/.test(jd)) {
    return { pts: 6, unknown: false };
  }
  if (/\bhybrid\b|\bin-office\b/.test(jd)) return { pts: 4, unknown: false };
  return { pts: 6, unknown: false };
}

const DOMAIN_CATEGORIES: Array<{ pts: number; pattern: RegExp }> = [
  { pts: 8, pattern: /\bdeveloper experience\b|\bdeveloper productivity\b|\bplatform\b|\binternal tooling\b|\binfrastructure\b|\bdevex\b|\bdx\b|\bdeveloper velocity\b|\btooling\b/ },
  { pts: 8, pattern: /\bapplied ai\b|\bmachine learning\b|\bml systems\b|\bagents?\b|\bartificial intelligence\b/ },
  { pts: 6, pattern: /\bpayments\b|\bfintech\b|\bregulated financial\b/ },
  { pts: 5, pattern: /\benterprise\b.*\bsaas\b|\bb2b\b/ },
  { pts: 4, pattern: /\bconsumer product\b/ },
];

function scoreDomain(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  let best = 2; // unrelated vertical, default floor
  for (const c of DOMAIN_CATEGORIES) {
    if (c.pattern.test(jd) && c.pts > best) best = c.pts;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function evaluateRoleFit(input: RoleFitInput, company: string): RoleFitResult {
  const companyRemotePosture = resolveCompanyRemotePosture(company);
  const gates = evaluateGates(input, companyRemotePosture);

  if (gates.failed.length > 0) {
    return {
      score: 0,
      gateFailed: gates.failed,
      gateEvidence: gates.evidence,
      breakdown: { level: 0, scope: 0, strategy: 0, comp: 0, company: 0, location: 0, domain: 0 },
      locationUnknown: false,
      remoteNegotiable: false,
    };
  }

  const jobDescription = input.jobDescription ?? '';
  const level = scoreLevel(gates.normalized);
  const scope = scoreScope(jobDescription);
  const strategy = scoreStrategy(jobDescription);
  const comp = scoreComp(gates.maxStatedSalary);
  const companyPts = scoreCompany(company);
  const { pts: location, unknown: locationUnknown } = scoreLocation(
    gates.geo,
    jobDescription,
    companyRemotePosture
  );
  const domain = scoreDomain(jobDescription);

  const breakdown: SignalBreakdown = { level, scope, strategy, comp, company: companyPts, location, domain };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    score: Math.min(100, score),
    gateFailed: [],
    gateEvidence: {},
    breakdown,
    locationUnknown,
    remoteNegotiable: companyRemotePosture === 'remote-ok' || companyRemotePosture === 'hub-flex',
  };
}
