/**
 * Role-Fit Scorer — hybrid knockout gates + weighted signal table.
 *
 * ENG-1564. Spec: clara/.tmp/reports/ats-scoring-spec-2026-08-18.md (Clara Nova,
 * OPS-397). Supersedes job-knockout.ts (the 2026-08-10 binary gate) and, for
 * /api/v1/score-job only, replaces calculateReadinessScore() as the source of
 * currentScore.total. Does NOT touch readiness-scorer.ts — that module stays
 * the /score-resume and /resume-generator scorer, a different question
 * ("does D's resume match this JD") from this one ("is this role in D's lane,
 * and how good a fit is it").
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
  | 'G4_geography';

export interface SignalBreakdown {
  level: number;
  scope: number;
  strategy: number;
  impact: number;
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

const G1_TITLE_PATTERN =
  /\b(engineering manager|senior engineering manager|sr\.?\s*engineering manager|group engineering manager|engineering director|director of engineering|manager,?\s*(software|engineering|platform|infrastructure|data|ml|machine learning|security|developer|devops|site reliability|technical)|head of\s*(engineering|software|platform|infrastructure|technology|developer)|vp\s*(of\s*)?engineering|vice president,?\s*(of\s*)?engineering|tech(nical)? lead manager|engineering lead|head of technical)\b/;

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
];

function countMatches(haystack: string, needles: string[]): number {
  return needles.filter((n) => haystack.includes(n)).length;
}

function g1Passes(head: string, jobDescription: string): boolean {
  if (G1_TITLE_PATTERN.test(head)) return true;
  const body = jobDescription.toLowerCase();
  return countMatches(body, G1_BODY_SIGNALS) >= 2;
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
    // token AND the body clears the G1 body fallback (>=2 signals).
    const hasG1Title = G1_TITLE_PATTERN.test(head);
    const bodySignals = countMatches(jobDescription.toLowerCase(), G1_BODY_SIGNALS);
    if (!(hasG1Title && bodySignals >= 2)) return true;
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
  'mountain view', 'sunnyvale', 'palo alto', 'san diego', 'atlanta',
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
  head: string;
  tail: string;
  geo: GeoVerdict;
}

function evaluateGates(input: RoleFitInput): GateResult {
  const normalized = normalizeTitle(input.title ?? '');
  const { head, tail } = splitHeadTail(normalized);
  const jobDescription = input.jobDescription ?? '';

  const failed: GateFailedReason[] = [];
  const evidence: Record<string, string> = {};

  const hasG1TitleMatch = G1_TITLE_PATTERN.test(head);
  const g1Ok = g1Passes(head, jobDescription);
  if (!g1Ok) {
    failed.push('G1_no_mgmt_signal');
    evidence.G1_no_mgmt_signal = `no management-title match in head="${head}" and body fallback signals < 2`;
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

  return { failed, evidence, head, tail, geo };
}

// ---------------------------------------------------------------------------
// §3 — Stage B weighted signal table
// ---------------------------------------------------------------------------

function scoreLevel(head: string): number {
  if (/\b(director|sr\.? director|senior director|head of engineering|head of platform engineering)\b/.test(head)) {
    return 24;
  }
  if (/\b(senior engineering manager|sr\.?\s*manager,?\s*(software|engineering|platform|infrastructure)|group engineering manager|em ?2|m ?2)\b/.test(head)) {
    return 23;
  }
  if (/\b(engineering manager|manager,?\s*software engineering)\b/.test(head)) {
    return 21;
  }
  if (/\bvp\s*(of\s*)?engineering|vice president,?\s*(of\s*)?engineering\b/.test(head)) {
    return 16;
  }
  return 12; // management signal present only via body fallback (G1 already confirmed it)
}

const SCOPE_SIGNALS: Array<{ pts: number; pattern: RegExp }> = [
  { pts: 7, pattern: /\bmanag\w+ (engineering )?managers\b|\bleaders? of leaders\b|\bmanagers report to\b|\bsecond[- ]line\b|\blead(ing)? engineering managers\b/ },
  { pts: 5, pattern: /\bmultiple teams\b|\b\d+ teams\b|\bthe organi[sz]ation\b|\bacross teams\b|\ba group of teams\b|\bsub-?teams\b/ },
  { pts: 3, pattern: /\bown the roadmap for\b|\bcharter\b|\bown the .+ domain\b/ },
  { pts: 2, pattern: /\bhiring plan\b|\bheadcount planning\b|\bgrow the team\b|\bbuild out the team\b|\bbudget\b/ },
  { pts: 2, pattern: /\bperformance\b|\bcareer growth\b|\bcareer development\b|\bdevelop engineers\b|\bmentor\b/ },
];

// Headcount tiers scored separately (mutually exclusive, take best match).
function scopeHeadcountPts(jd: string): number {
  const explicit = jd.match(/\b(\d{1,3})\+?\s*(engineers|people)\b|\borg of\s*(\d{1,3})\b/);
  if (explicit) {
    const n = Number(explicit[1] ?? explicit[3]);
    if (n >= 25) return 5;
    if (n >= 10) return 4;
    return 2;
  }
  if (/\ba team of engineers\b|\bteam of engineers\b/.test(jd)) return 2;
  return 0;
}

function scoreScope(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  let total = 0;
  for (const s of SCOPE_SIGNALS) {
    if (s.pattern.test(jd)) total += s.pts;
  }
  total += scopeHeadcountPts(jd);
  return Math.min(16, total);
}

const STRATEGY_FAMILIES: RegExp[] = [
  /\btechnical strategy\b|\btechnical vision\b|\bset direction\b|\blong-term architecture\b|\bwhere we invest\b/,
  /\bown the roadmap\b|\bprioriti[sz]ation\b|\bplanning cycles\b|\bquarterly planning\b|\btradeoffs\b/,
  /\bpartner with product\b|\bpartner with design\b|\bdata science\b|\bgo-to-market\b|\bpeer leaders\b|\bstakeholders\b/,
  /\borg design\b|\boperating model\b|\bteam topology\b|\brestructur\w*\b|\bscale the org\b|\bdefine how the team works\b/,
];

function scoreStrategy(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  const hits = STRATEGY_FAMILIES.filter((f) => f.test(jd)).length;
  return Math.min(12, hits * 3);
}

// "adoption" alone is a customer/business-outcome signal (§3.4 sub-signal 1);
// "adoption rate" is a named metric (sub-signal 2). The negative lookahead
// keeps the two mutually exclusive on the same token instead of double
// counting one mention across both sub-signals.
const IMPACT_CUSTOMER = /\bcustomers\b|\brevenue\b|\bbusiness impact\b|\bp&l\b|\benterprise customers\b|\badoption\b(?!\s*rate)/;
const IMPACT_METRICS = /\blatency\b|\breliability\b|\buptime\b|\bdora\b|\bdeveloper velocity\b|\badoption rate\b|\bsla\b/;
const OUTCOME_VERB_PATTERN = /\b(own|drive|deliver|improve|scale|decide|influence)(s|d|ing)?\b/g;
const TOOL_NOUN_PATTERN = /\b(kafka|kubernetes|k8s|spark|terraform|docker|react|aws|postgres|kinesis)\b/g;
const IMPACT_SCALE = /\b0->1\b|\b0-to-1\b|\bambiguous\b|\bhyper-growth\b|\binflection point\b|\bgreenfield\b/;

function scoreImpact(jobDescription: string): number {
  const jd = jobDescription.toLowerCase();
  let total = 0;
  if (IMPACT_CUSTOMER.test(jd)) total += 3;
  if (IMPACT_METRICS.test(jd)) total += 3;
  const verbCount = jd.match(OUTCOME_VERB_PATTERN)?.length ?? 0;
  const nounCount = jd.match(TOOL_NOUN_PATTERN)?.length ?? 0;
  if (verbCount > nounCount) total += 2;
  if (IMPACT_SCALE.test(jd)) total += 2;
  return Math.min(10, total);
}

const SALARY_RANGE = /\$\s?(\d{1,3}(?:,\d{3})*)(k)?\s*(?:-|–|—|to)\s*\$?\s?(\d{1,3}(?:,\d{3})*)(k)?/gi;
const SALARY_SINGLE = /\$\s?(\d{2,3}(?:,\d{3})?)(k)?/gi;

function parseAmount(digits: string, hasK: boolean): number | null {
  const numeric = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  if (hasK) return numeric * 1000;
  if (numeric >= 1000) return numeric;
  return null;
}

function extractMaxStatedSalary(text: string): number | null {
  const values: number[] = [];
  for (const [, sd, sk, ed, ek] of text.matchAll(SALARY_RANGE)) {
    const startHasK = Boolean(sk);
    const endRaw = Number(ed.replace(/,/g, ''));
    const endHasK = Boolean(ek) || (startHasK && endRaw < 1000);
    const s = parseAmount(sd, startHasK);
    const e = parseAmount(ed, endHasK);
    if (s !== null) values.push(s);
    if (e !== null) values.push(e);
  }
  for (const [, d, k] of text.matchAll(SALARY_SINGLE)) {
    const v = parseAmount(d, Boolean(k));
    if (v !== null) values.push(v);
  }
  return values.length ? Math.max(...values) : null;
}

function scoreComp(jobDescription: string, structuredCompRange?: string): number {
  const max = extractMaxStatedSalary(structuredCompRange ?? jobDescription);
  if (max === null) return 8; // neutral — absent band is never a knockout
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

function scoreCompany(company: string): number {
  const c = company.toLowerCase();
  if (ASCENT_TARGETS.some((t) => c.includes(t))) return 10;
  if (FRONTIER_TIER.some((t) => c.includes(t))) return 9;
  return 7; // conservative default for an unclassified public/large company
}

function scoreLocation(geo: GeoVerdict, jobDescription: string): { pts: number; unknown: boolean } {
  const jd = jobDescription.toLowerCase();
  if (geo === 'unknown') return { pts: 5, unknown: true };
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
  const gates = evaluateGates(input);

  if (gates.failed.length > 0) {
    return {
      score: 0,
      gateFailed: gates.failed,
      gateEvidence: gates.evidence,
      breakdown: { level: 0, scope: 0, strategy: 0, impact: 0, comp: 0, company: 0, location: 0, domain: 0 },
      locationUnknown: false,
    };
  }

  const jobDescription = input.jobDescription ?? '';
  const level = scoreLevel(gates.head);
  const scope = scoreScope(jobDescription);
  const strategy = scoreStrategy(jobDescription);
  const impact = scoreImpact(jobDescription);
  const comp = scoreComp(jobDescription, input.compRange);
  const companyPts = scoreCompany(company);
  const { pts: location, unknown: locationUnknown } = scoreLocation(gates.geo, jobDescription);
  const domain = scoreDomain(jobDescription);

  const breakdown: SignalBreakdown = { level, scope, strategy, impact, comp, company: companyPts, location, domain };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    score: Math.min(100, score),
    gateFailed: [],
    gateEvidence: {},
    breakdown,
    locationUnknown,
  };
}
