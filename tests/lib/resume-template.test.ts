import { describe, it, expect } from 'vitest';
import { buildResumeHtml } from '@/lib/resume-template';
import type { ResumeAnalysisResult } from '@/lib/types/resume-generation';

// Mock analysis result
const mockAnalysisResult: ResumeAnalysisResult = {
  analysis: {
    jdSummary: 'Platform engineering leadership role',
    companyName: 'Test Company',
    roleTitle: 'Engineering Manager, Platform',
    department: 'Platform Engineering',
    topKeywords: ['platform', 'kubernetes', 'cloud', 'leadership'],
    requiredSkills: ['GCP', 'Kubernetes', 'Terraform'],
    niceToHaveSkills: ['AWS', 'Service mesh'],
    yearsRequired: '8+',
    teamSize: '6-10 engineers',
    scopeExpected: 'Platform team',
    industryContext: 'Tech',
  },
  currentScore: {
    total: 72,
    breakdown: {
      keywordRelevance: 28,
      skillsQuality: 18,
      experienceAlignment: 16,
      formatParseability: 10,
    },
    assessment: 'Good foundation but missing key keywords',
  },
  proposedChanges: [
    {
      section: 'summary',
      original: 'Strategic engineering leader with 15+ years...',
      modified: 'Platform engineering leader with 15+ years scaling cloud infrastructure...',
      reason: 'Added platform engineering keywords',
      keywordsAdded: ['platform engineering', 'cloud infrastructure'],
      impactPoints: 4,
    },
    {
      section: 'experience.verily.bullet1',
      original: 'Architected and executed enterprise-wide GCP cloud transformation...',
      modified: 'Led enterprise-wide GCP cloud transformation supporting 30+ production systems...',
      reason: 'Reworded to lead with action verb',
      keywordsAdded: ['led'],
      impactPoints: 2,
    },
  ],
  optimizedScore: {
    total: 86,
    breakdown: {
      keywordRelevance: 36,
      skillsQuality: 22,
      experienceAlignment: 18,
      formatParseability: 10,
    },
    assessment: 'Strong match after optimization',
  },
  gaps: [
    {
      requirement: 'React/TypeScript experience',
      severity: 'moderate',
      inResume: false,
      mitigation: 'Mention JavaScript familiarity',
    },
  ],
  skillsReorder: {
    before: ['Leadership', 'Cloud', 'System Architecture'],
    after: ['Cloud', 'Platform Engineering', 'Leadership'],
    reason: 'Prioritized cloud skills',
  },
  interviewPrep: ['Prepare React learning plan'],
};

describe('buildResumeHtml', () => {
  it('should generate valid HTML with accepted changes', () => {
    const acceptedIndices = new Set([0, 1]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain HTML structure
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');

    // Should contain candidate name
    expect(html).toContain('Damilola Elegbede');

    // Should contain sections
    expect(html).toContain('Professional Summary');
    expect(html).toContain('Professional Experience');
    expect(html).toContain('Education');
    expect(html).toContain('Core Competencies');
  });

  it('should apply accepted summary change', () => {
    const acceptedIndices = new Set([0]); // Only accept summary change
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain the modified summary
    expect(html).toContain('Platform engineering leader with 15+ years scaling cloud infrastructure');
  });

  it('should include company and role in optimization note', () => {
    const acceptedIndices = new Set([0]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain target info
    expect(html).toContain('Test Company');
    expect(html).toContain('Engineering Manager, Platform');
  });

  it('should include experience sections', () => {
    const acceptedIndices = new Set([]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain experience entries
    expect(html).toContain('Verily Life Sciences');
    expect(html).toContain('Qualcomm Technologies');
    expect(html).toContain('Engineering Manager - Cloud Infrastructure');
  });

  it('should include education sections', () => {
    const acceptedIndices = new Set([]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain education entries
    expect(html).toContain('MBA');
    expect(html).toContain('MS, Computer Science');
    expect(html).toContain('University of Colorado');
  });

  it('should include skills sections', () => {
    const acceptedIndices = new Set([]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain skill categories
    expect(html).toContain('Leadership');
    expect(html).toContain('Cloud & Infrastructure');
    expect(html).toContain('Technical');
    expect(html).toContain('Programming');
  });

  it('should be ATS-friendly (single column, standard fonts)', () => {
    const acceptedIndices = new Set([]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should use standard fonts
    expect(html).toContain('Calibri');
    expect(html).toContain('Arial');

    // Should NOT contain tables (ATS can have trouble)
    expect(html).not.toContain('<table');

    // Should contain section headers
    expect(html).toContain('section-header');
  });

  it('should handle empty accepted changes', () => {
    const acceptedIndices = new Set<number>();
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should still generate valid HTML
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Damilola Elegbede');

    // Should show 0 changes applied
    expect(html).toContain('Changes Applied:</strong> 0');
  });

  it('should include contact information', () => {
    const acceptedIndices = new Set([]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should contain contact info
    expect(html).toContain('Boulder, CO');
    expect(html).toContain('damilola.elegbede@gmail.com');
    expect(html).toContain('linkedin.com/in/damilola-elegbede');
  });

  it('should include optimized score in footer', () => {
    const acceptedIndices = new Set([0, 1]);
    const html = buildResumeHtml(mockAnalysisResult, acceptedIndices);

    // Should show score
    expect(html).toContain('Compatibility Score');
    expect(html).toContain('/100');
  });
});
