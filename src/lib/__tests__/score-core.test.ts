/**
 * @vitest-environment node
 *
 * score-core constructs the Anthropic client at module load, and the SDK refuses
 * to initialise in a browser-like environment. The runner is server-only code.
 */
import { describe, it, expect } from 'vitest';
import { buildScorerResumeData, buildResumeText } from '@/lib/score-core';
import { resumeData } from '@/lib/resume-data';

describe('buildScorerResumeData (ENG-1993)', () => {
  it('passes experienceTags through, not silently dropped', () => {
    const data = buildScorerResumeData();
    expect(data.experienceTags).toEqual(resumeData.experienceTags);
  });

  it('passes the tiered skillsAssessment through, not flattened away', () => {
    const data = buildScorerResumeData();
    expect(data.skillsAssessment).toEqual(resumeData.skillsAssessment);
  });

  it('passes tagline through', () => {
    const data = buildScorerResumeData();
    expect(data.tagline).toBe(resumeData.tagline);
  });

  it('keeps location, startDate, and endDate on every experience instead of narrowing them away', () => {
    const data = buildScorerResumeData();
    expect(data.experiences?.length).toBe(resumeData.experiences.length);
    data.experiences?.forEach((e, i) => {
      const source = resumeData.experiences[i];
      expect(e.location).toBe(source.location);
      expect(e.startDate).toBe(source.startDate);
      expect(e.endDate).toBe(source.endDate);
    });
  });

  it('derives yearsExperience from the experience date span instead of a hardcoded 15', () => {
    const data = buildScorerResumeData();
    // resumeData's earliest experience starts Aug 2002; span to "Present" is 20+ years.
    expect(data.yearsExperience).not.toBe(15);
    expect(data.yearsExperience).toBeGreaterThan(20);
  });

  it('does not assert the stale Verily-era teamSize', () => {
    const data = buildScorerResumeData();
    expect(data.teamSize).not.toBe('13 engineers');
  });
});

describe('buildResumeText (ENG-1996)', () => {
  it('renders through buildScorerResumeData, not a narrower ad hoc adapter', () => {
    const text = buildResumeText();
    // Fields buildResumeText used to bypass by hand-listing a subset of
    // ScorerResumeData instead of delegating to buildScorerResumeData().
    if (resumeData.tagline) expect(text).toContain(resumeData.tagline);
    resumeData.experienceTags?.forEach((tag) => expect(text).toContain(tag));
  });

  it('still includes name and summary, which buildScorerResumeData does not derive on its own', () => {
    const text = buildResumeText();
    expect(text).toContain(resumeData.name);
    expect(text).toContain(resumeData.brandingStatement);
  });
});
