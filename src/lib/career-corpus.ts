/**
 * The career-data corpus — what is TRUE about D's career, as distinct from what
 * his one-page résumé currently STATES (ENG-1995 A1-A3, ENG-1996 AC18).
 *
 * The three scores need different sources, and the distinction is the whole
 * point rather than an implementation detail:
 *
 *   Fit        Can I do this job?                  JD × ALL career data,
 *                                                  résumé INCLUDED
 *   ATS        What does my résumé say today?      résumé only, deliberately
 *   ATS (Max)  What lifts ATS, truthfully?         corpus bounds the ceiling
 *
 * Scoring Fit off the résumé measures how well a one-page document happens to
 * be written for this posting — a presentation artifact. A role dropped because
 * the one-pager omitted something D genuinely did is a false negative he never
 * sees, which is the worst failure this pipeline has.
 *
 * The résumé path saw 21 highlight bullets across 6 roles. This corpus is
 * ~14.3k words the scorer had never read.
 *
 * ## Why loading failure is loud
 *
 * A3: a silent fallback to the résumé produces exactly the false negatives this
 * module exists to prevent, and nothing in the output would reveal it — the
 * score would simply be lower, and plausible. Note the contrast with
 * `generate-cover-letter/route.ts`, which treats the same fetch as
 * "non-fatal" and leaves the context empty; that is right for prose generation
 * and wrong for a number a decision is made on.
 */

import { fetchBlob } from '@/lib/blob';

/**
 * The label a résumé citation carries. The résumé is generated from
 * `resumeData`, not read from a file, but it is part of the corpus Fit scores
 * against — D's ruling: "all of my career data (including the resume)". Naming
 * it here keeps `attributeCitation` able to say where a quote came from.
 */
export const RESUME_SOURCE_LABEL = 'resume.txt';

/** The six files D named. Blob keys are basenames; `dir` is the local dev path. */
export const CAREER_CORPUS_FILES: ReadonlyArray<{ dir: string; file: string }> = [
  { dir: 'context', file: 'anecdotes.md' },
  { dir: 'context', file: 'technical-expertise.md' },
  { dir: 'context', file: 'leadership-philosophy.md' },
  { dir: 'context', file: 'projects-context.md' },
  { dir: 'context', file: 'verily-feedback.md' },
  { dir: 'data', file: 'star-stories.json' },
] as const;

export class CareerCorpusUnavailableError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Career corpus unavailable — could not load: ${missing.join(', ')}. ` +
        'Refusing to score Fit against the resume alone: a quiet fallback here ' +
        'produces false negatives that nothing in the output would reveal.'
    );
    this.name = 'CareerCorpusUnavailableError';
  }
}

export interface CorpusSource {
  /** Basename, e.g. "anecdotes.md" — this is what a citation names. */
  file: string;
  text: string;
  words: number;
}

export interface CareerCorpus {
  sources: CorpusSource[];
  totalWords: number;
  /** Every source concatenated with file delimiters, for the model to read. */
  document: string;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * The dynamic imports are resolved ONCE, before the concurrent reads. Doing
 * `await import(...)` inside six parallel callbacks left five of them failing
 * inside the import itself, and the `.catch` around the read swallowed it — the
 * corpus then looked like five missing files rather than one broken import.
 */
async function localReader(): Promise<(dir: string, file: string) => Promise<string>> {
  const [fs, path] = await Promise.all([import('fs/promises'), import('path')]);
  return (dir, file) =>
    fs.readFile(
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'career-data', dir, file),
      'utf-8'
    );
}

/**
 * Blob first (production), local `career-data/` second (development). Same order
 * the cover-letter route uses — the corpus ships to Blob under
 * `career-data/context` and `career-data/data`, both in CONTENT_DIRS.
 *
 * `resumeText` is a required parameter rather than an internal call to
 * `buildResumeText()`: it keeps this module free of the scoring client that
 * `score-core` instantiates at import time, and a required argument cannot be
 * forgotten the way an optional one can.
 *
 * Throws `CareerCorpusUnavailableError` when any file resolves empty from both.
 */
export async function loadCareerCorpus(resumeText: string): Promise<CareerCorpus> {
  const readLocal = await localReader().catch(() => null);

  const loaded = await Promise.all(
    CAREER_CORPUS_FILES.map(async ({ dir, file }) => {
      const fromBlob = await fetchBlob(file).catch(() => '');
      if (fromBlob.trim()) return { file, text: fromBlob };
      if (!readLocal) return { file, text: '' };
      const fromDisk = await readLocal(dir, file).catch(() => '');
      return { file, text: fromDisk };
    })
  );

  const missing = loaded.filter((s) => !s.text.trim()).map((s) => s.file);
  if (!resumeText.trim()) missing.push(RESUME_SOURCE_LABEL);
  if (missing.length > 0) throw new CareerCorpusUnavailableError(missing);

  // Résumé first: it is the most specific statement of the career, and a model
  // reading top-down should meet it before the long-form context.
  const sources: CorpusSource[] = [
    { file: RESUME_SOURCE_LABEL, text: resumeText, words: countWords(resumeText) },
    ...loaded.map((s) => ({ file: s.file, text: s.text, words: countWords(s.text) })),
  ];

  return {
    sources,
    totalWords: sources.reduce((n, s) => n + s.words, 0),
    document: buildCorpusDocument(sources),
  };
}

/**
 * One document with file delimiters, so a citation can be attributed back to the
 * file it came from without a second model call asking where it found it.
 */
export function buildCorpusDocument(sources: CorpusSource[]): string {
  return sources
    .map((s) => `<<<source: ${s.file}>>>\n${s.text}\n<<<end: ${s.file}>>>`)
    .join('\n\n');
}

/** Whitespace-insensitive containment — the same normalisation the rubric uses. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Which corpus file contains this verbatim quote, or null.
 *
 * A2: an award that cannot be attributed to a real file is not evidence, and is
 * clamped the same way an uncited rubric score is. A richer corpus must not
 * become a licence to infer.
 */
export function attributeCitation(
  quote: string | null | undefined,
  sources: CorpusSource[]
): string | null {
  if (!quote) return null;
  const q = normalize(quote);
  if (q.length < 12) return null; // too short to be evidence of anything
  return sources.find((s) => normalize(s.text).includes(q))?.file ?? null;
}
