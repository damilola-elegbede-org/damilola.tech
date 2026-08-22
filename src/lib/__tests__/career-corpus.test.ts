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
