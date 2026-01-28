import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the blob module before importing system-prompt
vi.mock('@/lib/blob', () => ({
  fetchAllReferenceMaterials: vi.fn(),
  fetchFitAssessmentInstructions: vi.fn(),
}));

// Import after mocks are set up
import {
  getFullSystemPrompt,
  getSharedContext,
  getFitAssessmentPrompt,
  clearSystemPromptCache,
} from '@/lib/system-prompt';
import {
  fetchAllReferenceMaterials,
  fetchFitAssessmentInstructions,
} from '@/lib/blob';

// Get typed mock functions
const mockFetchAllReferenceMaterials = vi.mocked(fetchAllReferenceMaterials);
const mockFetchFitAssessmentInstructions = vi.mocked(fetchFitAssessmentInstructions);

describe('getFullSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSystemPromptCache();
  });

  it('should build full system prompt with all reference materials', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: '# Resume Content\nExperience details',
      starStories: '# STAR Stories\nAchievement examples',
      leadership: '# Leadership Philosophy\nDetailed leadership approach',
      technical: '# Technical Expertise\nDetailed technical skills',
    });

    const result = await getFullSystemPrompt();

    // Verify it includes shared context sections
    expect(result).toContain('# Damilola Elegbede - Professional Context');
    expect(result).toContain('## Core Leadership Philosophy');
    expect(result).toContain('### 3P Framework');
    expect(result).toContain('People, Process, Product');
    expect(result).toContain('## Professional Profile');
    expect(result).toContain('damilola.elegbede@gmail.com');
    expect(result).toContain('linkedin.com/in/damilola-elegbede/');

    // Verify it includes reference materials
    expect(result).toContain('# Resume Content');
    expect(result).toContain('Experience details');
    expect(result).toContain('# STAR Stories');
    expect(result).toContain('Achievement examples');
    expect(result).toContain('# Leadership Philosophy');
    expect(result).toContain('Detailed leadership approach');
    expect(result).toContain('# Technical Expertise');
    expect(result).toContain('Detailed technical skills');

    // Verify it includes chatbot-specific instructions
    expect(result).toContain('## Chatbot Behavior Instructions');
    expect(result).toContain('### Your Identity');
    expect(result).toContain('You are an AI assistant representing **Damilola Elegbede**');
    expect(result).toContain('### How to Answer Questions');
    expect(result).toContain('### Topics to Redirect');
    expect(result).toContain('### Tone Guidelines');
    expect(result).toContain('### Response Formatting');

    // Verify fetch was called
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
  });

  it('should handle missing optional reference materials', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: '',
      starStories: '',
      leadership: '',
      technical: '',
    });

    const result = await getFullSystemPrompt();

    // Should still include base structure
    expect(result).toContain('# Damilola Elegbede - Professional Context');
    expect(result).toContain('## Chatbot Behavior Instructions');

    // Should include fallback messages for missing content
    expect(result).toContain('No resume content available');
    expect(result).toContain('No STAR stories available');
    expect(result).toContain('No leadership philosophy content available');
    expect(result).toContain('No technical expertise content available');
  });

  it('should cache the system prompt on subsequent calls', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    // First call
    const result1 = await getFullSystemPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await getFullSystemPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1); // Still only called once
    expect(result2).toBe(result1);
  });

  it('should return string with proper structure and formatting', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getFullSystemPrompt();

    // Should be a non-empty string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    // Should have proper markdown structure
    expect(result).toMatch(/^# /m); // Contains h1 headings
    expect(result).toMatch(/^## /m); // Contains h2 headings
    expect(result).toMatch(/^### /m); // Contains h3 headings

    // Should not have trailing whitespace
    expect(result).not.toMatch(/\s+$/);
  });

  it('should include all required contact information', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getFullSystemPrompt();

    expect(result).toContain('Damilola Elegbede');
    expect(result).toContain('Engineering Manager');
    expect(result).toContain('Boulder, CO 80301');
    expect(result).toContain('damilola.elegbede@gmail.com');
    expect(result).toContain('linkedin.com/in/damilola-elegbede/');
  });

  it('should include target roles', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getFullSystemPrompt();

    expect(result).toContain('### Target Roles');
    expect(result).toContain('Engineering Manager');
    expect(result).toContain('Senior Engineering Manager');
    expect(result).toContain('Director of Engineering');
  });
});

describe('getSharedContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSystemPromptCache();
  });

  it('should build shared context without chatbot instructions', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume content',
      starStories: 'STAR stories',
      leadership: 'Leadership philosophy',
      technical: 'Technical expertise',
    });

    const result = await getSharedContext();

    // Should include shared context sections
    expect(result).toContain('# Damilola Elegbede - Professional Context');
    expect(result).toContain('## Core Leadership Philosophy');
    expect(result).toContain('## Professional Profile');
    expect(result).toContain('## Professional Experience');
    expect(result).toContain('## STAR Achievement Stories');
    expect(result).toContain('## Leadership Philosophy (Detailed)');
    expect(result).toContain('## Technical Expertise (Detailed)');

    // Should include reference materials
    expect(result).toContain('Resume content');
    expect(result).toContain('STAR stories');
    expect(result).toContain('Leadership philosophy');
    expect(result).toContain('Technical expertise');

    // Should NOT include chatbot-specific instructions
    expect(result).not.toContain('## Chatbot Behavior Instructions');
    expect(result).not.toContain('### Your Identity');
    expect(result).not.toContain('You are an AI assistant');
  });

  it('should handle missing optional data gracefully', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: '',
      starStories: '',
      leadership: '',
      technical: '',
    });

    const result = await getSharedContext();

    expect(result).toContain('No resume content available');
    expect(result).toContain('No STAR stories available');
    expect(result).toContain('No leadership philosophy content available');
    expect(result).toContain('No technical expertise content available');
  });

  it('should cache the shared context on subsequent calls', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    // First call
    const result1 = await getSharedContext();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await getSharedContext();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
    expect(result2).toBe(result1);
  });

  it('should include 3P Framework details', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getSharedContext();

    expect(result).toContain('### 3P Framework');
    expect(result).toContain('People, Process, Product');
    expect(result).toContain('Strong teams with clear processes');
  });

  it('should include guiding principles', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getSharedContext();

    expect(result).toContain('### Guiding Principles');
    expect(result).toContain('**Servant Leadership**');
    expect(result).toContain('**Growth Mindset**');
    expect(result).toContain('**Inclusion**');
  });

  it('should include hiring philosophy', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getSharedContext();

    expect(result).toContain('### Hiring Philosophy');
    expect(result).toContain('**Ownership mentality**');
    expect(result).toContain('**Learning capacity**');
    expect(result).toContain('**Collaborative posture**');
  });

  it('should include 1:1 approach', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getSharedContext();

    expect(result).toContain('### 1:1 Approach');
    expect(result).toContain('Direct reports own the agenda');
  });

  it('should include tech debt philosophy', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    const result = await getSharedContext();

    expect(result).toContain('### Tech Debt Philosophy');
    expect(result).toContain('Tech debt is inevitable');
  });
});

describe('getFitAssessmentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSystemPromptCache();
  });

  it('should combine shared context with fit assessment instructions', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    mockFetchFitAssessmentInstructions.mockResolvedValue(
      '# Fit Assessment Instructions\n\nEvaluate role fit based on criteria.'
    );

    const result = await getFitAssessmentPrompt();

    // Should include shared context
    expect(result).toContain('# Damilola Elegbede - Professional Context');
    expect(result).toContain('## Core Leadership Philosophy');

    // Should include separator
    expect(result).toContain('---');

    // Should include fit assessment instructions
    expect(result).toContain('# Fit Assessment Instructions');
    expect(result).toContain('Evaluate role fit based on criteria');

    // Should NOT include chatbot instructions
    expect(result).not.toContain('## Chatbot Behavior Instructions');

    // Verify both fetches were called
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(1);
  });

  it('should cache the fit assessment prompt on subsequent calls', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    // First call
    const result1 = await getFitAssessmentPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await getFitAssessmentPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1); // Still only called once
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(1); // Still only called once
    expect(result2).toBe(result1);
  });

  it('should fetch shared context and fit instructions in parallel', async () => {
    mockFetchAllReferenceMaterials.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                resume: 'Resume',
                starStories: 'Stories',
                leadership: 'Leadership',
                technical: 'Technical',
              }),
            10
          )
        )
    );

    mockFetchFitAssessmentInstructions.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('Instructions'), 10))
    );

    const startTime = Date.now();
    await getFitAssessmentPrompt();
    const endTime = Date.now();

    // Should complete faster than sequential execution (would be ~20ms)
    // Allow some margin for test execution overhead
    expect(endTime - startTime).toBeLessThan(50);
  });

  it('should handle empty fit assessment instructions', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    mockFetchFitAssessmentInstructions.mockResolvedValue('');

    const result = await getFitAssessmentPrompt();

    // Should still include shared context
    expect(result).toContain('# Damilola Elegbede - Professional Context');

    // Should include separator even with empty instructions
    expect(result).toContain('---');
  });

  it('should properly format the combined prompt', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    const result = await getFitAssessmentPrompt();

    // Verify it contains shared context
    expect(result).toContain('# Damilola Elegbede - Professional Context');

    // Verify it ends with fit instructions after a separator
    expect(result).toMatch(/\n\n---\n\nFit instructions$/);

    // Verify fit instructions appear at the end
    expect(result.endsWith('Fit instructions')).toBe(true);
  });
});

describe('clearSystemPromptCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSystemPromptCache();
  });

  it('should clear cached chatbot prompt', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    // First call - populate cache
    await getFullSystemPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Second call - use cache
    await getFullSystemPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Clear cache
    clearSystemPromptCache();

    // Third call - should fetch again
    await getFullSystemPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(2);
  });

  it('should clear cached shared context', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });

    // First call - populate cache
    await getSharedContext();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Second call - use cache
    await getSharedContext();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);

    // Clear cache
    clearSystemPromptCache();

    // Third call - should fetch again
    await getSharedContext();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(2);
  });

  it('should clear cached fit assessment prompt', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });
    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    // First call - populate cache
    await getFitAssessmentPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(1);

    // Second call - use cache
    await getFitAssessmentPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(1);
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(1);

    // Clear cache
    clearSystemPromptCache();

    // Third call - should fetch again
    await getFitAssessmentPrompt();
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(2);
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(2);
  });

  it('should clear all caches independently', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });
    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    // Populate all caches
    await getFullSystemPrompt();
    await getSharedContext();
    await getFitAssessmentPrompt();

    // Clear all caches
    clearSystemPromptCache();

    // All subsequent calls should fetch again
    await getFullSystemPrompt();
    await getSharedContext();
    await getFitAssessmentPrompt();

    // Should have fetched multiple times
    // Before clear: 1 for getFullSystemPrompt, 1 for getSharedContext, 0 for getFitAssessmentPrompt (reuses cached shared context)
    // After clear: 1 for getFullSystemPrompt, 1 for getSharedContext, 0 for getFitAssessmentPrompt (reuses cached shared context)
    expect(mockFetchAllReferenceMaterials).toHaveBeenCalledTimes(4); // 2 before clear + 2 after clear
    expect(mockFetchFitAssessmentInstructions).toHaveBeenCalledTimes(2); // 1 before clear + 1 after clear
  });

  it('should be safe to call multiple times', () => {
    expect(() => {
      clearSystemPromptCache();
      clearSystemPromptCache();
      clearSystemPromptCache();
    }).not.toThrow();
  });

  it('should be safe to call before any prompts are cached', () => {
    expect(() => {
      clearSystemPromptCache();
    }).not.toThrow();
  });
});

describe('integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSystemPromptCache();
  });

  it('should generate different prompts for chatbot vs fit assessment', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });
    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    const chatbotPrompt = await getFullSystemPrompt();
    const fitPrompt = await getFitAssessmentPrompt();

    // Both should include shared context
    expect(chatbotPrompt).toContain('# Damilola Elegbede - Professional Context');
    expect(fitPrompt).toContain('# Damilola Elegbede - Professional Context');

    // Chatbot should include chatbot instructions
    expect(chatbotPrompt).toContain('## Chatbot Behavior Instructions');

    // Fit assessment should include fit instructions
    expect(fitPrompt).toContain('Fit instructions');

    // Chatbot should NOT include fit instructions
    expect(chatbotPrompt).not.toContain('Fit instructions');

    // Fit assessment should NOT include chatbot instructions
    expect(fitPrompt).not.toContain('## Chatbot Behavior Instructions');
  });

  it('should handle concurrent requests efficiently', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume',
      starStories: 'Stories',
      leadership: 'Leadership',
      technical: 'Technical',
    });
    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit instructions');

    // Make multiple concurrent requests
    const [result1, result2, result3, result4] = await Promise.all([
      getFullSystemPrompt(),
      getFullSystemPrompt(),
      getSharedContext(),
      getSharedContext(),
    ]);

    // Should all succeed
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(result3).toBeTruthy();
    expect(result4).toBeTruthy();

    // Duplicate requests should be the same (cached)
    expect(result1).toBe(result2);
    expect(result3).toBe(result4);
  });

  it('should maintain cache isolation between different prompt types', async () => {
    mockFetchAllReferenceMaterials.mockResolvedValue({
      resume: 'Resume v1',
      starStories: 'Stories v1',
      leadership: 'Leadership v1',
      technical: 'Technical v1',
    });
    mockFetchFitAssessmentInstructions.mockResolvedValue('Fit v1');

    // Populate all caches
    const chatbot1 = await getFullSystemPrompt();
    const shared1 = await getSharedContext();
    const fit1 = await getFitAssessmentPrompt();

    // Verify caching
    const chatbot2 = await getFullSystemPrompt();
    const shared2 = await getSharedContext();
    const fit2 = await getFitAssessmentPrompt();

    expect(chatbot1).toBe(chatbot2);
    expect(shared1).toBe(shared2);
    expect(fit1).toBe(fit2);

    // All should contain v1 content
    expect(chatbot1).toContain('Resume v1');
    expect(shared1).toContain('Resume v1');
    expect(fit1).toContain('Resume v1');
  });
});
