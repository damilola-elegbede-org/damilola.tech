/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetchBlob = vi.fn();
vi.mock('@/lib/blob', () => ({
  fetchBlob: (...args: unknown[]) => mockFetchBlob(...args),
}));

// fs/promises is a real ESM namespace and cannot be spied on, so the local
// fallback is mocked at the module boundary instead.
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  default: { readFile: (...a: unknown[]) => mockReadFile(...a) },
  readFile: (...a: unknown[]) => mockReadFile(...a),
}));

import {
  loadCareerCorpus,
  buildCorpusDocument,
  attributeCitation,
  CareerCorpusUnavailableError,
  CAREER_CORPUS_FILES,
  RESUME_SOURCE_LABEL,
} from '@/lib/career-corpus';

const RESUME = 'Damilola Elegbede. Sr. Engineering Manager, Developer Experience at Visa.';

const SOURCES = [
  { file: 'anecdotes.md', text: 'Rebuilt the release train across four teams.', words: 7 },
  { file: 'star-stories.json', text: '{"situation":"Build times had reached forty minutes."}', words: 5 },
];

describe('attributeCitation', () => {
  it('names the file a verbatim quote came from', () => {
    expect(attributeCitation('Rebuilt the release train across four teams.', SOURCES))
      .toBe('anecdotes.md');
  });

  it('tolerates re-wrapped whitespace, which models reliably introduce', () => {
    expect(attributeCitation('Rebuilt the release   train\nacross four teams.', SOURCES))
      .toBe('anecdotes.md');
  });

  it('returns null for text that is in no file', () => {
    expect(attributeCitation('Ran a 400-person org at Google', SOURCES)).toBeNull();
  });

  it('rejects a quote too short to be evidence of anything', () => {
    expect(attributeCitation('Rebuilt', SOURCES)).toBeNull();
  });
});

describe('buildCorpusDocument', () => {
  it('delimits every source so a citation can be attributed back', () => {
    const doc = buildCorpusDocument(SOURCES);
    for (const s of SOURCES) {
      expect(doc).toContain(`<<<source: ${s.file}>>>`);
      expect(doc).toContain(`<<<end: ${s.file}>>>`);
      expect(doc).toContain(s.text);
    }
  });
});

describe('loadCareerCorpus', () => {
  beforeEach(() => {
    // mockReset, not mockClear: these are module-factory fns shared across
    // tests, and a leftover implementation silently changes what the next test
    // measures.
    mockFetchBlob.mockReset();
    mockReadFile.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("loads every file D named, plus the résumé — Fit reads ALL career data", async () => {
    mockFetchBlob.mockImplementation((f: string) => Promise.resolve(`content of ${f} with enough words`));
    mockReadFile.mockImplementation(() => Promise.reject(new Error('ENOENT')));
    const corpus = await loadCareerCorpus(RESUME);
    expect(corpus.sources.map((s) => s.file)).toEqual([
      RESUME_SOURCE_LABEL,
      ...CAREER_CORPUS_FILES.map((f) => f.file),
    ]);
    expect(corpus.document).toContain(RESUME);
    expect(corpus.totalWords).toBeGreaterThan(0);
  });

  it('treats an empty résumé as a missing source, not a smaller corpus', async () => {
    mockFetchBlob.mockImplementation((f: string) => Promise.resolve(`content of ${f} with enough words`));
    mockReadFile.mockImplementation(() => Promise.reject(new Error('ENOENT')));
    await expect(loadCareerCorpus('   ')).rejects.toThrow(/resume\.txt/);
  });

  it('throws rather than falling back to the resume when a file is missing — A3', async () => {
    // Blob empty for one file, and the local read will not resolve it either
    // (cwd in test is the repo root, where career-data/ is a submodule path we
    // deliberately do not depend on here).
    mockFetchBlob.mockImplementation((f: string) =>
      Promise.resolve(f === 'verily-feedback.md' ? '' : `content of ${f} with enough words`)
    );
    mockReadFile.mockImplementation(() => Promise.reject(new Error('ENOENT')));

    await expect(loadCareerCorpus(RESUME)).rejects.toBeInstanceOf(CareerCorpusUnavailableError);
  });

  it('names what was missing, so the failure is diagnosable', async () => {
    mockFetchBlob.mockImplementation(() => Promise.resolve(''));
    mockReadFile.mockImplementation(() => Promise.reject(new Error('ENOENT')));
    await expect(loadCareerCorpus(RESUME)).rejects.toThrow(/anecdotes\.md/);
  });

  it('falls back to local career-data when blob is empty, for development', async () => {
    mockFetchBlob.mockImplementation(() => Promise.resolve(''));
    mockReadFile.mockImplementation(() => Promise.resolve('local corpus content with several words in it'));
    const corpus = await loadCareerCorpus(RESUME);
    expect(corpus.sources).toHaveLength(CAREER_CORPUS_FILES.length + 1);
  });
});

describe('attribution survives a faithful quote (ENG-2010)', () => {
  // The corpus is markdown and JSON. A model reads through the syntax and
  // quotes clean prose, so requiring a raw-byte substring rejected quotes that
  // were entirely faithful — and the rejection was indistinguishable from "the
  // corpus holds nothing more", which is what rendered as "Already maximal".
  const MARKDOWN = [
    '## Agentic AI platform',
    '',
    'Built a **multi-agent platform** — 107,715 lines, 12 agents, 17 skills.',
    '',
    '| Workflow | LOC |',
    '| --- | --- |',
    '| Pipedream Automation Suite | ~8,620 Python |',
  ].join('\n');
  const JSONISH = '{"situation":"Led the release train across four teams.\\nCut build times."}';
  const SOURCES = [
    { file: 'projects-context.md', text: MARKDOWN, words: 20 },
    { file: 'star-stories.json', text: JSONISH, words: 10 },
  ];

  it('attributes a quote whose markdown emphasis the model dropped', () => {
    expect(
      attributeCitation('Built a multi-agent platform — 107,715 lines, 12 agents, 17 skills.', SOURCES)
    ).toBe('projects-context.md');
  });

  it('attributes a quote lifted out of a markdown table row', () => {
    expect(attributeCitation('Pipedream Automation Suite ~8,620 Python', SOURCES))
      .toBe('projects-context.md');
  });

  it('attributes a quote across a JSON-escaped newline', () => {
    expect(attributeCitation('Led the release train across four teams. Cut build times.', SOURCES))
      .toBe('star-stories.json');
  });

  it('still refuses a quote the corpus does not support', () => {
    // The widening must not become a licence to infer.
    expect(attributeCitation('Ran a 400-person organisation at Google Cloud', SOURCES)).toBeNull();
  });

  it('still refuses a quote that only half-overlaps a real source', () => {
    expect(
      attributeCitation('Built a multi-agent platform for autonomous trading and risk hedging', SOURCES)
    ).toBeNull();
  });
});

describe('attribution paths', () => {
  // Attribution has a strict path (normalised substring) and a fallback (token
  // overlap). The strict path is a FAST PATH only — every quote it accepts, the
  // fallback also accepts at ratio 1.0 — so it cannot be isolated by a test and
  // is not claimed as a separate guard. The fallback IS load-bearing, and the
  // reordered case below is what proves it.
  const SRC = [{
    file: 'projects-context.md',
    text: '## Platform\n\nBuilt a **multi-agent platform** — 107,715 lines across 12 agents.',
    words: 12,
  }];

  it('attributes an in-order quote whose markdown the model dropped', () => {
    const { text } = SRC[0];
    expect(text).toContain('**multi-agent platform**');
    expect(attributeCitation('Built a multi-agent platform — 107,715 lines across 12 agents.', SRC))
      .toBe('projects-context.md');
  });

  it('fallback: a reordered quote is no substring, and still attributes', () => {
    // Same vocabulary, different order — no normalisation makes this a
    // substring, so only the overlap fallback can attribute it.
    expect(attributeCitation('Across 12 agents, built a multi-agent platform of 107,715 lines.', SRC))
      .toBe('projects-context.md');
  });

  it('fallback refuses a reordered quote that adds unsupported vocabulary', () => {
    expect(attributeCitation('Across 12 agents, built a multi-agent trading platform for hedge funds.', SRC))
      .toBeNull();
  });
});

describe('overlap counts multiplicity, not membership', () => {
  const SRC = [{ file: 'projects-context.md', text: 'Built a multi-agent platform for internal teams.', words: 7 }];

  it('refuses a quote that reuses one supported word to cover itself', () => {
    // A Set membership test scored this 1.0: "platform" appears once in the
    // source, and every token of the quote claimed that single occurrence.
    expect(attributeCitation('platform platform platform platform platform platform', SRC))
      .toBeNull();
  });

  it('still attributes a genuine quote with a legitimately repeated word', () => {
    expect(attributeCitation('Built a multi-agent platform for internal teams.', SRC))
      .toBe('projects-context.md');
  });
});
