/**
 * @vitest-environment node
 *
 * ENG-1993 widened what reaches the scorer. ENG-1996 moved the renderer. These
 * guard the seam between the two: passing a field through
 * `buildScorerResumeData()` does nothing unless `resumeDataToText()` renders it,
 * and that failure shows up as a slightly lower score rather than an error.
 */
import { describe, it, expect } from 'vitest';
import { resumeDataToText } from '@/lib/resume-text';

const DATA = {
  name: 'Damilola Elegbede',
  title: 'Sr. Engineering Manager',
  tagline: 'I build engineering organizations that deliver results',
  yearsExperience: 15,
  experienceTags: ['Engineering Management', 'MBA + MS CS'],
  skillsAssessment: {
    expert: ['Executive Stakeholder Management'],
    proficient: ['Kubernetes/GKE'],
    familiar: ['ArgoCD'],
  },
  experiences: [
    {
      title: 'Sr. Manager, DX',
      company: 'Visa',
      location: 'Boulder, CO',
      startDate: 'Apr 2026',
      highlights: ['Led developer tooling'],
    },
  ],
  openToRoles: ['Director of Engineering'],
};

describe('resumeDataToText renders what ENG-1993 stopped dropping', () => {
  it('renders the tagline', () => {
    expect(resumeDataToText(DATA)).toContain(DATA.tagline);
  });

  it('renders experienceTags', () => {
    expect(resumeDataToText(DATA)).toContain('MBA + MS CS');
  });

  it('renders skillsAssessment WITH its tier, not as a flat list', () => {
    const text = resumeDataToText(DATA);
    // The tiering is the point: a JD asking for executive stakeholder
    // management should be able to match an expert-tier claim. A flat array
    // makes "Jenkins" and that phrase peers.
    expect(text).toContain('Expert: Executive Stakeholder Management');
    expect(text).toContain('Familiar: ArgoCD');
  });

  it('keeps tenure and geography attached to the role they belong to', () => {
    const line = resumeDataToText(DATA)
      .split('\n')
      .find((l) => l.includes('Visa'));
    expect(line).toContain('Boulder, CO');
    expect(line).toContain('Apr 2026 - Present');
  });

  it('renders derived yearsExperience rather than dropping it', () => {
    expect(resumeDataToText(DATA)).toContain('Years of experience: 15');
  });

  it('omits absent fields instead of emitting empty labels', () => {
    const text = resumeDataToText({ name: 'X', title: 'Y' });
    expect(text).not.toContain('Expert:');
    expect(text).not.toContain('Years of experience');
    expect(text).not.toContain('Open to:');
  });
});
