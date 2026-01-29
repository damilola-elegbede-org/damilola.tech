import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AiContext } from '@/types';

// Mock dependencies
const mockFetchAiContext = vi.fn();
const mockParseAiContext = vi.fn();

vi.mock('@/lib/blob', () => ({
  fetchAiContext: mockFetchAiContext,
}));

vi.mock('@/lib/parse-ai-context', () => ({
  parseAiContext: mockParseAiContext,
}));

describe('ai-context API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const mockMarkdown = `# AI Context

## verily-health

### Strategic Context
Led platform modernization initiative.

### Leadership Challenge
Balanced innovation with stability.

### Key Insight
Technical leadership requires strategic vision.

## google-cloud

### Strategic Context
Drove cloud platform adoption.

### Leadership Challenge
Scaled team from 5 to 20 engineers.

### Key Insight
Mentorship amplifies impact.`;

  const mockContextMap = new Map<string, AiContext>([
    [
      'verily-health',
      {
        strategicContext: 'Led platform modernization initiative.',
        leadershipChallenge: 'Balanced innovation with stability.',
        keyInsight: 'Technical leadership requires strategic vision.',
      },
    ],
    [
      'google-cloud',
      {
        strategicContext: 'Drove cloud platform adoption.',
        leadershipChallenge: 'Scaled team from 5 to 20 engineers.',
        keyInsight: 'Mentorship amplifies impact.',
      },
    ],
  ]);

  describe('GET request', () => {
    it('returns AI context data with correct structure', async () => {
      mockFetchAiContext.mockResolvedValue(mockMarkdown);
      mockParseAiContext.mockReturnValue(mockContextMap);

      const { GET } = await import('@/app/api/ai-context/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockFetchAiContext).toHaveBeenCalledTimes(1);
      expect(mockParseAiContext).toHaveBeenCalledWith(mockMarkdown);

      // Verify response structure
      expect(data).toHaveProperty('verily-health');
      expect(data).toHaveProperty('google-cloud');

      // Verify verily-health context
      expect(data['verily-health']).toEqual({
        strategicContext: 'Led platform modernization initiative.',
        leadershipChallenge: 'Balanced innovation with stability.',
        keyInsight: 'Technical leadership requires strategic vision.',
      });

      // Verify google-cloud context
      expect(data['google-cloud']).toEqual({
        strategicContext: 'Drove cloud platform adoption.',
        leadershipChallenge: 'Scaled team from 5 to 20 engineers.',
        keyInsight: 'Mentorship amplifies impact.',
      });
    });

    it('returns correct cache-control headers', async () => {
      mockFetchAiContext.mockResolvedValue(mockMarkdown);
      mockParseAiContext.mockReturnValue(mockContextMap);

      const { GET } = await import('@/app/api/ai-context/route');

      const response = await GET();

      // Verify cache headers for CDN caching
      expect(response.headers.get('Cache-Control')).toBe(
        'public, s-maxage=3600, stale-while-revalidate=86400'
      );
    });

    it('converts Map to plain object for JSON serialization', async () => {
      mockFetchAiContext.mockResolvedValue(mockMarkdown);
      mockParseAiContext.mockReturnValue(mockContextMap);

      const { GET } = await import('@/app/api/ai-context/route');

      const response = await GET();
      const data = await response.json();

      // Ensure it's a plain object, not a Map
      expect(Array.isArray(data)).toBe(false);
      expect(data.constructor).toBe(Object);
      expect(Object.keys(data)).toEqual(
        expect.arrayContaining(['verily-health', 'google-cloud'])
      );
      expect(Object.keys(data)).toHaveLength(2);
    });

    it('returns empty object when no context is found', async () => {
      mockFetchAiContext.mockResolvedValue('');
      mockParseAiContext.mockReturnValue(new Map());

      const { GET } = await import('@/app/api/ai-context/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({});
    });

    it('handles single experience context', async () => {
      const singleContextMap = new Map<string, AiContext>([
        [
          'solo-experience',
          {
            strategicContext: 'Single context',
            leadershipChallenge: 'Solo challenge',
            keyInsight: 'Solo insight',
          },
        ],
      ]);

      mockFetchAiContext.mockResolvedValue(mockMarkdown);
      mockParseAiContext.mockReturnValue(singleContextMap);

      const { GET } = await import('@/app/api/ai-context/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Object.keys(data)).toEqual(['solo-experience']);
      expect(data['solo-experience']).toEqual({
        strategicContext: 'Single context',
        leadershipChallenge: 'Solo challenge',
        keyInsight: 'Solo insight',
      });
    });
  });

  describe('error handling', () => {
    it('returns 500 when fetchAiContext throws error', async () => {
      mockFetchAiContext.mockRejectedValue(new Error('Blob fetch failed'));

      const { GET } = await import('@/app/api/ai-context/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to fetch AI context' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching AI context:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when parseAiContext throws error', async () => {
      mockFetchAiContext.mockResolvedValue(mockMarkdown);
      mockParseAiContext.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const { GET } = await import('@/app/api/ai-context/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to fetch AI context' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching AI context:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('logs error to console when fetch fails', async () => {
      const testError = new Error('Network timeout');
      mockFetchAiContext.mockRejectedValue(testError);

      const { GET } = await import('@/app/api/ai-context/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await GET();

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching AI context:', testError);

      consoleSpy.mockRestore();
    });
  });

  describe('runtime configuration', () => {
    it('uses nodejs runtime', async () => {
      const route = await import('@/app/api/ai-context/route');

      expect(route.runtime).toBe('nodejs');
    });
  });
});
