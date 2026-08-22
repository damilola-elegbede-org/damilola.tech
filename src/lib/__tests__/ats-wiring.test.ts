import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/career-corpus', () => ({
  loadCareerCorpus: vi.fn().mockResolvedValue({
    sources: [
      { file: 'resume.txt', text: 'resume evidence text', words: 3 },
      { file: 'technical-expertise.md', text: 'corpus evidence text', words: 3 },
    ],
    totalWords: 6,
    document: '<<<source: resume.txt>>>\nresume evidence text\n<<<end: resume.txt>>>\n<<<source: technical-expertise.md>>>\ncorpus evidence text\n<<<end: technical-expertise.md>>>',
  }),
  buildCorpusDocument: (sources: Array<{ file: string; text: string }>) =>
    sources.map((s) => `<<<source: ${s.file}>>>\n${s.text}\n<<<end: ${s.file}>>>`).join('\n\n'),
  attributeCitation: (quote: string | null, sources: Array<{ file: string }>) => (quote ? sources[0]?.file ?? null : null),
  RESUME_SOURCE_LABEL: 'resume.txt',
  CareerCorpusUnavailableError: class extends Error {},
}));

// Extracts a verbatim snippet from the prompt's own <resume> and
// <job_description> blocks so the citation-grounding check in
// resume-rubric's scoreDimension() passes for real, rather than stubbing it
// out — this exercises the actual rubric + anchoring path.
const mockCreate = vi.fn().mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
  const prompt = messages[0].content;
  const resumeMatch = /<resume>([\s\S]*?)<\/resume>/.exec(prompt);
  const jdMatch = /<job_description>([\s\S]*?)<\/job_description>/.exec(prompt);
  const source = (resumeMatch?.[1] ?? '').trim();
  const resumeQuote = source.slice(0, 40);
  const jdQuote = (jdMatch?.[1] ?? '').trim().slice(0, 40);
  // The ceiling pass is graded against the delimited corpus document, the
  // current pass against the résumé. Returning a higher band on the corpus pass
  // mirrors production — the corpus holds more than the one-page résumé — and
  // keeps this a WIRING test. Returning the same band on both would produce
  // gap 0 below 90, which ENG-2010's invariant now (correctly) throws on.
  const isCorpusPass = source.includes('<<<source:');
  return {
    content: [{ type: 'text', text: JSON.stringify({
      band: isCorpusPass ? 'exemplary' : 'partial', resumeQuote, jdQuote,
    }) }],
  };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe('ATS production wiring (ENG-1996 AC10)', () => {
  it('scoreAts() reaches the locked rubric and anchoring modules and returns a bounded score', async () => {
    const { scoreAts } = await import('@/lib/score-core');
    const result = await scoreAts('Job description requiring relevant experience.');

    // Five locked dimensions, each in range [0, 4] per RUBRIC_BANDS, so
    // current/max totals (score * 5) are bounded [0, 100] — this only holds
    // if the real rubric assembly ran, not a stub.
    expect(result.current.total).toBeGreaterThanOrEqual(0);
    expect(result.current.total).toBeLessThanOrEqual(100);
    expect(result.max.total).toBeGreaterThanOrEqual(result.current.total);
    expect(result.current.breakdown).toHaveLength(5);
    expect(result.gap).toBe(result.max.total - result.current.total);
    expect(typeof result.gapLine).toBe('string');
    expect(result.gapLine.length).toBeGreaterThan(0);
  });
});
