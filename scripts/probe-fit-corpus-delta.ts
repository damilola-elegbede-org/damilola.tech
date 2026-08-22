/**
 * ENG-1995 A4 — measure Experience match scored resume-only versus corpus-backed,
 * on the two regression fixtures.
 *
 * This has to be a probe rather than a unit test. The delta is a property of what
 * the MODEL finds in 14.3k words that it could not find in 21 resume bullets; a
 * stubbed model would return whatever the stub was written to return, and the
 * number would be a restatement of the test author's expectation. So this makes
 * real calls and reports what actually came back.
 *
 * A4's own acceptance is explicit about why: "If the corpus does not move the
 * number, either the wiring is wrong or the corpus is thinner than 16,394 words
 * suggests — and both are worth knowing before this ships."
 *
 * Usage (needs ANTHROPIC_API_KEY, and career-data/ present or BLOB_READ_WRITE_TOKEN):
 *   npx tsx scripts/probe-fit-corpus-delta.ts
 */

import { loadCareerCorpus, buildCorpusDocument, type CareerCorpus } from '../src/lib/career-corpus';
import { scoreExperienceDimensions } from '../src/lib/fit-experience';
import { scoreExperienceMatch, FIT_EXPERIENCE_RAW_MAX } from '../src/lib/fit-score';
import { buildResumeText } from '../src/lib/score-core';
import { IDEAL_JD, PASTRY_JD } from '../src/lib/__tests__/fixtures/probe-jds';

/**
 * The resume as a one-file corpus — the pre-ENG-1995 input, for comparison only.
 * The corpus-backed side now CONTAINS this same text (D: Fit reads all career
 * data, resume included), so the delta measures exactly what the six
 * career-data files add on top of it.
 */
function resumeAsCorpus(): CareerCorpus {
  const text = buildResumeText();
  const sources = [{ file: 'resume.txt', text, words: text.trim().split(/\s+/).length }];
  return { sources, totalWords: sources[0].words, document: buildCorpusDocument(sources) };
}

async function main() {
  const corpus = await loadCareerCorpus(buildResumeText());
  const resume = resumeAsCorpus();

  console.log(`corpus: ${corpus.sources.length} files, ${corpus.totalWords} words`);
  console.log(`resume: ${resume.totalWords} words\n`);

  for (const [label, jd] of [['IDEAL', IDEAL_JD], ['PASTRY', PASTRY_JD]] as const) {
    const [resumeOnly, corpusBacked] = await Promise.all([
      scoreExperienceDimensions(resume, jd),
      scoreExperienceDimensions(corpus, jd),
    ]);

    // A failed model call scores absent, which is right at runtime and fatal
    // here: three failures would report a delta of 0 and read as "the corpus
    // does not help". Refuse to report a number built on one.
    const failed = [...resumeOnly, ...corpusBacked].filter((d) => d.callFailed);
    if (failed.length > 0) {
      console.error(
        `${label}: ${failed.length} model call(s) failed — ` +
          `refusing to report a delta built on absent-by-error dimensions.`
      );
      process.exitCode = 1;
      continue;
    }

    const r = scoreExperienceMatch(resumeOnly);
    const c = scoreExperienceMatch(corpusBacked);

    console.log(`=== ${label} ===`);
    console.log(`  resume-only   ${r.pts}/40  (raw ${r.raw}/${FIT_EXPERIENCE_RAW_MAX})`);
    console.log(`  corpus-backed ${c.pts}/40  (raw ${c.raw}/${FIT_EXPERIENCE_RAW_MAX})`);
    console.log(`  delta         ${c.pts - r.pts >= 0 ? '+' : ''}${c.pts - r.pts}`);
    for (const d of corpusBacked) {
      console.log(
        `    ${d.dimension.padEnd(22)} ${d.score}/4  ${d.sourceFile ?? '(unattributed)'}` +
          (d.evidenceRejected ? '  [clamped]' : '')
      );
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
