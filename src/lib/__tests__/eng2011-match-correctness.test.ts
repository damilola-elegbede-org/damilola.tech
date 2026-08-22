/**
 * @vitest-environment node
 *
 * Clara's two measured findings on ENG-2011. Both fabricate or mis-credit
 * upstream of every downstream guard, so no anti-fabrication check can see them.
 */
import { describe, it, expect } from 'vitest';
import { extractPhrases, matchKeywords, normalizeSeparators } from '@/lib/jd-keywords';

describe('A — a hyphenated requirement forms as ONE phrase', () => {
  // NVIDIA writes "open-source" hyphenated in both places that matter.
  // KNOWN_PHRASES held only "open source", and extraction did a raw indexOf,
  // so the phrase never formed and decomposed into tokens.
  it('the explicit open-source entry is belt-and-braces, not the mechanism', () => {
    // Worth stating plainly: removing 'open-source' from KNOWN_PHRASES changes
    // nothing, because normalizeSeparators folds it onto 'open source'. The
    // normalisation is the fix; the extra entry is redundancy. Claiming it as a
    // guard would be claiming a test that cannot fail.
    expect(normalizeSeparators('open-source')).toBe('open source');
  });

  it('extracts open-source as a phrase, not as loose tokens', () => {
    const { phrases, remainder } = extractPhrases(
      'Experience with open-source development workflows including forks and mirrors.'
    );
    expect(phrases).toContain('open source');
    expect(remainder).not.toMatch(/\bsource\b/);
  });

  it('treats the spaced and hyphenated spellings identically', () => {
    const hyphen = extractPhrases('open-source contribution').phrases;
    const spaced = extractPhrases('open source contribution').phrases;
    expect(hyphen).toEqual(spaced);
  });

  it('folds unicode dashes and slashes to one form', () => {
    expect(normalizeSeparators('open‑source')).toBe('open source');
    expect(normalizeSeparators('CI/CD')).toBe('CI CD');
  });

  it('the decomposed tokens are what made D\'s corpus look like headroom', () => {
    // Each of these matched somewhere in the corpus and meant nothing like the
    // requirement: open→"open to new opportunities", source→"significant
    // resources", contribution→"cumulus contributions". Five of eight tokens
    // hit, zero hit the résumé — reading as large headroom on the one
    // requirement D genuinely does not meet.
    const { remainder } = extractPhrases('open-source contribution workflows');
    expect(remainder).not.toMatch(/\bopen\b/);
  });
});

describe('B — a keyword never matches inside an unrelated longer word', () => {
  it.each([
    ['rust', 'relationships and trust through excellent delivery'],
    ['scala', 'secure, scalable ci/cd infrastructure'],
    ['java', 'javascript and typescript across the stack'],
    ['source', 'the migration demanded significant resources'],
  ])('%s does not match in "%s"', (kw, resume) => {
    expect(matchKeywords([kw], resume).matched).toEqual([]);
  });

  it('still matches the whole word', () => {
    expect(matchKeywords(['rust'], 'built services in rust and go').matched).toContain('rust');
    expect(matchKeywords(['scala'], 'scala and spark pipelines').matched).toContain('scala');
  });

  it('recovers real word-form variants through the synonym table, not substrings', () => {
    expect(matchKeywords(['python'], 'pythonic style throughout').matched).toContain('python');
  });

  it('KNOWN GAP: the stem rung still over-reaches — react matches reactive', () => {
    // A THIRD instance of the same class, one rung further down. stemWord()
    // suffix-strips "reactive" to "react", so a semantic mismatch survives the
    // boundary fix. Asserted as-is rather than silently loosened OR tightened:
    // narrowing the stemmer risks the legitimate manage/managing/managed family,
    // and that trade needs its own evidence. Recorded on ENG-2011.
    const r = matchKeywords(['react'], 'a reactive event-driven architecture');
    expect(r.matchDetails[0]?.matchType).toBe('stem');
  });

  it('the legitimate stem family still matches, which is why the rung stays', () => {
    expect(matchKeywords(['managing'], 'managed a platform organisation').matched)
      .toContain('managing');
  });

  it('applies the same boundary rule one rung down, on synonyms', () => {
    // The synonym rung carried the identical length-gated substring bug, and it
    // needs a synonym LONGER than the old 3-char gate to be visible at all:
    // 'leading' is a synonym of 'leadership', and it sits inside 'misleading'.
    expect(matchKeywords(['leadership'], 'a misleading dashboard metric').matched).toEqual([]);
  });

  it('still matches a synonym as a whole word', () => {
    expect(matchKeywords(['leadership'], 'leading a platform organisation').matched)
      .toContain('leadership');
  });
});

describe('separator normalisation is symmetric — extraction AND matching', () => {
  // Clara predicted this: fixing extraction alone OVER-corrected. Extraction
  // folds "CI/CD" to "ci cd", then matching compared it against a raw résumé
  // that writes "CI/CD Pipeline Design" — so the very terms an engineering JD
  // asks for stopped matching. On a compound-heavy JD like Google's that is a
  // silent score depression, and a false negative D never sees.
  const RESUME =
    'CI/CD Pipeline Design, GitHub Actions, Jenkins, cross-functional leadership, multi-site teams';

  it.each([
    ['ci cd', 'CI/CD in the résumé'],
    ['cross functional', 'cross-functional in the résumé'],
    ['ci/cd', 'slash form on both sides'],
  ])('matches %s (%s)', (kw) => {
    expect(matchKeywords([kw], RESUME).matched).toContain(kw);
  });

  it('does not invent a match the résumé has no form of', () => {
    expect(matchKeywords(['multi quarter'], RESUME).matched).toEqual([]);
    expect(matchKeywords(['open source'], RESUME).matched).toEqual([]);
  });
});
