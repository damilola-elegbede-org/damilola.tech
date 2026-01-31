import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { ResumeGenerationSummary } from '@/lib/types/resume-generation';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the audit-client
vi.mock('@/lib/audit-client', () => ({
  trackEvent: vi.fn(),
}));

// Import after mocks are set up
import ResumeGeneratorHistoryPage from '@/app/admin/resume-generator/history/page';

/**
 * Tests for the URL validation logic in the history page.
 * The page validates blob URLs before making fetch requests to prevent
 * SSRF attacks via malicious URLs.
 *
 * Validation rules (isValidBlobUrl):
 * - Must be HTTPS protocol
 * - Must have hostname ending with .public.blob.vercel-storage.com or .blob.vercel-storage.com
 * - Must be a valid URL (not throw on parsing)
 */
describe('ResumeGeneratorHistoryPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Test the isValidBlobUrl logic directly by testing observable behavior
  describe('URL validation in handleRowClick', () => {
    const validBlobUrl = 'https://abc123.public.blob.vercel-storage.com/path/to/file.json';

    const createMockGeneration = (overrides: Partial<ResumeGenerationSummary> = {}): ResumeGenerationSummary => ({
      id: 'test-id',
      jobId: 'job-123',
      generationId: 'gen-123',
      environment: 'production',
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyName: 'Test Company',
      roleTitle: 'Test Role',
      scoreBefore: 70,
      scoreAfter: 85,
      applicationStatus: 'draft',
      size: 1024,
      generationCount: 1,
      url: validBlobUrl,
      ...overrides,
    });

    const createMockFetch = (generations: ResumeGenerationSummary[]) => {
      return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/resume-generations?') || url === '/api/admin/resume-generations') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              generations,
              cursor: null,
              hasMore: false,
            }),
          });
        }
        // Detail fetch
        if (url.includes('/api/admin/resume-generations/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ...generations[0],
              version: 2,
              jobDescriptionFull: 'Full JD text',
              changesAccepted: [],
              changesRejected: [],
              gapsIdentified: [],
              optimizedResumeJson: {},
              pdfUrl: 'https://example.com/resume.pdf',
              estimatedCompatibility: {
                before: 70,
                after: 85,
                breakdown: {
                  keywordRelevance: 35,
                  skillsQuality: 20,
                  experienceAlignment: 18,
                  formatParseability: 12,
                },
              },
              generationHistory: [],
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    };

    it('renders page with generations', async () => {
      const generation = createMockGeneration();
      global.fetch = createMockFetch([generation]);

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });
    });

    it('shows error for generation with missing URL when row is clicked', async () => {
      const generationWithoutUrl = createMockGeneration({ url: undefined });
      const mockFetch = createMockFetch([generationWithoutUrl]);
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      // Click on the company name to trigger row click
      await act(async () => {
        fireEvent.click(screen.getByText('Test Company'));
      });

      await waitFor(() => {
        expect(screen.getByText('Invalid generation URL')).toBeInTheDocument();
      });

      // Should have only made the initial list fetch, not the detail fetch
      const detailCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/api/admin/resume-generations/') && !call[0].includes('?')
      );
      expect(detailCalls).toHaveLength(0);
    });

    it('shows error for generation with invalid (non-blob) URL when row is clicked', async () => {
      const generationWithInvalidUrl = createMockGeneration({ url: 'https://evil.com/malicious.json' });
      const mockFetch = createMockFetch([generationWithInvalidUrl]);
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Test Company'));
      });

      await waitFor(() => {
        expect(screen.getByText('Invalid generation URL')).toBeInTheDocument();
      });

      const detailCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/api/admin/resume-generations/') && !call[0].includes('?')
      );
      expect(detailCalls).toHaveLength(0);
    });

    it('shows error for generation with non-https URL when row is clicked', async () => {
      const generationWithHttpUrl = createMockGeneration({
        url: 'http://abc123.public.blob.vercel-storage.com/path/to/file.json',
      });
      const mockFetch = createMockFetch([generationWithHttpUrl]);
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Test Company'));
      });

      await waitFor(() => {
        expect(screen.getByText('Invalid generation URL')).toBeInTheDocument();
      });

      const detailCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/api/admin/resume-generations/') && !call[0].includes('?')
      );
      expect(detailCalls).toHaveLength(0);
    });

    it('shows error for generation with malformed URL when row is clicked', async () => {
      const generationWithMalformedUrl = createMockGeneration({
        url: 'not-a-valid-url-at-all',
      });
      const mockFetch = createMockFetch([generationWithMalformedUrl]);
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Test Company'));
      });

      await waitFor(() => {
        expect(screen.getByText('Invalid generation URL')).toBeInTheDocument();
      });

      const detailCalls = mockFetch.mock.calls.filter(
        (call) => call[0].includes('/api/admin/resume-generations/') && !call[0].includes('?')
      );
      expect(detailCalls).toHaveLength(0);
    });

    it('fetches details when row with valid blob URL is clicked', async () => {
      const generationWithValidUrl = createMockGeneration({ url: validBlobUrl });
      const mockFetch = createMockFetch([generationWithValidUrl]);
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Test Company'));
      });

      // Should have made the detail fetch call
      await waitFor(() => {
        const detailCalls = mockFetch.mock.calls.filter(
          (call) => call[0].includes('/api/admin/resume-generations/') && !call[0].includes('?')
        );
        expect(detailCalls.length).toBeGreaterThan(0);
      });
    });
  });

  describe('URL validation in handleStatusChange', () => {
    const createMockGeneration = (overrides: Partial<ResumeGenerationSummary> = {}): ResumeGenerationSummary => ({
      id: 'test-id',
      jobId: 'job-123',
      generationId: 'gen-123',
      environment: 'production',
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      companyName: 'Status Test Company',
      roleTitle: 'Test Role',
      scoreBefore: 70,
      scoreAfter: 85,
      applicationStatus: 'draft',
      size: 1024,
      generationCount: 1,
      url: 'https://abc123.public.blob.vercel-storage.com/path/to/file.json',
      ...overrides,
    });

    it('shows error when trying to change status for generation without URL', async () => {
      const generationWithoutUrl = createMockGeneration({ url: undefined });

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/resume-generations')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              generations: [generationWithoutUrl],
              cursor: null,
              hasMore: false,
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      global.fetch = mockFetch;

      await act(async () => {
        render(<ResumeGeneratorHistoryPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Status Test Company')).toBeInTheDocument();
      });

      // Find the status dropdown by aria-label
      const statusDropdown = screen.getByLabelText('Application status');
      expect(statusDropdown).toBeInTheDocument();

      // Change the status
      await act(async () => {
        fireEvent.change(statusDropdown, { target: { value: 'applied' } });
      });

      // Should show error about missing URL
      await waitFor(() => {
        expect(screen.getByText('Cannot update status: missing generation URL')).toBeInTheDocument();
      });
    });
  });
});
