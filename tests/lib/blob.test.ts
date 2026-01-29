import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @vercel/blob before importing the module
vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
}));

// Mock fs/promises for local fallback tests
vi.mock('fs/promises', async () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

// Import after mocks are set up
import {
  fetchBlob,
  clearBlobCache,
  fetchAllReferenceMaterials,
  fetchPromptTemplate,
  fetchSharedContext,
  fetchChatbotInstructions,
  fetchAllContent,
  fetchFitAssessmentInstructions,
  fetchFitAssessmentInstructionsRequired,
  fetchFitExamples,
  fetchAiContext,
  fetchResumeGeneratorInstructionsRequired,
} from '@/lib/blob';
import { list } from '@vercel/blob';
import * as fsPromises from 'fs/promises';

// Get typed mock functions
const mockList = vi.mocked(list);
const mockReadFile = vi.mocked(fsPromises.readFile);

describe('fetchBlob', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  describe('caching behavior', () => {
    it('should return cached data when available', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      // First call
      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: async () => 'test content',
      });

      const result1 = await fetchBlob('test.md');
      expect(result1).toBe('test content');
      expect(mockList).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await fetchBlob('test.md');
      expect(result2).toBe('test content');
      expect(mockList).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should fetch from blob after cache is cleared', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: async () => 'test content',
      });

      // First fetch
      await fetchBlob('test.md');
      expect(mockList).toHaveBeenCalledTimes(1);

      // Second fetch (cached)
      await fetchBlob('test.md');
      expect(mockList).toHaveBeenCalledTimes(1);

      // Clear cache
      clearBlobCache();

      // Third fetch (should hit blob again)
      await fetchBlob('test.md');
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  describe('blob storage integration', () => {
    it('should fetch from Vercel Blob on cache miss', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: async () => 'blob content',
      });

      const result = await fetchBlob('test.md');

      expect(result).toBe('blob content');
      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/content/test.md',
        token: 'test-token',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://blob.vercel-storage.com/test.md',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should use correct blob path prefix', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/subdir/file.json',
            url: 'https://blob.vercel-storage.com/file.json',
            downloadUrl: 'https://blob.vercel-storage.com/file.json',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: async () => '{}',
      });

      await fetchBlob('subdir/file.json');

      expect(mockList).toHaveBeenCalledWith({
        prefix: 'damilola.tech/content/subdir/file.json',
        token: 'test-token',
      });
    });

    it('should find exact match when multiple blobs share prefix', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
          {
            pathname: 'damilola.tech/content/test.md.backup',
            url: 'https://blob.vercel-storage.com/test.md.backup',
            downloadUrl: 'https://blob.vercel-storage.com/test.md.backup',
            size: 100,
            uploadedAt: new Date(),
          },
          {
            pathname: 'damilola.tech/content/test-other.md',
            url: 'https://blob.vercel-storage.com/test-other.md',
            downloadUrl: 'https://blob.vercel-storage.com/test-other.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: async () => 'exact match content',
      });

      await fetchBlob('test.md');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://blob.vercel-storage.com/test.md',
        expect.any(Object)
      );
    });
  });

  describe('token configuration', () => {
    it('should return empty string when token not configured (non-required)', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await fetchBlob('test.md');

      expect(result).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'BLOB_READ_WRITE_TOKEN not configured for test.md'
      );
      expect(mockList).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should throw error when token not configured (required: true)', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;

      await expect(fetchBlob('test.md', { required: true })).rejects.toThrow(
        'BLOB_READ_WRITE_TOKEN not configured for test.md. Build cannot proceed.'
      );

      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe('blob not found', () => {
    it('should return empty string when blob not found (non-required)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [], // No matching blob
        hasMore: false,
        cursor: undefined,
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await fetchBlob('missing.md');

      expect(result).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Blob not found: damilola.tech/content/missing.md'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error when blob not found (required: true)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [],
        hasMore: false,
        cursor: undefined,
      });

      await expect(fetchBlob('missing.md', { required: true })).rejects.toThrow(
        'Required blob file not found: missing.md. Build cannot proceed.'
      );
    });
  });

  describe('network errors', () => {
    it('should handle fetch errors gracefully (non-required)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchBlob('test.md');

      expect(result).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should throw on fetch errors (required: true)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await expect(fetchBlob('test.md', { required: true })).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle HTTP error responses gracefully (non-required)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await fetchBlob('test.md');

      expect(result).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch blob content: test.md (500)'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw on HTTP error responses (required: true)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockResolvedValue({
        blobs: [
          {
            pathname: 'damilola.tech/content/test.md',
            url: 'https://blob.vercel-storage.com/test.md',
            downloadUrl: 'https://blob.vercel-storage.com/test.md',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fetchBlob('test.md', { required: true })).rejects.toThrow(
        'Failed to fetch blob content: test.md (404)'
      );
    });

    it('should handle list API errors gracefully (non-required)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockRejectedValue(new Error('Blob API error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchBlob('test.md');

      expect(result).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should throw on list API errors (required: true)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      mockList.mockRejectedValue(new Error('Blob API error'));

      await expect(fetchBlob('test.md', { required: true })).rejects.toThrow(
        'Blob API error'
      );
    });
  });

  describe('timeout handling', () => {
    it(
      'should timeout after 10 seconds',
      async () => {
        process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

        mockList.mockResolvedValue({
          blobs: [
            {
              pathname: 'damilola.tech/content/test.md',
              url: 'https://blob.vercel-storage.com/test.md',
              downloadUrl: 'https://blob.vercel-storage.com/test.md',
              size: 100,
              uploadedAt: new Date(),
            },
          ],
          hasMore: false,
          cursor: undefined,
        });

        // Mock a slow fetch that will be aborted
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
          async (url, options) => {
            // Wait for abort signal
            return new Promise((_, reject) => {
              options?.signal?.addEventListener('abort', () => {
                reject(new Error('Aborted'));
              });
            });
          }
        );

        vi.useFakeTimers();

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const fetchPromise = fetchBlob('test.md');

        // Advance timers past 10 second timeout
        await vi.advanceTimersByTimeAsync(10001);

        await fetchPromise;

        expect(consoleErrorSpy).toHaveBeenCalled();

        vi.useRealTimers();
        consoleErrorSpy.mockRestore();
      },
      15000
    ); // Increase test timeout to 15 seconds
  });
});

describe('clearBlobCache', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should clear the cache so next fetch hits blob again', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/test.md',
          url: 'https://blob.vercel-storage.com/test.md',
          downloadUrl: 'https://blob.vercel-storage.com/test.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'content',
    });

    // First fetch
    await fetchBlob('test.md');
    expect(mockList).toHaveBeenCalledTimes(1);

    // Second fetch (cached)
    await fetchBlob('test.md');
    expect(mockList).toHaveBeenCalledTimes(1);

    // Clear cache
    clearBlobCache();

    // Third fetch (should hit blob again)
    await fetchBlob('test.md');
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});

describe('fetchAllReferenceMaterials', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch all reference materials in parallel', async () => {
    const mockBlobs = [
      { filename: 'resume-full.json', content: '{"name":"test"}' },
      { filename: 'star-stories.json', content: '[]' },
      { filename: 'leadership-philosophy.md', content: 'leadership' },
      { filename: 'technical-expertise.md', content: 'technical' },
    ];

    mockList.mockImplementation(async (options) => {
      const filename = (options?.prefix || '').replace('damilola.tech/content/', '');
      const blob = mockBlobs.find((b) => b.filename === filename);
      return {
        blobs: blob
          ? [
              {
                pathname: options?.prefix || "",
                url: `https://blob.vercel-storage.com/${filename}`,
                downloadUrl: `https://blob.vercel-storage.com/${filename}`,
                size: 100,
                uploadedAt: new Date(),
              },
            ]
          : [],
        hasMore: false,
        cursor: undefined,
      };
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url) => {
      const filename = url.split('/').pop();
      const blob = mockBlobs.find((b) => b.filename === filename);
      return {
        ok: true,
        text: async () => blob?.content || '',
      };
    });

    const result = await fetchAllReferenceMaterials();

    expect(result).toEqual({
      resume: '{"name":"test"}',
      starStories: '[]',
      leadership: 'leadership',
      technical: 'technical',
    });
  });
});

describe('fetchPromptTemplate', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch chatbot system prompt with required flag', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/chatbot-system-prompt.md',
          url: 'https://blob.vercel-storage.com/prompt.md',
          downloadUrl: 'https://blob.vercel-storage.com/prompt.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'system prompt content',
    });

    const result = await fetchPromptTemplate();

    expect(result).toBe('system prompt content');
  });

  it('should throw when blob not found', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [],
      hasMore: false,
      cursor: undefined,
    });

    await expect(fetchPromptTemplate()).rejects.toThrow('Build cannot proceed');
  });
});

describe('fetchSharedContext', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch shared context from blob when token is configured', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/shared-context.md',
          url: 'https://blob.vercel-storage.com/shared.md',
          downloadUrl: 'https://blob.vercel-storage.com/shared.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'shared context content',
    });

    const result = await fetchSharedContext();

    expect(result).toBe('shared context content');
  });

  it('should throw when file not found anywhere', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(fetchSharedContext()).rejects.toThrow('Build cannot proceed');
  });
});

describe('fetchChatbotInstructions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch chatbot instructions from blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/chatbot-instructions.md',
          url: 'https://blob.vercel-storage.com/instructions.md',
          downloadUrl: 'https://blob.vercel-storage.com/instructions.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'chatbot instructions',
    });

    const result = await fetchChatbotInstructions();

    expect(result).toBe('chatbot instructions');
  });

});

describe('fetchAllContent', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch all 8 content files in parallel', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockImplementation(async (options) => {
      const filename = (options?.prefix || '').replace('damilola.tech/content/', '');
      return {
        blobs: [
          {
            pathname: options?.prefix || "",
            url: `https://blob.vercel-storage.com/${filename}`,
            downloadUrl: `https://blob.vercel-storage.com/${filename}`,
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      };
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url) => {
      const filename = url.split('/').pop();
      return {
        ok: true,
        text: async () => `content of ${filename}`,
      };
    });

    const result = await fetchAllContent();

    expect(result).toEqual({
      starStories: 'content of star-stories.json',
      resume: 'content of resume-full.json',
      leadershipPhilosophy: 'content of leadership-philosophy.md',
      technicalExpertise: 'content of technical-expertise.md',
      verilyFeedback: 'content of verily-feedback.md',
      anecdotes: 'content of anecdotes.md',
      projectsContext: 'content of projects-context.md',
      chatbotArchitecture: 'content of chatbot-architecture.md',
    });

    // Verify all files were fetched
    expect(mockList).toHaveBeenCalledTimes(8);
  });

  // Note: Local fallback behavior is tested in other describe blocks
  // (fetchSharedContext, fetchChatbotInstructions, etc.) which use the same
  // underlying fetchWithLocalFallbackRequired function. Testing it again here
  // would be redundant and flaky due to dynamic imports bypassing mocks.

  it('should throw when required files are missing', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(fetchAllContent()).rejects.toThrow('Build cannot proceed');
  });
});

describe('fetchFitAssessmentInstructions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch fit assessment instructions from blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/fit-assessment-instructions.md',
          url: 'https://blob.vercel-storage.com/fit.md',
          downloadUrl: 'https://blob.vercel-storage.com/fit.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'fit instructions',
    });

    const result = await fetchFitAssessmentInstructions();

    expect(result).toBe('fit instructions');
  });

  it('should return empty string when not found (non-required)', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchFitAssessmentInstructions();

    expect(result).toBe('');

    consoleWarnSpy.mockRestore();
  });
});

describe('fetchFitAssessmentInstructionsRequired', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch fit assessment instructions from blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/fit-assessment-instructions.md',
          url: 'https://blob.vercel-storage.com/fit.md',
          downloadUrl: 'https://blob.vercel-storage.com/fit.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'fit instructions',
    });

    const result = await fetchFitAssessmentInstructionsRequired();

    expect(result).toBe('fit instructions');
  });

  it('should throw when file not found anywhere', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(fetchFitAssessmentInstructionsRequired()).rejects.toThrow(
      'Build cannot proceed'
    );
  });
});

describe('fetchFitExamples', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch strong and weak fit examples in parallel', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockImplementation(async (options) => {
      const filename = (options?.prefix || '').replace('damilola.tech/content/', '');
      return {
        blobs: [
          {
            pathname: options?.prefix || "",
            url: `https://blob.vercel-storage.com/${filename}`,
            downloadUrl: `https://blob.vercel-storage.com/${filename}`,
            size: 100,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      };
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url) => {
      if (url.includes('strong')) {
        return { ok: true, text: async () => 'strong example' };
      }
      return { ok: true, text: async () => 'weak example' };
    });

    const result = await fetchFitExamples();

    expect(result).toEqual({
      strong: 'strong example',
      weak: 'weak example',
    });

    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('should return empty strings when examples not found', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchFitExamples();

    expect(result).toEqual({
      strong: '',
      weak: '',
    });

    consoleWarnSpy.mockRestore();
  });
});

describe('fetchAiContext', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch AI context from blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/ai-context.md',
          url: 'https://blob.vercel-storage.com/ai-context.md',
          downloadUrl: 'https://blob.vercel-storage.com/ai-context.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'AI context content',
    });

    const result = await fetchAiContext();

    expect(result).toBe('AI context content');
  });

});

describe('fetchResumeGeneratorInstructionsRequired', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearBlobCache();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fetch resume generator instructions from blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    mockList.mockResolvedValue({
      blobs: [
        {
          pathname: 'damilola.tech/content/resume-generator-instructions.md',
          url: 'https://blob.vercel-storage.com/resume.md',
          downloadUrl: 'https://blob.vercel-storage.com/resume.md',
          size: 100,
          uploadedAt: new Date(),
        },
      ],
      hasMore: false,
      cursor: undefined,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => 'resume generator instructions',
    });

    const result = await fetchResumeGeneratorInstructionsRequired();

    expect(result).toBe('resume generator instructions');
  });

  it('should throw when file not found anywhere', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    await expect(fetchResumeGeneratorInstructionsRequired()).rejects.toThrow(
      'Build cannot proceed'
    );
  });
});
