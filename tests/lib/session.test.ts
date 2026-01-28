import { describe, it, expect } from 'vitest';
import { truncateSessionId } from '@/lib/session';

describe('truncateSessionId', () => {
  describe('known prefixed patterns', () => {
    it('returns full string for short chat- prefixed IDs', () => {
      const shortId = 'chat-abc12345';
      expect(truncateSessionId(shortId)).toBe(shortId);
    });

    it('truncates long chat- prefixed IDs to prefix + 8 chars', () => {
      const longId = 'chat-12345678-9abc-def0-1234-567890abcdef';
      expect(truncateSessionId(longId)).toBe('chat-12345678...');
    });

    it('returns full string for short fit-assessment- prefixed IDs', () => {
      const shortId = 'fit-assessment-abc123';
      expect(truncateSessionId(shortId)).toBe(shortId);
    });

    it('truncates long fit-assessment- prefixed IDs', () => {
      const longId = 'fit-assessment-12345678-9abc-def0-1234-567890abcdef';
      expect(truncateSessionId(longId)).toBe('fit-assessment-12345678...');
    });

    it('returns full string for short resume-generator- prefixed IDs', () => {
      const shortId = 'resume-generator-abc12';
      expect(truncateSessionId(shortId)).toBe(shortId);
    });

    it('truncates long resume-generator- prefixed IDs', () => {
      const longId = 'resume-generator-12345678-9abc-def0-1234-567890abcdef';
      expect(truncateSessionId(longId)).toBe('resume-generator-12345678...');
    });

    it('does not truncate prefixed IDs under 30 chars', () => {
      const exactlyThirty = 'chat-123456789012345678901234'; // 30 chars
      expect(truncateSessionId(exactlyThirty)).toBe(exactlyThirty);
    });

    it('truncates prefixed IDs over 30 chars', () => {
      const overThirty = 'chat-12345678901234567890123456'; // 31 chars
      expect(truncateSessionId(overThirty)).toBe('chat-12345678...');
    });
  });

  describe('legacy anonymous patterns', () => {
    it('returns "anonymous" unchanged', () => {
      expect(truncateSessionId('anonymous')).toBe('anonymous');
    });

    it('returns short *-anonymous patterns unchanged', () => {
      const shortAnon = 'user123-anonymous'; // 17 chars, ends with -anonymous
      expect(truncateSessionId(shortAnon)).toBe(shortAnon);
    });

    it('returns *-anonymous patterns up to 30 chars unchanged', () => {
      const thirtyChars = '12345678901234567890-anonymous'; // exactly 30 chars
      expect(truncateSessionId(thirtyChars)).toBe(thirtyChars);
    });

    it('truncates long *-anonymous patterns over 30 chars', () => {
      const longAnon = '123456789012345678901-anonymous'; // 31 chars
      // This doesn't match known prefixes, isn't exactly 'anonymous',
      // and is > 30 so doesn't pass the -anonymous check
      // Falls through to plain UUID handling
      expect(truncateSessionId(longAnon)).toBe('12345678...');
    });
  });

  describe('plain UUIDs and short strings', () => {
    it('returns short IDs (<=12 chars) unchanged', () => {
      const shortId = 'abc123456789'; // 12 chars
      expect(truncateSessionId(shortId)).toBe(shortId);
    });

    it('truncates IDs over 12 chars to first 8 + ellipsis', () => {
      const longId = 'abc1234567890'; // 13 chars
      expect(truncateSessionId(longId)).toBe('abc12345...');
    });

    it('truncates full UUIDs', () => {
      const uuid = '12345678-9abc-def0-1234-567890abcdef';
      expect(truncateSessionId(uuid)).toBe('12345678...');
    });

    it('handles empty string', () => {
      expect(truncateSessionId('')).toBe('');
    });

    it('handles single character', () => {
      expect(truncateSessionId('a')).toBe('a');
    });
  });
});
