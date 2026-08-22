/**
 * @vitest-environment node
 *
 * score-core constructs the Anthropic client at module load, and the SDK refuses
 * to initialise in a browser-like environment. The runner is server-only code.
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreExperienceDimensions, seedFor, FIT_EXPERIENCE_MODEL } from '@/lib/fit-experience';
import { FIT_EXPERIENCE_DIMENSIONS } from '@/lib/fit-score';

const RESUME = 'Damilola Elegbede. Led platform engineering for a distributed CI/CD organisation.';
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

    const results = await scoreExperienceDimensions(RESUME, JD, { client });

    expect(create).toHaveBeenCalledTimes(FIT_EXPERIENCE_DIMENSIONS.length);
    expect(results.map((r) => r.dimension)).toEqual([...FIT_EXPERIENCE_DIMENSIONS]);
    for (const [args] of create.mock.calls as [CreateArgs][]) {
      expect(args.model).toBe(FIT_EXPERIENCE_MODEL);
      expect(args.temperature).toBe(0);
    }
  });

  it('never asks about scope_evidence — org size is out of the Fit path', async () => {
    const { client, create } = clientReturning('{"band":"absent","resumeQuote":null,"jdQuote":null}');
    await scoreExperienceDimensions(RESUME, JD, { client });
    const prompts = (create.mock.calls as [CreateArgs][]).map(([a]) => a.messages[0].content);
    expect(prompts.some((p) => p.includes('leading an organisation of the size'))).toBe(false);
  });

  it('clamps a nonzero band whose citation is not in the resume', async () => {
    const { client } = clientReturning(
      '{"band":"exemplary","resumeQuote":"Ran a 400-person org at Google","jdQuote":null}'
    );
    const results = await scoreExperienceDimensions(RESUME, JD, { client });
    for (const r of results) {
      expect(r.score).toBe(0);
      expect(r.band).toBe('absent');
      expect(r.evidenceRejected).toBe(true);
    }
  });

  it('scores a dimension absent when its call throws, instead of failing the role', async () => {
    const create = vi.fn().mockRejectedValue(new Error('upstream 529'));
    const results = await scoreExperienceDimensions(RESUME, JD, {
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

    const first = await scoreExperienceDimensions(RESUME, JD, { client: a });
    const second = await scoreExperienceDimensions(RESUME, JD, { client: b });

    expect(first.map((r) => r.optionOrder)).toEqual(second.map((r) => r.optionOrder));
    const promptsA = (createA.mock.calls as [CreateArgs][]).map(([x]) => x.messages[0].content);
    const promptsB = (createB.mock.calls as [CreateArgs][]).map(([x]) => x.messages[0].content);
    expect(promptsA).toEqual(promptsB);
  });

  it('varies the seed with the job description, so option order is not a fixed constant', () => {
    expect(seedFor(JD)).not.toBe(seedFor(`${JD} Kubernetes required.`));
  });
});
