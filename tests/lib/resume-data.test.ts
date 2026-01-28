import { describe, it, expect } from 'vitest';
import { resumeData, suggestedQuestions } from '@/lib/resume-data';
import type { ResumeData, Experience, Skill, Education, SuggestedQuestion } from '@/types';

describe('resumeData', () => {
  describe('basic structure', () => {
    it('has all required top-level fields', () => {
      expect(resumeData).toBeDefined();
      expect(resumeData.name).toBe('Damilola Elegbede');
      expect(resumeData.title).toBe('Engineering Manager');
      expect(resumeData.tagline).toBeTruthy();
      expect(resumeData.brandingStatement).toBeTruthy();
      expect(resumeData.email).toBe('damilola.elegbede@gmail.com');
      expect(resumeData.linkedin).toMatch(/^https:\/\/linkedin\.com\//);
      expect(resumeData.github).toMatch(/^https:\/\/github\.com\//);
      expect(resumeData.location).toBe('Boulder, CO');
    });

    it('has openToRoles array with at least one role', () => {
      expect(Array.isArray(resumeData.openToRoles)).toBe(true);
      expect(resumeData.openToRoles.length).toBeGreaterThan(0);
      resumeData.openToRoles.forEach((role) => {
        expect(typeof role).toBe('string');
        expect(role.length).toBeGreaterThan(0);
      });
    });

    it('has experienceTags array with at least one tag', () => {
      expect(Array.isArray(resumeData.experienceTags)).toBe(true);
      expect(resumeData.experienceTags.length).toBeGreaterThan(0);
      resumeData.experienceTags.forEach((tag) => {
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
      });
    });
  });

  describe('experiences', () => {
    it('contains experience entries', () => {
      expect(Array.isArray(resumeData.experiences)).toBe(true);
      expect(resumeData.experiences.length).toBeGreaterThan(0);
    });

    it('all experiences have required fields', () => {
      resumeData.experiences.forEach((exp: Experience) => {
        expect(exp.id).toBeTruthy();
        expect(typeof exp.id).toBe('string');

        expect(exp.company).toBeTruthy();
        expect(typeof exp.company).toBe('string');

        expect(exp.title).toBeTruthy();
        expect(typeof exp.title).toBe('string');

        expect(exp.location).toBeTruthy();
        expect(typeof exp.location).toBe('string');

        expect(exp.startDate).toBeTruthy();
        expect(typeof exp.startDate).toBe('string');

        expect(exp.endDate).toBeTruthy();
        expect(typeof exp.endDate).toBe('string');

        expect(Array.isArray(exp.highlights)).toBe(true);
        expect(exp.highlights.length).toBeGreaterThan(0);
      });
    });

    it('all experience highlights are non-empty strings', () => {
      resumeData.experiences.forEach((exp: Experience) => {
        exp.highlights.forEach((highlight: string) => {
          expect(typeof highlight).toBe('string');
          expect(highlight.length).toBeGreaterThan(0);
        });
      });
    });

    it('experience IDs are unique', () => {
      const ids = resumeData.experiences.map((exp) => exp.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('experiences are in reverse chronological order (most recent first)', () => {
      // Verily should be first (most recent)
      expect(resumeData.experiences[0].company).toBe('Verily Life Sciences');
      expect(resumeData.experiences[0].startDate).toBe('Sep 2022');
    });
  });

  describe('skills', () => {
    it('contains skill categories', () => {
      expect(Array.isArray(resumeData.skills)).toBe(true);
      expect(resumeData.skills.length).toBeGreaterThan(0);
    });

    it('all skills have category and items', () => {
      resumeData.skills.forEach((skill: Skill) => {
        expect(skill.category).toBeTruthy();
        expect(typeof skill.category).toBe('string');

        expect(Array.isArray(skill.items)).toBe(true);
        expect(skill.items.length).toBeGreaterThan(0);
      });
    });

    it('all skill items are non-empty strings', () => {
      resumeData.skills.forEach((skill: Skill) => {
        skill.items.forEach((item: string) => {
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(0);
        });
      });
    });

    it('skill categories are unique', () => {
      const categories = resumeData.skills.map((skill) => skill.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(categories.length);
    });

    it('contains expected skill categories', () => {
      const categories = resumeData.skills.map((skill) => skill.category);
      expect(categories).toContain('Leadership');
      expect(categories).toContain('Cloud & Infrastructure');
      expect(categories).toContain('Programming');
    });
  });

  describe('skillsAssessment', () => {
    it('has expert, proficient, and familiar levels', () => {
      expect(resumeData.skillsAssessment).toBeDefined();
      expect(Array.isArray(resumeData.skillsAssessment.expert)).toBe(true);
      expect(Array.isArray(resumeData.skillsAssessment.proficient)).toBe(true);
      expect(Array.isArray(resumeData.skillsAssessment.familiar)).toBe(true);
    });

    it('all skill levels contain non-empty strings', () => {
      ['expert', 'proficient', 'familiar'].forEach((level) => {
        const skills = resumeData.skillsAssessment[level as keyof typeof resumeData.skillsAssessment];
        expect(skills.length).toBeGreaterThan(0);
        skills.forEach((skill: string) => {
          expect(typeof skill).toBe('string');
          expect(skill.length).toBeGreaterThan(0);
        });
      });
    });

    it('no skill appears in multiple levels', () => {
      const allSkills = [
        ...resumeData.skillsAssessment.expert,
        ...resumeData.skillsAssessment.proficient,
        ...resumeData.skillsAssessment.familiar,
      ];
      const uniqueSkills = new Set(allSkills);
      expect(uniqueSkills.size).toBe(allSkills.length);
    });
  });

  describe('education', () => {
    it('contains education entries', () => {
      expect(Array.isArray(resumeData.education)).toBe(true);
      expect(resumeData.education.length).toBeGreaterThan(0);
    });

    it('all education entries have required fields', () => {
      resumeData.education.forEach((edu: Education) => {
        expect(edu.id).toBeTruthy();
        expect(typeof edu.id).toBe('string');

        expect(edu.degree).toBeTruthy();
        expect(typeof edu.degree).toBe('string');

        expect(edu.institution).toBeTruthy();
        expect(typeof edu.institution).toBe('string');
      });
    });

    it('education IDs are unique', () => {
      const ids = resumeData.education.map((edu) => edu.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('contains expected degrees', () => {
      const degrees = resumeData.education.map((edu) => edu.degree);
      expect(degrees).toContain('MBA');
      expect(degrees).toContain('MS Computer Science');
    });
  });

  describe('data validation', () => {
    it('conforms to ResumeData type', () => {
      const data: ResumeData = resumeData;
      expect(data).toBeDefined();
    });

    it('has valid email format', () => {
      expect(resumeData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('has valid LinkedIn URL', () => {
      expect(resumeData.linkedin).toMatch(/^https:\/\/linkedin\.com\/in\//);
    });

    it('has valid GitHub URL', () => {
      expect(resumeData.github).toMatch(/^https:\/\/github\.com\//);
    });
  });
});

describe('suggestedQuestions', () => {
  it('contains suggested question entries', () => {
    expect(Array.isArray(suggestedQuestions)).toBe(true);
    expect(suggestedQuestions.length).toBeGreaterThan(0);
  });

  it('all questions have label and question fields', () => {
    suggestedQuestions.forEach((q: SuggestedQuestion) => {
      expect(q.label).toBeTruthy();
      expect(typeof q.label).toBe('string');

      expect(q.question).toBeTruthy();
      expect(typeof q.question).toBe('string');
    });
  });

  it('labels are unique', () => {
    const labels = suggestedQuestions.map((q) => q.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('questions are unique', () => {
    const questions = suggestedQuestions.map((q) => q.question);
    const uniqueQuestions = new Set(questions);
    expect(uniqueQuestions.size).toBe(questions.length);
  });

  it('contains expected question categories', () => {
    const labels = suggestedQuestions.map((q) => q.label);
    expect(labels).toContain('Leadership Philosophy');
    expect(labels).toContain('Scaling Teams');
  });
});
