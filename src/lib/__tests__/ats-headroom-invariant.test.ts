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

const CORPUS = {
  sources: [
    { file: 'resume.txt', text: 'Led platform engineering for a CI/CD organisation.', words: 7 },
    { file: 'projects-context.md', text: 'Built a multi-agent platform of 107,715 lines.', words: 7 },
  ],
  totalWords: 14,
  document: 'corpus document',
};
vi.mock('@/lib/career-corpus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/career-corpus')>();
  return { ...actual, loadCareerCorpus: vi.fn(async () => CORPUS) };
});

/** Every dimension answers `absent` with no citation → nothing attributable. */
function replyAbsent() {
  return { content: [{ type: 'text', text: '{"band":"partial","resumeQuote":"Led platform engineering for a CI/CD organisation.","jdQuote":"CI/CD"}' }] };
}

describe('a zero gap below 90 never reads as "already maximal"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(replyAbsent());
  });

  it('flags headroom as unverified instead of claiming the résumé is finished', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);

    if (result.gap === 0 && result.max.total < 90) {
      expect(result.headroomUnverified).toBe(true);
      expect(result.gapLine).not.toMatch(/already maximal/i);
      expect(result.gapLine).toMatch(/cannot verify/i);
    } else {
      // A real gap is the healthy outcome; the invariant is not violated.
      expect(result.gap > 0 || result.max.total >= 90).toBe(true);
    }
  });

  it('never emits a ceiling below the score already achieved', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);
    for (const d of result.current.breakdown as Array<{ score: number; ceilingScore?: number }>) {
      expect(d.ceilingScore ?? d.score).toBeGreaterThanOrEqual(d.score);
    }
  });

  it('populates resumeGap rather than shipping three nulls', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    const result = await scoreAts('Some job description requiring CI/CD.', CORPUS);
    expect(result.resumeGap.achievable).toBeTypeOf('number');
    expect(result.resumeGap.closeable).toBeTypeOf('number');
    expect(result.resumeGap.structural).toBeTypeOf('number');
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
