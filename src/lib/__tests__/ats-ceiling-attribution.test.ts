import { describe, expect, it, vi } from 'vitest';

/**
 * A résumé-only citation must not raise the ATS (Max) ceiling — the ceiling
 * exists to answer "what could the résumé truthfully say if rewritten using
 * career-corpus evidence", so support that merely repeats the current résumé
 * proves nothing beyond what `current` already scored.
 */
describe('scoreAts() ceiling attribution excludes the résumé source', () => {
  const CORPUS_ONLY_TEXT = 'Led the platform migration across four regional data centers.';
  const RESUME_ONLY_TEXT = 'Owned the roadmap for the developer platform team.';

  function mockCareerCorpus() {
    vi.doMock('@/lib/career-corpus', () => ({
      loadCareerCorpus: vi.fn().mockResolvedValue({
        sources: [
          { file: 'resume.txt', text: RESUME_ONLY_TEXT, words: 8 },
          { file: 'technical-expertise.md', text: CORPUS_ONLY_TEXT, words: 9 },
        ],
        totalWords: 17,
        document: `<<<source: resume.txt>>>\n${RESUME_ONLY_TEXT}\n<<<end>>>\n<<<source: technical-expertise.md>>>\n${CORPUS_ONLY_TEXT}\n<<<end>>>`,
      }),
      buildCorpusDocument: (sources: Array<{ file: string; text: string }>) =>
        sources.map((s) => `<<<source: ${s.file}>>>\n${s.text}\n<<<end: ${s.file}>>>`).join('\n\n'),
      attributeCitation: (quote: string | null, sources: Array<{ file: string; text: string }>) => {
        if (!quote) return null;
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const q = norm(quote);
        if (q.length < 12) return null;
        return sources.find((s) => norm(s.text).includes(q))?.file ?? null;
      },
      RESUME_SOURCE_LABEL: 'resume.txt',
      CareerCorpusUnavailableError: class extends Error {},
    }));
  }

  function mockAnthropic(quoteForCorpusPass: string) {
    const mockCreate = vi.fn().mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const prompt = messages[0].content;
      // The corpus-scoring pass builds its call from `careerCorpus.document`,
      // distinguishable from the résumé-only pass by either marker text being
      // present in the embedded evidence block.
      const isCorpusPass = prompt.includes(CORPUS_ONLY_TEXT) || prompt.includes(RESUME_ONLY_TEXT);
      const resumeQuote = isCorpusPass ? quoteForCorpusPass : RESUME_ONLY_TEXT;
      return {
        content: [{ type: 'text', text: JSON.stringify({ band: 'strong', resumeQuote, jdQuote: 'relevant experience' }) }],
      };
    });
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class MockAnthropic {
        messages = { create: mockCreate };
      },
    }));
  }

  it('scores the ceiling from real corpus evidence, not a résumé-only citation', async () => {
    vi.resetModules();
    mockAnthropic(CORPUS_ONLY_TEXT);
    mockCareerCorpus();
    const { scoreAts } = await import('@/lib/score-core');
    const withCorpusEvidence = await scoreAts('Job description requiring relevant experience.');

    // Real corpus evidence may raise the ceiling above current.
    expect(withCorpusEvidence.max.total).toBeGreaterThanOrEqual(withCorpusEvidence.current.total);

    vi.resetModules();
    mockAnthropic(RESUME_ONLY_TEXT);
    mockCareerCorpus();
    const { scoreAts: scoreAtsResumeOnly, AtsHeadroomUnverifiedError } =
      await import('@/lib/score-core');

    // A citation landing only in resume.txt still must not raise the ceiling —
    // but ENG-2010 changed what that outcome IS. It used to return
    // max === current and read as "already maximal"; below 90 that is now a
    // defect signal and throws, because it is indistinguishable from a ceiling
    // lookup that simply failed.
    await expect(scoreAtsResumeOnly('Job description requiring relevant experience.'))
      .rejects.toBeInstanceOf(AtsHeadroomUnverifiedError);
  });
});
