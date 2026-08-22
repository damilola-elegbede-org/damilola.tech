/**
 * @vitest-environment node
 *
 * ENG-2010 AC4 — D's invariant, encoded: "We should always be able to improve
 * the ATS score unless it is already in the 90s."
 *
 * The endpoint returned ATS 55, Max 55, gap 0, zero proposed changes, and
 * reported that as success with the line "Already maximal". A zero gap below 90
 * is a defect signal, not a verdict.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: (...a: unknown[]) => mockCreate(...a) };
  },
}));

// This span is present verbatim in the generated résumé, so `current` scores on
// it; putting it in a corpus file too lets the ceiling attribute and rise.
const REAL_RESUME_SPAN =
  'Experience: Engineering Management, Team Leadership, Cross-functional Leadership';

const CORPUS = {
  sources: [
    { file: 'resume.txt', text: REAL_RESUME_SPAN, words: 9 },
    { file: 'projects-context.md', text: REAL_RESUME_SPAN, words: 9 },
  ],
  totalWords: 18,
  document: 'corpus document',
};
vi.mock('@/lib/career-corpus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/career-corpus')>();
  return { ...actual, loadCareerCorpus: vi.fn(async () => CORPUS) };
});

/** Every dimension answers `absent` with no citation → nothing attributable. */
function replyAbsent() {
  return { content: [{ type: 'text', text: JSON.stringify({
    band: 'partial', resumeQuote: REAL_RESUME_SPAN, jdQuote: 'CI/CD',
  }) }] };
}

describe('a zero gap below 90 never reads as "already maximal"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(replyAbsent());
  });

  it('3a — throws rather than serving "already maximal" below 90', async () => {
    const { scoreAts, AtsHeadroomUnverifiedError } = await import('@/lib/score-core');
    // Every dimension quotes the résumé only, so nothing attributes to the
    // corpus: the exact live shape that produced ATS 55 / Max 55 / gap 0.
    await expect(scoreAts('Some job description requiring CI/CD.', CORPUS))
      .rejects.toBeInstanceOf(AtsHeadroomUnverifiedError);
  });

  it('3b — a genuine ceiling at 90+ may report gap 0 and must NOT throw', async () => {
    // Without this, 3a could be "passed" by inflating max until nothing is ever
    // maximal. This is what keeps the assertion a detector, not a coercion.
    const { scoreAts } = await import('@/lib/score-core');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      band: 'exemplary',
      resumeQuote: REAL_RESUME_SPAN,
      jdQuote: 'CI/CD',
    }) }] });
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);
    expect(result.max.total).toBeGreaterThanOrEqual(90);
    expect(result.gap).toBe(0);
    expect(result.gapLine).toMatch(/already maximal/i);
  });

  it('4 — never emits a ceiling below the score already achieved', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      band: 'exemplary',
      resumeQuote: REAL_RESUME_SPAN,
      jdQuote: 'CI/CD',
    }) }] });
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);
    for (const d of result.current.breakdown as Array<{ score: number; ceilingScore?: number }>) {
      expect(d.ceilingScore ?? d.score).toBeGreaterThanOrEqual(d.score);
    }
  });

  it('5 — populates resumeGap rather than shipping three nulls', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      band: 'exemplary',
      resumeQuote: REAL_RESUME_SPAN,
      jdQuote: 'CI/CD',
    }) }] });
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);
    expect(result.resumeGap.achievable).toBeTypeOf('number');
    expect(result.resumeGap.closeable).toBeTypeOf('number');
    expect(result.resumeGap.structural).toBeTypeOf('number');
  });

  it('2 — a failed attribution is distinguishable from a real no-headroom verdict', async () => {
    const { scoreAts, AtsHeadroomUnverifiedError } = await import('@/lib/score-core');
    // Corpus with NO non-résumé sources: nothing can ever attribute.
    const resumeOnly = { ...CORPUS, sources: [CORPUS.sources[0]] };
    await expect(scoreAts('Some job description requiring CI/CD.', resumeOnly))
      .rejects.toBeInstanceOf(AtsHeadroomUnverifiedError);
    // The error names which dimensions could not be verified — the payload used
    // to be byte-identical to a genuine "nothing more to say".
    await scoreAts('Some job description requiring CI/CD.', resumeOnly).catch((e) => {
      expect(e.message).toMatch(/Unattributable corpus citations/);
    });
  });
});

describe('boundedCeiling (AC5)', () => {
  it('never returns a ceiling below the score already achieved', async () => {
    const { boundedCeiling } = await import('@/lib/score-core');
    // The exact shape observed live: score 3, corpus attribution failed → 0.
    expect(boundedCeiling(3, 0)).toBe(3);
    expect(boundedCeiling(2, 0)).toBe(2);
  });

  it('reports real corpus headroom when there is some', async () => {
    const { boundedCeiling } = await import('@/lib/score-core');
    expect(boundedCeiling(2, 4)).toBe(4);
  });

  it('never exceeds the rubric maximum', async () => {
    const { boundedCeiling } = await import('@/lib/score-core');
    expect(boundedCeiling(2, 99)).toBe(4);
  });

  it('falls back to the measured score when the corpus said nothing', async () => {
    const { boundedCeiling } = await import('@/lib/score-core');
    expect(boundedCeiling(3, undefined)).toBe(3);
  });
});
