import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the blob module
vi.mock('@/lib/blob', () => ({
  fetchFitExamples: vi.fn(),
}));

describe('fit-examples API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('GET', () => {
    it('returns examples array with strong and weak examples', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      const mockExamples = {
        strong: '# Strong Example\n\nThis is a strong fit example.',
        weak: '# Weak Example\n\nThis is a weak fit example.',
      };

      vi.mocked(fetchFitExamples).mockResolvedValue(mockExamples);

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockExamples);
      expect(data.strong).toBe('# Strong Example\n\nThis is a strong fit example.');
      expect(data.weak).toBe('# Weak Example\n\nThis is a weak fit example.');
      expect(fetchFitExamples).toHaveBeenCalledTimes(1);
    });

    it('handles empty examples gracefully', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      const mockExamples = {
        strong: '',
        weak: '',
      };

      vi.mocked(fetchFitExamples).mockResolvedValue(mockExamples);

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockExamples);
      expect(data.strong).toBe('');
      expect(data.weak).toBe('');
    });

    it('returns 500 on fetchFitExamples error', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      vi.mocked(fetchFitExamples).mockRejectedValue(new Error('Blob storage error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load examples');
      expect(response.headers.get('Content-Type')).toBe('application/json');

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch fit examples:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 500 when fetchFitExamples throws network error', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      vi.mocked(fetchFitExamples).mockRejectedValue(new Error('Network timeout'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to load examples');

      // Verify the specific error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch fit examples:',
        expect.objectContaining({ message: 'Network timeout' })
      );

      consoleSpy.mockRestore();
    });

    it('returns JSON response with correct content type header', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      const mockExamples = {
        strong: 'Strong example content',
        weak: 'Weak example content',
      };

      vi.mocked(fetchFitExamples).mockResolvedValue(mockExamples);

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();

      // Response.json() automatically sets Content-Type to application/json
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.status).toBe(200);
    });

    it('handles markdown formatting in examples', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      const mockExamples = {
        strong: `# Strong Fit Example

## Overview
This candidate demonstrates **excellent** alignment.

### Key Points
- Technical expertise
- Leadership experience
- Cultural fit`,
        weak: `# Weak Fit Example

## Overview
This candidate shows *limited* alignment.

### Concerns
1. Lacks required skills
2. Experience mismatch
3. Culture concerns`,
      };

      vi.mocked(fetchFitExamples).mockResolvedValue(mockExamples);

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.strong).toContain('**excellent**');
      expect(data.strong).toContain('### Key Points');
      expect(data.weak).toContain('*limited*');
      expect(data.weak).toContain('1. Lacks required skills');
    });

    it('handles special characters in examples', async () => {
      const { fetchFitExamples } = await import('@/lib/blob');

      const mockExamples = {
        strong: 'Example with special chars: & < > " \' `',
        weak: 'Example with unicode: \u00A9 \u2603 \u{1F600}',
      };

      vi.mocked(fetchFitExamples).mockResolvedValue(mockExamples);

      const { GET } = await import('@/app/api/fit-examples/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.strong).toBe('Example with special chars: & < > " \' `');
      expect(data.weak).toBe('Example with unicode: \u00A9 \u2603 \u{1F600}');
    });

    it('uses nodejs runtime for local file fallback', async () => {
      const { runtime } = await import('@/app/api/fit-examples/route');

      expect(runtime).toBe('nodejs');
    });
  });
});
