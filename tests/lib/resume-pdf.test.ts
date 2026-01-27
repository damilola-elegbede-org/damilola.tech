import { describe, it, expect } from 'vitest';
import { getResumeFilename, applyChangesToResume, ResumeData } from '@/lib/resume-pdf';
import type { ProposedChange } from '@/lib/types/resume-generation';

/**
 * Helper to create a minimal resume for testing
 */
function createTestResume(overrides: Partial<ResumeData> = {}): ResumeData {
  return {
    name: 'Test User',
    title: 'Software Engineer',
    phone: '555-1234',
    email: 'test@example.com',
    linkedin: 'https://linkedin.com/in/test',
    website: 'https://test.com',
    location: 'San Francisco, CA',
    tagline: 'Building great software',
    summary: 'Strategic engineering leader with 15+ years building high-performance teams and scalable platforms across healthcare, fintech, and enterprise domains.',
    experience: [
      {
        company: 'Verily',
        title: 'Engineering Manager',
        location: 'San Francisco, CA',
        dates: '2020 - Present',
        description: 'Leading platform engineering team.',
        responsibilities: [
          'Led cloud migration serving 30+ production systems.',
          'Managed a team of 12 engineers across 3 time zones.',
        ],
      },
    ],
    education: [
      {
        degree: 'MBA',
        institution: 'Stanford University',
        year: 2015,
        focus: 'Technology Management and Innovation',
      },
    ],
    skills: [
      {
        category: 'Leadership',
        items: ['Cross-Functional Leadership', 'Technical Strategy', 'Executive Stakeholder Management'],
      },
      {
        category: 'Technical',
        items: ['Cloud Architecture', 'System Design', 'Python'],
      },
    ],
    ...overrides,
  };
}

/**
 * Helper to create a ProposedChange
 */
function createChange(overrides: Partial<ProposedChange>): ProposedChange {
  return {
    section: 'summary',
    original: 'engineering leader',
    modified: 'platform engineering leader',
    reason: 'Test change',
    keywordsAdded: [],
    impactPoints: 1,
    ...overrides,
  };
}

describe('applyChangesToResume - targeted replacement', () => {
  describe('summary changes', () => {
    it('replaces only the matched phrase in summary', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'summary',
          original: 'engineering leader',
          modified: 'platform engineering leader',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe(
        'Strategic platform engineering leader with 15+ years building high-performance teams and scalable platforms across healthcare, fintech, and enterprise domains.'
      );
    });

    it('preserves surrounding text when replacing phrase', () => {
      const resume = createTestResume({
        summary: 'I am a skilled developer with strong experience.',
      });
      const changes = [
        createChange({
          section: 'summary',
          original: 'skilled developer',
          modified: 'senior software architect',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe('I am a senior software architect with strong experience.');
    });

    it('falls back to full replacement if original not found', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'summary',
          original: 'nonexistent phrase',
          modified: 'completely new summary',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe('completely new summary');
    });

    it('handles case-insensitive matching', () => {
      const resume = createTestResume({
        summary: 'Strong ENGINEERING background with leadership experience.',
      });
      const changes = [
        createChange({
          section: 'summary',
          original: 'engineering background',
          modified: 'platform engineering expertise',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe('Strong platform engineering expertise with leadership experience.');
    });
  });

  describe('experience bullet changes', () => {
    it('replaces only the matched phrase in experience bullet', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'experience.verily.bullet1',
          original: 'Led cloud migration',
          modified: 'Architected and led enterprise-wide GCP cloud migration',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.experience[0].responsibilities[0]).toBe(
        'Architected and led enterprise-wide GCP cloud migration serving 30+ production systems.'
      );
    });

    it('handles multiple bullets independently', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'experience.verily.bullet1',
          original: 'cloud migration',
          modified: 'AWS-to-GCP cloud migration',
        }),
        createChange({
          section: 'experience.verily.bullet2',
          original: '12 engineers',
          modified: '15 engineers',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0, 1]));

      expect(result.experience[0].responsibilities[0]).toBe(
        'Led AWS-to-GCP cloud migration serving 30+ production systems.'
      );
      expect(result.experience[0].responsibilities[1]).toBe(
        'Managed a team of 15 engineers across 3 time zones.'
      );
    });
  });

  describe('skills changes', () => {
    it('replaces only the matched skill item', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.leadership',
          original: 'Cross-Functional Leadership',
          modified: 'Cross-Functional Leadership with Diverse Groups',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.skills[0].items).toEqual([
        'Cross-Functional Leadership with Diverse Groups',
        'Technical Strategy',
        'Executive Stakeholder Management',
      ]);
    });

    it('preserves other skill items when modifying one', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.technical',
          original: 'System Design',
          modified: 'Distributed System Design',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.skills[1].items).toEqual([
        'Cloud Architecture',
        'Distributed System Design',
        'Python',
      ]);
    });

    it('handles case-insensitive skill matching', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.technical',
          original: 'cloud architecture',
          modified: 'Multi-Cloud Architecture',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.skills[1].items).toContain('Multi-Cloud Architecture');
    });

    it('falls back to full list replacement for multiple items', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.leadership',
          original: 'nonexistent skill',
          modified: 'Skill A | Skill B | Skill C',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.skills[0].items).toEqual(['Skill A', 'Skill B', 'Skill C']);
    });

    it('replaces full list when modified contains multiple items even if original is found', () => {
      // This tests the case where AI generates a full list replacement
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.leadership',
          original: 'Cross-Functional Leadership', // Exists in the list
          modified: 'Team Leadership | Strategic Planning | Executive Communication', // Full new list
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      // Should replace entire list, not just the matched item
      expect(result.skills[0].items).toEqual([
        'Team Leadership',
        'Strategic Planning',
        'Executive Communication',
      ]);
    });

    it('handles single item replacement when original not found', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'skills.leadership',
          original: 'Some Other Skill',
          modified: 'New Single Skill',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      // Should replace entire items array with the single new skill
      expect(result.skills[0].items).toEqual(['New Single Skill']);
    });
  });

  describe('education changes', () => {
    it('replaces only the matched phrase in focus field', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'education.mba.focus',
          original: 'Technology Management',
          modified: 'Strategic Technology Leadership',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.education[0].focus).toBe('Strategic Technology Leadership and Innovation');
    });

    it('handles degree field modifications', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'education.mba.degree',
          original: 'MBA',
          modified: 'Executive MBA',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.education[0].degree).toBe('Executive MBA');
    });

    it('handles education by index', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'education.0.focus',
          original: 'Innovation',
          modified: 'Innovation Strategy',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.education[0].focus).toBe('Technology Management and Innovation Strategy');
    });
  });

  describe('edge cases', () => {
    it('ignores changes not in acceptedIndices', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'summary',
          original: 'engineering leader',
          modified: 'platform leader',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set());

      expect(result.summary).toBe(resume.summary);
    });

    it('handles empty original gracefully', () => {
      const resume = createTestResume();
      const changes = [
        createChange({
          section: 'summary',
          original: '',
          modified: 'new content',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe('new content');
    });

    it('handles special regex characters in original', () => {
      const resume = createTestResume({
        summary: 'C++ and .NET developer with 10+ years experience.',
      });
      const changes = [
        createChange({
          section: 'summary',
          original: 'C++ and .NET',
          modified: 'C++, Python, and .NET',
        }),
      ];

      const result = applyChangesToResume(resume, changes, new Set([0]));

      expect(result.summary).toBe('C++, Python, and .NET developer with 10+ years experience.');
    });

    it('does not mutate original resume data', () => {
      const resume = createTestResume();
      const originalSummary = resume.summary;
      const changes = [
        createChange({
          section: 'summary',
          original: 'engineering leader',
          modified: 'platform leader',
        }),
      ];

      applyChangesToResume(resume, changes, new Set([0]));

      expect(resume.summary).toBe(originalSummary);
    });
  });
});

describe('getResumeFilename', () => {
  it('should generate a valid filename', () => {
    const filename = getResumeFilename('Test Company', 'Engineering Manager');
    expect(filename).toBe('Test-Company-Engineering-Manager.pdf');
  });

  it('should sanitize special characters', () => {
    const filename = getResumeFilename('Company (Inc.)', 'Role/Title');
    expect(filename).toBe('Company-Inc-RoleTitle.pdf');
  });

  it('should handle multiple spaces', () => {
    const filename = getResumeFilename('My  Company', 'Senior  Manager');
    expect(filename).toBe('My-Company-Senior-Manager.pdf');
  });

  it('should handle empty strings with fallbacks', () => {
    const filename = getResumeFilename('', '');
    expect(filename).toBe('resume-optimized.pdf');
  });

  it('should handle whitespace-only strings with fallbacks', () => {
    const filename = getResumeFilename('   ', '   ');
    expect(filename).toBe('resume-optimized.pdf');
  });

  it('should handle symbols-only strings with fallbacks', () => {
    const filename = getResumeFilename('!!!', '@#$');
    expect(filename).toBe('resume-optimized.pdf');
  });

  it('should use fallback only for empty company', () => {
    const filename = getResumeFilename('', 'Manager');
    expect(filename).toBe('resume-Manager.pdf');
  });

  it('should use fallback only for empty role', () => {
    const filename = getResumeFilename('Acme', '');
    expect(filename).toBe('Acme-optimized.pdf');
  });
});

// Note: Full PDF generation tests would require mocking @react-pdf/renderer
// which is complex. The PDF rendering is primarily tested through E2E tests
// that verify the generated PDF contains expected text.
