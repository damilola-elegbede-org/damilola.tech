import { describe, it, expect } from 'vitest';
import {
  isValidChatFilename,
  parseChatFilename,
  extractTimestampFromFilename,
} from '@/lib/chat-filename';

describe('chat-filename utilities', () => {
  describe('isValidChatFilename', () => {
    it('validates unified format (NEW)', () => {
      expect(isValidChatFilename('chat-2026-01-28T10-30-00Z-abc12345.json')).toBe(
        true
      );
    });

    it('validates old live format (chat-{uuid})', () => {
      expect(
        isValidChatFilename(
          'chat-939d8245-20b8-49b3-9e1b-746232af362e.json'
        )
      ).toBe(true);
    });

    it('validates old archive format ({timestamp}-{shortId})', () => {
      expect(isValidChatFilename('2026-01-28T10-30-00Z-abc12345.json')).toBe(
        true
      );
      expect(
        isValidChatFilename('2026-01-28T10-30-00Z-abc12345-randomSuffix.json')
      ).toBe(true);
    });

    it('validates legacy format ({uuid})', () => {
      expect(
        isValidChatFilename('550e8400-e29b-41d4-a716-446655440000.json')
      ).toBe(true);
    });

    it('rejects invalid filenames', () => {
      expect(isValidChatFilename('invalid.json')).toBe(false);
      expect(isValidChatFilename('')).toBe(false);
    });
  });

  describe('parseChatFilename', () => {
    it('parses unified format with timestamp', () => {
      const result = parseChatFilename(
        'chat-2026-01-28T10-30-00Z-abc12345.json'
      );
      expect(result).toEqual({
        format: 'unified',
        sessionId: 'abc12345',
        timestamp: '2026-01-28T10:30:00.000Z',
        filename: 'chat-2026-01-28T10-30-00Z-abc12345.json',
      });
    });

    it('parses old live format with fallback timestamp', () => {
      const result = parseChatFilename(
        'chat-939d8245-20b8-49b3-9e1b-746232af362e.json',
        '2026-01-28T12:00:00.000Z'
      );
      expect(result?.format).toBe('chatPrefixUuid');
      expect(result?.sessionId).toBe('939d8245');
      expect(result?.timestamp).toBe('2026-01-28T12:00:00.000Z');
    });

    it('parses old live format without fallback timestamp', () => {
      const result = parseChatFilename(
        'chat-939d8245-20b8-49b3-9e1b-746232af362e.json'
      );
      expect(result?.format).toBe('chatPrefixUuid');
      expect(result?.sessionId).toBe('939d8245');
      expect(result?.timestamp).toBeNull();
    });

    it('parses old archive format', () => {
      const result = parseChatFilename('2026-01-28T10-30-00Z-abc12345.json');
      expect(result?.format).toBe('timestampShortId');
      expect(result?.sessionId).toBe('abc12345');
      expect(result?.timestamp).toBe('2026-01-28T10:30:00.000Z');
    });

    it('parses old archive format with random suffix', () => {
      const result = parseChatFilename(
        '2026-01-28T10-30-00Z-abc12345-randomSuffix.json'
      );
      expect(result?.format).toBe('timestampShortId');
      expect(result?.sessionId).toBe('abc12345');
      expect(result?.timestamp).toBe('2026-01-28T10:30:00.000Z');
    });

    it('parses legacy format', () => {
      const result = parseChatFilename(
        '550e8400-e29b-41d4-a716-446655440000.json'
      );
      expect(result?.format).toBe('legacy');
      expect(result?.sessionId).toBe('550e8400');
      expect(result?.timestamp).toBeNull();
    });

    it('parses legacy format with fallback timestamp', () => {
      const result = parseChatFilename(
        '550e8400-e29b-41d4-a716-446655440000.json',
        '2026-01-28T12:00:00.000Z'
      );
      expect(result?.format).toBe('legacy');
      expect(result?.sessionId).toBe('550e8400');
      expect(result?.timestamp).toBe('2026-01-28T12:00:00.000Z');
    });

    it('returns null for invalid filenames', () => {
      expect(parseChatFilename('invalid.json')).toBeNull();
      expect(parseChatFilename('')).toBeNull();
      expect(parseChatFilename('not-a-chat-file.txt')).toBeNull();
    });
  });

  describe('extractTimestampFromFilename', () => {
    it('extracts from unified format', () => {
      const date = extractTimestampFromFilename(
        'chat-2026-01-28T10-30-00Z-abc12345.json'
      );
      expect(date?.toISOString()).toBe('2026-01-28T10:30:00.000Z');
    });

    it('extracts from old archive format', () => {
      const date = extractTimestampFromFilename(
        '2026-01-28T10-30-00Z-abc12345.json'
      );
      expect(date?.toISOString()).toBe('2026-01-28T10:30:00.000Z');
    });

    it('extracts from old archive format with random suffix', () => {
      const date = extractTimestampFromFilename(
        '2026-01-28T10-30-00Z-abc12345-randomSuffix.json'
      );
      expect(date?.toISOString()).toBe('2026-01-28T10:30:00.000Z');
    });

    it('returns null for formats without timestamp in filename', () => {
      expect(
        extractTimestampFromFilename(
          'chat-939d8245-20b8-49b3-9e1b-746232af362e.json'
        )
      ).toBeNull();
      expect(
        extractTimestampFromFilename(
          '550e8400-e29b-41d4-a716-446655440000.json'
        )
      ).toBeNull();
    });

    it('returns null for invalid filenames', () => {
      expect(extractTimestampFromFilename('invalid.json')).toBeNull();
      expect(extractTimestampFromFilename('')).toBeNull();
    });
  });
});
