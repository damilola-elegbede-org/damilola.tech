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

/**
 * Normalise for comparison.
 *
 * The corpus is markdown and JSON: `**bold**`, `#` headers, `|` table pipes,
 * `-` bullets, and JSON escaping. A model reads through all of that and quotes
 * clean prose, so a quote that is *faithful* is still not a byte-substring of
 * the source. Lowercasing and collapsing whitespace was not enough, and the
 * mismatch was indistinguishable from "the corpus holds nothing more" (ENG-2010).
 */
function normalize(s: string): string {
  return s
    .replace(/\\[nrt]/g, ' ')        // JSON-escaped whitespace in star-stories.json
    .replace(/\\"/g, '"')
    .replace(/[*_`~]/g, '')          // markdown emphasis and code ticks
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX headers
    .replace(/^\s*[-+*]\s+/gm, '')    // bullets
    .replace(/\|/g, ' ')             // table pipes
    .replace(/[\u2018\u2019]/g, "'")  // smart quotes
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')  // en/em dashes
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Content words, for the overlap fallback.
 *
 * Trailing punctuation is stripped per token: the source ends a sentence
 * "…12 agents." and a quote may render it "agents," or "agents". Leaving the
 * punctuation attached made those three different tokens and dropped a faithful
 * quote's overlap below threshold.
 */
function tokens(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9%+./ -]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter((t) => t.length > 2);
}

/**
 * How much of the quote's vocabulary appears in the source, in order-independent
 * terms. Substring containment is the strict path; this is the fallback for a
 * quote the model reflowed, re-punctuated, or stitched across a markdown break.
 */
export const ATTRIBUTION_OVERLAP_THRESHOLD = 0.85;

function overlapRatio(quote: string, source: string): number {
  const q = tokens(quote);
  if (q.length === 0) return 0;
  const src = new Set(tokens(source));
  return q.filter((t) => src.has(t)).length / q.length;
}

export function attributeCitation(
  quote: string | null | undefined,
  sources: CorpusSource[]
): string | null {
  if (!quote) return null;
  const q = normalize(quote);
  if (q.length < 12) return null; // too short to be evidence of anything

  // Strict first. This is a FAST PATH, not a second guard: any quote it accepts
  // the overlap fallback would also accept at ratio 1.0. It is kept because an
  // exact containment is unambiguous and cheap, but it is not independently
  // load-bearing — do not treat its presence as a safety property.
  const exact = sources.find((s) => normalize(s.text).includes(q));
  if (exact) return exact.file;

  // Then the overlap fallback. Still evidence-bound — a quote whose vocabulary
  // is mostly absent from every source is not attributable, and returning null
  // is what clamps the score. This widens what counts as a faithful quote; it
  // does not lower the bar for having one.
  let best: { file: string; ratio: number } | null = null;
  for (const s of sources) {
    const ratio = overlapRatio(quote, s.text);
    if (!best || ratio > best.ratio) best = { file: s.file, ratio };
  }
  return best && best.ratio >= ATTRIBUTION_OVERLAP_THRESHOLD ? best.file : null;
}
