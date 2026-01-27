import { describe, it, expect } from 'vitest';
import {
  FILE_ROUTING,
  CONTENT_DIRS,
  TARGET_DIRS,
  getTargetDirectory,
  isKnownFile,
  generateCommitMessage,
  isValidFilename,
  isValidResumeFilename,
  detectDuplicates,
} from '@/lib/content-utils';

describe('content-utils', () => {
  describe('FILE_ROUTING', () => {
    it('contains all expected instruction files', () => {
      expect(FILE_ROUTING['chatbot-instructions.md']).toBe('instructions');
      expect(FILE_ROUTING['fit-assessment-instructions.md']).toBe('instructions');
      expect(FILE_ROUTING['resume-generator-instructions.md']).toBe('instructions');
    });

    it('contains all expected template files', () => {
      expect(FILE_ROUTING['shared-context.md']).toBe('templates');
    });

    it('contains all expected context files', () => {
      expect(FILE_ROUTING['ai-context.md']).toBe('context');
      expect(FILE_ROUTING['anecdotes.md']).toBe('context');
      expect(FILE_ROUTING['chatbot-architecture.md']).toBe('context');
      expect(FILE_ROUTING['leadership-philosophy.md']).toBe('context');
      expect(FILE_ROUTING['projects-context.md']).toBe('context');
      expect(FILE_ROUTING['technical-expertise.md']).toBe('context');
      expect(FILE_ROUTING['verily-feedback.md']).toBe('context');
    });

    it('contains all expected data files', () => {
      expect(FILE_ROUTING['resume-full.json']).toBe('data');
      expect(FILE_ROUTING['star-stories.json']).toBe('data');
    });

    it('contains all expected example files', () => {
      expect(FILE_ROUTING['fit-example-strong.md']).toBe('examples');
      expect(FILE_ROUTING['fit-example-weak.md']).toBe('examples');
    });

    it('has exactly 15 files mapped', () => {
      expect(Object.keys(FILE_ROUTING).length).toBe(15);
    });
  });

  describe('CONTENT_DIRS', () => {
    it('contains all 5 content directories', () => {
      expect(CONTENT_DIRS).toHaveLength(5);
      expect(CONTENT_DIRS).toContain('career-data/instructions');
      expect(CONTENT_DIRS).toContain('career-data/templates');
      expect(CONTENT_DIRS).toContain('career-data/context');
      expect(CONTENT_DIRS).toContain('career-data/data');
      expect(CONTENT_DIRS).toContain('career-data/examples');
    });
  });

  describe('TARGET_DIRS', () => {
    it('contains all 5 target directories', () => {
      expect(TARGET_DIRS).toHaveLength(5);
      expect(TARGET_DIRS).toContain('instructions');
      expect(TARGET_DIRS).toContain('templates');
      expect(TARGET_DIRS).toContain('context');
      expect(TARGET_DIRS).toContain('data');
      expect(TARGET_DIRS).toContain('examples');
    });
  });

  describe('getTargetDirectory', () => {
    describe('known files (explicit routing)', () => {
      it('routes instruction files correctly', () => {
        expect(getTargetDirectory('chatbot-instructions.md')).toBe('instructions');
        expect(getTargetDirectory('fit-assessment-instructions.md')).toBe('instructions');
        expect(getTargetDirectory('resume-generator-instructions.md')).toBe('instructions');
      });

      it('routes template files correctly', () => {
        expect(getTargetDirectory('shared-context.md')).toBe('templates');
      });

      it('routes context files correctly', () => {
        expect(getTargetDirectory('ai-context.md')).toBe('context');
        expect(getTargetDirectory('leadership-philosophy.md')).toBe('context');
      });

      it('routes data files correctly', () => {
        expect(getTargetDirectory('resume-full.json')).toBe('data');
        expect(getTargetDirectory('star-stories.json')).toBe('data');
      });

      it('routes example files correctly', () => {
        expect(getTargetDirectory('fit-example-strong.md')).toBe('examples');
        expect(getTargetDirectory('fit-example-weak.md')).toBe('examples');
      });
    });

    describe('unknown files (heuristic fallback)', () => {
      it('routes *-instructions.md files to instructions', () => {
        expect(getTargetDirectory('new-feature-instructions.md')).toBe('instructions');
        expect(getTargetDirectory('test-instructions.md')).toBe('instructions');
      });

      it('routes .json files to data', () => {
        expect(getTargetDirectory('new-data.json')).toBe('data');
        expect(getTargetDirectory('config.json')).toBe('data');
      });

      it('routes fit-example-* files to examples', () => {
        expect(getTargetDirectory('fit-example-medium.md')).toBe('examples');
        expect(getTargetDirectory('fit-example-partial.md')).toBe('examples');
      });

      it('defaults unknown markdown files to context', () => {
        expect(getTargetDirectory('unknown-file.md')).toBe('context');
        expect(getTargetDirectory('new-context.md')).toBe('context');
      });

      it('defaults unknown files without extension patterns to context', () => {
        expect(getTargetDirectory('README.md')).toBe('context');
        expect(getTargetDirectory('notes.md')).toBe('context');
      });
    });
  });

  describe('isKnownFile', () => {
    it('returns true for known files', () => {
      expect(isKnownFile('chatbot-instructions.md')).toBe(true);
      expect(isKnownFile('shared-context.md')).toBe(true);
      expect(isKnownFile('resume-full.json')).toBe(true);
    });

    it('returns false for unknown files', () => {
      expect(isKnownFile('unknown-file.md')).toBe(false);
      expect(isKnownFile('new-instructions.md')).toBe(false);
      expect(isKnownFile('random.json')).toBe(false);
    });
  });

  describe('generateCommitMessage', () => {
    describe('single file changes', () => {
      it('generates message for single file', () => {
        const result = generateCommitMessage(['context/leadership-philosophy.md']);
        expect(result).toBe('chore(career-data): update leadership-philosophy.md');
      });

      it('extracts filename from path', () => {
        const result = generateCommitMessage(['instructions/chatbot-instructions.md']);
        expect(result).toBe('chore(career-data): update chatbot-instructions.md');
      });

      it('handles file without path', () => {
        const result = generateCommitMessage(['README.md']);
        expect(result).toBe('chore(career-data): update README.md');
      });
    });

    describe('multiple file changes', () => {
      it('generates message with single category', () => {
        const result = generateCommitMessage([
          'context/leadership-philosophy.md',
          'context/technical-expertise.md',
        ]);
        expect(result).toBe('chore(career-data): update context');
      });

      it('generates message with multiple categories sorted alphabetically', () => {
        const result = generateCommitMessage([
          'context/leadership-philosophy.md',
          'instructions/chatbot-instructions.md',
        ]);
        expect(result).toBe('chore(career-data): update context, instructions');
      });

      it('handles all categories', () => {
        const result = generateCommitMessage([
          'context/ai-context.md',
          'data/resume-full.json',
          'examples/fit-example-strong.md',
          'instructions/chatbot-instructions.md',
          'templates/shared-context.md',
        ]);
        expect(result).toBe('chore(career-data): update context, data, examples, instructions, templates');
      });

      it('includes resume category', () => {
        const result = generateCommitMessage([
          'resume/Damilola Elegbede Resume.pdf',
          'context/ai-context.md',
        ]);
        expect(result).toBe('chore(career-data): update context, resume');
      });

      it('defaults to content for unknown paths', () => {
        const result = generateCommitMessage(['random-file.md', 'another-file.md']);
        expect(result).toBe('chore(career-data): update content');
      });
    });
  });

  describe('isValidFilename', () => {
    it('accepts valid filenames', () => {
      expect(isValidFilename('chatbot-instructions.md')).toBe(true);
      expect(isValidFilename('resume-full.json')).toBe(true);
      expect(isValidFilename('README.md')).toBe(true);
      expect(isValidFilename('file_name.txt')).toBe(true);
      expect(isValidFilename('file.name.txt')).toBe(true);
    });

    it('rejects filenames with spaces', () => {
      expect(isValidFilename('file name.md')).toBe(false);
      expect(isValidFilename('Damilola Elegbede Resume.pdf')).toBe(false);
    });

    it('rejects filenames with path traversal characters', () => {
      expect(isValidFilename('../etc/passwd')).toBe(false);
      expect(isValidFilename('file/../other')).toBe(false);
      expect(isValidFilename('/etc/passwd')).toBe(false);
    });

    it('rejects filenames with special characters', () => {
      expect(isValidFilename('file@name.md')).toBe(false);
      expect(isValidFilename('file#name.md')).toBe(false);
      expect(isValidFilename('file$name.md')).toBe(false);
    });
  });

  describe('isValidResumeFilename', () => {
    it('accepts valid resume filenames with spaces', () => {
      expect(isValidResumeFilename('Damilola Elegbede Resume.pdf')).toBe(true);
      expect(isValidResumeFilename('John Doe - Resume.pdf')).toBe(true);
      expect(isValidResumeFilename('resume.pdf')).toBe(true);
    });

    it('rejects filenames with path traversal characters', () => {
      expect(isValidResumeFilename('../resume.pdf')).toBe(false);
      expect(isValidResumeFilename('/etc/resume.pdf')).toBe(false);
    });

    it('rejects filenames with special characters', () => {
      expect(isValidResumeFilename('resume@2024.pdf')).toBe(false);
      expect(isValidResumeFilename('resume#1.pdf')).toBe(false);
    });
  });

  describe('detectDuplicates', () => {
    it('returns empty map when no duplicates', () => {
      const files = [
        { filename: 'file1.md', sourceDir: 'dir1' },
        { filename: 'file2.md', sourceDir: 'dir2' },
        { filename: 'file3.md', sourceDir: 'dir3' },
      ];
      const result = detectDuplicates(files);
      expect(result.size).toBe(0);
    });

    it('detects single duplicate', () => {
      const files = [
        { filename: 'file1.md', sourceDir: 'dir1' },
        { filename: 'file1.md', sourceDir: 'dir2' },
        { filename: 'file2.md', sourceDir: 'dir3' },
      ];
      const result = detectDuplicates(files);
      expect(result.size).toBe(1);
      expect(result.get('file1.md')).toEqual(['dir1', 'dir2']);
    });

    it('detects multiple duplicates', () => {
      const files = [
        { filename: 'file1.md', sourceDir: 'dir1' },
        { filename: 'file1.md', sourceDir: 'dir2' },
        { filename: 'file2.md', sourceDir: 'dir1' },
        { filename: 'file2.md', sourceDir: 'dir3' },
      ];
      const result = detectDuplicates(files);
      expect(result.size).toBe(2);
      expect(result.get('file1.md')).toEqual(['dir1', 'dir2']);
      expect(result.get('file2.md')).toEqual(['dir1', 'dir3']);
    });

    it('handles triple duplicates', () => {
      const files = [
        { filename: 'file1.md', sourceDir: 'dir1' },
        { filename: 'file1.md', sourceDir: 'dir2' },
        { filename: 'file1.md', sourceDir: 'dir3' },
      ];
      const result = detectDuplicates(files);
      expect(result.size).toBe(1);
      expect(result.get('file1.md')).toEqual(['dir1', 'dir2', 'dir3']);
    });

    it('handles empty input', () => {
      const result = detectDuplicates([]);
      expect(result.size).toBe(0);
    });
  });
});
