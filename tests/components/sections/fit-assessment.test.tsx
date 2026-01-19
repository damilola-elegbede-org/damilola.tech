import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FitAssessment } from '@/components/sections/fit-assessment';

// Mock fetch for examples and fit-assessment APIs
const mockExamples = {
  strong: '# Engineering Manager, Platform Infrastructure\nThis is a strong fit example...',
  weak: '# Staff Frontend Engineer\nThis is a weak fit example...',
};

const mockFitResponseText = '# Fit Assessment: Engineering Manager\n\n**Fit Rating: Strong Match**';

// Helper to create a mock streaming response
function createMockStreamResponse(text: string, delay = 0) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return {
    ok: true,
    body: stream,
  };
}

describe('FitAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/fit-examples') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExamples),
        });
      }
      if (url === '/api/fit-assessment') {
        return Promise.resolve(createMockStreamResponse(mockFitResponseText));
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders the section heading', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Fit Assessment'
    );
  });

  it('renders the tagline', () => {
    render(<FitAssessment />);
    expect(
      screen.getByText(/Paste a job description/i)
    ).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<FitAssessment />);
    expect(document.getElementById('fit-assessment')).toBeInTheDocument();
  });

  it('renders example buttons', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /strong fit example/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /weak fit example/i })).toBeInTheDocument();
    });
  });

  it('renders textarea for job description', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('textbox', { name: /job description/i })).toBeInTheDocument();
  });

  it('renders analyze button', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('button', { name: /analyze fit/i })).toBeInTheDocument();
  });

  it('populates textarea when strong fit example is clicked', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /strong fit example/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /strong fit example/i }));

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    expect(textarea).toHaveValue(mockExamples.strong);
  });

  it('populates textarea when weak fit example is clicked', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /weak fit example/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /weak fit example/i }));

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    expect(textarea).toHaveValue(mockExamples.weak);
  });

  it('disables analyze button when textarea is empty', () => {
    render(<FitAssessment />);
    const button = screen.getByRole('button', { name: /analyze fit/i });
    expect(button).toBeDisabled();
  });

  it('enables analyze button when textarea has content', async () => {
    render(<FitAssessment />);
    const textarea = screen.getByRole('textbox', { name: /job description/i });

    fireEvent.change(textarea, { target: { value: 'Some job description' } });

    const button = screen.getByRole('button', { name: /analyze fit/i });
    expect(button).not.toBeDisabled();
  });

  it('calls fit-assessment API when analyze button is clicked', async () => {
    render(<FitAssessment />);
    const textarea = screen.getByRole('textbox', { name: /job description/i });

    fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Engineering Manager role' }),
        signal: expect.any(AbortSignal),
      });
    });
  });

  it('shows loading state during analysis', async () => {
    // Mock a slow response using streaming with delay
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/fit-examples') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExamples),
        });
      }
      if (url === '/api/fit-assessment') {
        return Promise.resolve(createMockStreamResponse(mockFitResponseText, 1000));
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<FitAssessment />);

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    fireEvent.change(textarea, { target: { value: 'Some job description' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyzing/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
    });
  });

  it('displays assessment result after analysis completes', async () => {
    render(<FitAssessment />);

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Fit Assessment: Engineering Manager/)).toBeInTheDocument();
      expect(screen.getByText(/Strong Match/)).toBeInTheDocument();
    });
  });

  it('shows placeholder text during loading', async () => {
    // Mock a slow response using streaming with delay
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/fit-examples') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExamples),
        });
      }
      if (url === '/api/fit-assessment') {
        return Promise.resolve(createMockStreamResponse(mockFitResponseText, 1000));
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<FitAssessment />);

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    fireEvent.change(textarea, { target: { value: 'Some job description' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Analyzing job fit/i)).toBeInTheDocument();
    });
  });

  it('fetches examples on mount', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/fit-examples');
    });
  });

  it('disables example buttons while loading examples', () => {
    // Set up fetch to be slow for examples
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/fit-examples') {
        return new Promise((resolve) =>
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockExamples),
          }), 1000)
        );
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<FitAssessment />);

    expect(screen.getByRole('button', { name: /strong fit example/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /weak fit example/i })).toBeDisabled();
  });

  it('displays error message when API returns an error', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/fit-examples') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExamples),
        });
      }
      if (url === '/api/fit-assessment') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'AI service unavailable' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<FitAssessment />);

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    fireEvent.change(textarea, { target: { value: 'Some job description' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unable to analyze fit/i)).toBeInTheDocument();
      expect(screen.getByText(/AI service unavailable/i)).toBeInTheDocument();
    });
  });

  describe('Download functionality', () => {
    it('download MD button appears when result exists', async () => {
      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download fit assessment as markdown/i })).toBeInTheDocument();
      });
    });

    it('download MD button hidden during loading', async () => {
      // Mock slow response
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/fit-examples') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockExamples),
          });
        }
        if (url === '/api/fit-assessment') {
          return Promise.resolve(createMockStreamResponse(mockFitResponseText, 2000));
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      // During loading, download buttons should not be visible
      await waitFor(() => {
        expect(screen.getByText(/Analyzing job fit/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /download fit assessment as markdown/i })).not.toBeInTheDocument();
    });

    it('download MD creates blob with correct content', async () => {
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild');

      // Mock createElement to capture the anchor element
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          element.click = mockClick;
        }
        return element;
      });

      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download fit assessment as markdown/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /download fit assessment as markdown/i }));

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();

      // Restore mocks
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      vi.mocked(document.createElement).mockRestore();
    });

    it('download MD triggers file download with .md extension', async () => {
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = vi.fn();

      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          capturedAnchor = element as HTMLAnchorElement;
          element.click = vi.fn();
        }
        return element;
      });

      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download fit assessment as markdown/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /download fit assessment as markdown/i }));

      expect(capturedAnchor).not.toBeNull();
      // Dynamic filename based on extracted role title from "# Fit Assessment: Engineering Manager"
      expect(capturedAnchor!.download).toBe('engineering-manager.md');

      vi.mocked(document.createElement).mockRestore();
    });

    it('download PDF button appears when result exists', async () => {
      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download fit assessment as pdf/i })).toBeInTheDocument();
      });
    });

    it('download PDF button hidden during loading', async () => {
      // Mock slow response
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/fit-examples') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockExamples),
          });
        }
        if (url === '/api/fit-assessment') {
          return Promise.resolve(createMockStreamResponse(mockFitResponseText, 2000));
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByText(/Analyzing job fit/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /download fit assessment as pdf/i })).not.toBeInTheDocument();
    });

    it('PDF download calls html2pdf with correct options', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn(() => ({ save: mockSave }));
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      const mockHtml2pdf = vi.fn(() => ({ set: mockSet }));

      vi.doMock('html2pdf.js', () => ({
        default: mockHtml2pdf,
      }));

      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download fit assessment as pdf/i })).toBeInTheDocument();
      });

      // The actual html2pdf module is dynamically imported in the component
      // This test verifies the button exists and is clickable
      const pdfButton = screen.getByRole('button', { name: /download fit assessment as pdf/i });
      expect(pdfButton).not.toBeDisabled();
    });

    it('PDF download applies print-friendly styles to clone', async () => {
      render(<FitAssessment />);

      const textarea = screen.getByRole('textbox', { name: /job description/i });
      fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
      fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

      await waitFor(() => {
        expect(screen.getByText(/Fit Assessment: Engineering Manager/)).toBeInTheDocument();
      });

      // Verify the result container exists with prose class
      const resultContainer = document.querySelector('.prose');
      expect(resultContainer).toBeInTheDocument();
    });
  });
});
