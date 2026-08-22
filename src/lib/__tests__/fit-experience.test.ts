/**
 * @vitest-environment node
 *
 * score-core constructs the Anthropic client at module load, and the SDK refuses
 * to initialise in a browser-like environment. The runner is server-only code.
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreExperienceDimensions, seedFor, FIT_EXPERIENCE_MODEL } from '@/lib/fit-experience';
import { FIT_EXPERIENCE_DIMENSIONS } from '@/lib/fit-score';
import { buildCorpusDocument, type CareerCorpus } from '@/lib/career-corpus';

const SOURCES = [
  { file: 'anecdotes.md', text: 'Led platform engineering for a distributed CI/CD organisation.', words: 8 },
  { file: 'technical-expertise.md', text: 'Deep experience with Jenkins, Kubernetes and Terraform.', words: 7 },
];
const CORPUS: CareerCorpus = {
  sources: SOURCES,
  totalWords: 15,
  document: buildCorpusDocument(SOURCES),
};
const JD = 'We need a leader for our platform engineering group. You will own CI/CD.';

type CreateArgs = {
  model: string;
  temperature: number;
  messages: Array<{ role: string; content: string }>;
};

function clientReturning(text: string) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  return { client: { messages: { create } }, create };
}

describe('scoreExperienceDimensions', () => {
  it('makes exactly one call per Fit-path dimension, at temperature 0', async () => {
    const { client, create } = clientReturning(
      '{"band":"strong","resumeQuote":"Led platform engineering","jdQuote":"platform engineering"}'
    );

    const results = await scoreExperienceDimensions(CORPUS, JD, { client });

    expect(create).toHaveBeenCalledTimes(FIT_EXPERIENCE_DIMENSIONS.length);
    expect(results.map((r) => r.dimension)).toEqual([...FIT_EXPERIENCE_DIMENSIONS]);
    for (const [args] of create.mock.calls as [CreateArgs][]) {
      expect(args.model).toBe(FIT_EXPERIENCE_MODEL);
      expect(args.temperature).toBe(0);
    }
  });

  it('never asks about scope_evidence — org size is out of the Fit path', async () => {
    const { client, create } = clientReturning('{"band":"absent","resumeQuote":null,"jdQuote":null}');
    await scoreExperienceDimensions(CORPUS, JD, { client });
    const prompts = (create.mock.calls as [CreateArgs][]).map(([a]) => a.messages[0].content);
    expect(prompts.some((p) => p.includes('leading an organisation of the size'))).toBe(false);
  });

  it('clamps a nonzero band whose citation is not in the corpus', async () => {
    const { client } = clientReturning(
      '{"band":"exemplary","resumeQuote":"Ran a 400-person org at Google","jdQuote":null}'
    );
    const results = await scoreExperienceDimensions(CORPUS, JD, { client });
    for (const r of results) {
      expect(r.score).toBe(0);
      expect(r.band).toBe('absent');
      expect(r.evidenceRejected).toBe(true);
    }
  });

  it('scores a dimension absent when its call throws, instead of failing the role', async () => {
    const create = vi.fn().mockRejectedValue(new Error('upstream 529'));
    const results = await scoreExperienceDimensions(CORPUS, JD, {
      client: { messages: { create } },
    });
    expect(results).toHaveLength(FIT_EXPERIENCE_DIMENSIONS.length);
    expect(results.every((r) => r.score === 0)).toBe(true);
  });

  it('seeds from the job description, so an unchanged posting re-scores identically', async () => {
    const { client: a, create: createA } = clientReturning(
      '{"band":"strong","resumeQuote":"Led platform engineering","jdQuote":null}'
    );
    const { client: b, create: createB } = clientReturning(
      '{"band":"strong","resumeQuote":"Led platform engineering","jdQuote":null}'
    );

    const first = await scoreExperienceDimensions(CORPUS, JD, { client: a });
    const second = await scoreExperienceDimensions(CORPUS, JD, { client: b });

    expect(first.map((r) => r.optionOrder)).toEqual(second.map((r) => r.optionOrder));
    const promptsA = (createA.mock.calls as [CreateArgs][]).map(([x]) => x.messages[0].content);
    const promptsB = (createB.mock.calls as [CreateArgs][]).map(([x]) => x.messages[0].content);
    expect(promptsA).toEqual(promptsB);
  });

  it('varies the seed with the job description, so option order is not a fixed constant', () => {
    expect(seedFor(JD)).not.toBe(seedFor(`${JD} Kubernetes required.`));
  });

  it('grades against the corpus, not the resume — A1', async () => {
    const { client, create } = clientReturning('{"band":"absent","resumeQuote":null,"jdQuote":null}');
    await scoreExperienceDimensions(CORPUS, JD, { client });
    const prompt = (create.mock.calls as [CreateArgs][])[0][0].messages[0].content;
    for (const s of SOURCES) {
      expect(prompt).toContain(`<<<source: ${s.file}>>>`);
      expect(prompt).toContain(s.text);
    }
  });

  it('names the corpus file each award came from — A2', async () => {
    const { client } = clientReturning(
      '{"band":"strong","resumeQuote":"Deep experience with Jenkins, Kubernetes and Terraform.","jdQuote":null}'
    );
    const results = await scoreExperienceDimensions(CORPUS, JD, { client });
    for (const r of results) {
      expect(r.sourceFile).toBe('technical-expertise.md');
      expect(r.score).toBe(3);
    }
  });

  it('clamps an award it cannot pin to a named file — A2', async () => {
    // A quote assembled across the delimiter: real-looking, in the document,
    // attributable to no single source.
    const straddling = `${SOURCES[0].text}\n<<<end: anecdotes.md>>>`;
    const { client } = clientReturning(
      JSON.stringify({ band: 'exemplary', resumeQuote: straddling, jdQuote: null })
    );
    const results = await scoreExperienceDimensions(CORPUS, JD, { client });
    for (const r of results) {
      expect(r.score).toBe(0);
      expect(r.evidenceRejected).toBe(true);
      expect(r.sourceFile).toBeNull();
    }
  });
});
