import { describe, it, expect } from 'vitest';
import type {
  ScoreBreakdown,
  EstimatedCompatibility,
  ProposedChange,
  Gap,
  ResumeGenerationLog,
  ResumeGenerationSummary,
  ApplicationStatus,
  ChangeStatus,
  ReviewedChange,
  LoggedChange,
  ModifyChangeRequest,
  ModifyChangeResponse,
} from '@/lib/types/resume-generation';

describe('Resume Generation Types', () => {
  describe('ScoreBreakdown', () => {
    it('should have all required fields', () => {
      const breakdown: ScoreBreakdown = {
        keywordRelevance: 28,
        skillsQuality: 18,
        experienceAlignment: 16,
        formatParseability: 10,
      };

      expect(breakdown.keywordRelevance).toBe(28);
      expect(breakdown.skillsQuality).toBe(18);
      expect(breakdown.experienceAlignment).toBe(16);
      expect(breakdown.formatParseability).toBe(10);

      // Total should be 0-100
      const total = breakdown.keywordRelevance + breakdown.skillsQuality +
                   breakdown.experienceAlignment + breakdown.formatParseability;
      expect(total).toBeLessThanOrEqual(100);
    });

    it('should enforce max values per component', () => {
      const maxBreakdown: ScoreBreakdown = {
        keywordRelevance: 40,
        skillsQuality: 25,
        experienceAlignment: 20,
        formatParseability: 15,
      };

      // Max possible score is 100
      const total = maxBreakdown.keywordRelevance + maxBreakdown.skillsQuality +
                   maxBreakdown.experienceAlignment + maxBreakdown.formatParseability;
      expect(total).toBe(100);
    });
  });

  describe('EstimatedCompatibility', () => {
    it('should track before and after scores', () => {
      const compatibility: EstimatedCompatibility = {
        before: 72,
        after: 86,
        breakdown: {
          keywordRelevance: 36,
          skillsQuality: 22,
          experienceAlignment: 18,
          formatParseability: 10,
        },
      };

      expect(compatibility.after).toBeGreaterThan(compatibility.before);
    });
  });

  describe('ProposedChange', () => {
    it('should have all required change fields', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Modified text with keywords',
        reason: 'Added keywords',
        keywordsAdded: ['keyword1', 'keyword2'],
        impactPoints: 4,
      };

      expect(change.section).toBe('summary');
      expect(change.modified).not.toBe(change.original);
      expect(change.keywordsAdded.length).toBeGreaterThan(0);
      expect(change.impactPoints).toBeGreaterThan(0);
    });
  });

  describe('Gap', () => {
    it('should have valid severity levels', () => {
      const severities: Gap['severity'][] = ['critical', 'moderate', 'minor'];

      severities.forEach((severity) => {
        const gap: Gap = {
          requirement: 'Test requirement',
          severity,
          inResume: false,
          mitigation: 'Test mitigation',
        };
        expect(['critical', 'moderate', 'minor']).toContain(gap.severity);
      });
    });
  });

  describe('ApplicationStatus', () => {
    it('should have all valid status values', () => {
      const statuses: ApplicationStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected'];

      statuses.forEach((status) => {
        expect(['draft', 'applied', 'interview', 'offer', 'rejected']).toContain(status);
      });
    });
  });

  describe('ResumeGenerationLog', () => {
    it('should have all required log fields', () => {
      const log: ResumeGenerationLog = {
        version: 1,
        generationId: 'test-id',
        environment: 'production',
        createdAt: new Date().toISOString(),
        inputType: 'text',
        companyName: 'Test Company',
        roleTitle: 'Engineering Manager',
        jobDescriptionFull: 'Full JD text here',
        estimatedCompatibility: {
          before: 72,
          after: 86,
          breakdown: {
            keywordRelevance: 36,
            skillsQuality: 22,
            experienceAlignment: 18,
            formatParseability: 10,
          },
        },
        changesAccepted: [],
        changesRejected: [],
        gapsIdentified: [],
        pdfUrl: 'https://blob.url/resume.pdf',
        optimizedResumeJson: {},
        applicationStatus: 'draft',
      };

      expect(log.version).toBe(1);
      expect(log.generationId).toBeDefined();
      expect(log.createdAt).toBeDefined();
    });

    it('should allow optional fields', () => {
      const log: ResumeGenerationLog = {
        version: 1,
        generationId: 'test-id',
        environment: 'production',
        createdAt: new Date().toISOString(),
        inputType: 'url',
        extractedUrl: 'https://jobs.example.com/123',
        companyName: 'Test Company',
        roleTitle: 'Engineering Manager',
        jobDescriptionFull: 'Full JD text here',
        estimatedCompatibility: {
          before: 72,
          after: 86,
          breakdown: {
            keywordRelevance: 36,
            skillsQuality: 22,
            experienceAlignment: 18,
            formatParseability: 10,
          },
        },
        changesAccepted: [],
        changesRejected: [],
        gapsIdentified: [],
        pdfUrl: 'https://blob.url/resume.pdf',
        optimizedResumeJson: {},
        applicationStatus: 'applied',
        appliedDate: '2024-01-15',
        notes: 'Submitted via LinkedIn',
      };

      expect(log.extractedUrl).toBeDefined();
      expect(log.appliedDate).toBeDefined();
      expect(log.notes).toBeDefined();
    });
  });

  describe('ResumeGenerationSummary', () => {
    it('should have all summary fields', () => {
      const now = new Date().toISOString();
      const summary: ResumeGenerationSummary = {
        id: 'path/to/log.json',
        jobId: 'abc123def456',
        generationId: 'test-id',
        environment: 'production',
        timestamp: now,
        updatedAt: now,
        companyName: 'Test Company',
        roleTitle: 'Engineering Manager',
        scoreBefore: 72,
        scoreAfter: 86,
        applicationStatus: 'draft',
        url: 'https://blob.url/log.json',
        size: 1024,
        generationCount: 1,
      };

      expect(summary.scoreAfter).toBeGreaterThan(summary.scoreBefore);
      expect(summary.size).toBeGreaterThan(0);
      expect(summary.jobId).toHaveLength(12);
      expect(summary.generationCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ChangeStatus', () => {
    it('should accept valid status values', () => {
      const pending: ChangeStatus = 'pending';
      const accepted: ChangeStatus = 'accepted';
      const rejected: ChangeStatus = 'rejected';

      expect(pending).toBe('pending');
      expect(accepted).toBe('accepted');
      expect(rejected).toBe('rejected');
    });
  });

  describe('ReviewedChange', () => {
    const mockProposedChange: ProposedChange = {
      section: 'summary',
      original: 'Original text',
      modified: 'Modified text',
      reason: 'Added keywords',
      keywordsAdded: ['cloud', 'kubernetes'],
      impactPoints: 5,
    };

    it('should create a pending reviewed change', () => {
      const reviewedChange: ReviewedChange = {
        originalChange: mockProposedChange,
        status: 'pending',
      };

      expect(reviewedChange.status).toBe('pending');
      expect(reviewedChange.originalChange).toEqual(mockProposedChange);
      expect(reviewedChange.editedText).toBeUndefined();
      expect(reviewedChange.feedback).toBeUndefined();
      expect(reviewedChange.reviewedAt).toBeUndefined();
    });

    it('should create an accepted reviewed change with edits', () => {
      const reviewedChange: ReviewedChange = {
        originalChange: mockProposedChange,
        status: 'accepted',
        editedText: 'User edited text',
        reviewedAt: '2024-01-15T10:30:00Z',
      };

      expect(reviewedChange.status).toBe('accepted');
      expect(reviewedChange.editedText).toBe('User edited text');
      expect(reviewedChange.reviewedAt).toBe('2024-01-15T10:30:00Z');
    });

    it('should create a rejected reviewed change with feedback', () => {
      const reviewedChange: ReviewedChange = {
        originalChange: mockProposedChange,
        status: 'rejected',
        feedback: 'Too aggressive for this company culture',
        reviewedAt: '2024-01-15T10:30:00Z',
      };

      expect(reviewedChange.status).toBe('rejected');
      expect(reviewedChange.feedback).toBe('Too aggressive for this company culture');
    });
  });

  describe('LoggedChange', () => {
    it('should create a logged change without edits', () => {
      const loggedChange: LoggedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Modified text',
        reason: 'Added keywords',
        keywordsAdded: ['cloud'],
        impactPoints: 5,
        wasEdited: false,
      };

      expect(loggedChange.wasEdited).toBe(false);
      expect(loggedChange.originalModified).toBeUndefined();
      expect(loggedChange.rejectionFeedback).toBeUndefined();
    });

    it('should create a logged change with user edits', () => {
      const loggedChange: LoggedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'User edited text', // This is what the user changed it to
        reason: 'Added keywords',
        keywordsAdded: ['cloud'],
        impactPoints: 5,
        wasEdited: true,
        originalModified: 'AI proposed text', // What AI originally proposed
      };

      expect(loggedChange.wasEdited).toBe(true);
      expect(loggedChange.modified).toBe('User edited text');
      expect(loggedChange.originalModified).toBe('AI proposed text');
    });

    it('should create a logged change with rejection feedback', () => {
      const loggedChange: LoggedChange = {
        section: 'experience.verily.bullet1',
        original: 'Original bullet',
        modified: 'Proposed bullet', // AI's proposal
        reason: 'Added metrics',
        keywordsAdded: ['scale'],
        impactPoints: 3,
        wasEdited: false,
        rejectionFeedback: 'Does not match my actual experience',
      };

      expect(loggedChange.rejectionFeedback).toBe('Does not match my actual experience');
    });
  });

  describe('ModifyChangeRequest', () => {
    const mockProposedChange: ProposedChange = {
      section: 'summary',
      original: 'Original summary text',
      modified: 'AI proposed summary text',
      reason: 'Added keywords',
      keywordsAdded: ['cloud', 'leadership'],
      impactPoints: 5,
    };

    it('should create a modify request with all required fields', () => {
      const request: ModifyChangeRequest = {
        originalChange: mockProposedChange,
        modifyPrompt: 'Make it more concise and add metrics',
        jobDescription: 'Senior Engineering Manager role at Google...',
      };

      expect(request.originalChange).toEqual(mockProposedChange);
      expect(request.modifyPrompt).toBe('Make it more concise and add metrics');
      expect(request.jobDescription).toBe('Senior Engineering Manager role at Google...');
    });
  });

  describe('ModifyChangeResponse', () => {
    it('should contain the revised change', () => {
      const response: ModifyChangeResponse = {
        revisedChange: {
          section: 'summary',
          original: 'Original summary text',
          modified: 'Revised summary with metrics: led 50+ engineers',
          reason: 'Added metrics per user request',
          keywordsAdded: ['cloud', 'leadership', 'engineers'],
          impactPoints: 5,
        },
      };

      expect(response.revisedChange.modified).toContain('50+ engineers');
      expect(response.revisedChange.keywordsAdded).toContain('engineers');
    });
  });
});
