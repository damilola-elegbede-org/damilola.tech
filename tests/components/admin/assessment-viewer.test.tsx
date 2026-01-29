import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AssessmentViewer } from '@/components/admin/AssessmentViewer';

const mockAssessment = {
  version: 1,
  assessmentId: 'test-assessment-123',
  environment: 'production',
  createdAt: '2024-01-15T10:30:00.000Z',
  inputType: 'text' as const,
  inputLength: 1500,
  extractedUrl: 'https://example.com/job',
  jobDescriptionSnippet: 'We are looking for a Senior Software Engineer...',
  completionLength: 3000,
  streamDurationMs: 4500,
  roleTitle: 'Senior Software Engineer',
  downloadedPdf: true,
  downloadedMd: false,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
};

describe('AssessmentViewer', () => {
  describe('Overview Section', () => {
    it('renders assessment ID', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Assessment ID')).toBeInTheDocument();
      expect(screen.getByText('test-assessment-123')).toBeInTheDocument();
    });

    it('renders created date in localized format', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Created')).toBeInTheDocument();
      const formattedDate = new Date('2024-01-15T10:30:00.000Z').toLocaleString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('renders input type', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Input Type')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument();
    });

    it('renders stream duration in seconds', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('4.5s')).toBeInTheDocument();
    });

    it('handles URL input type', () => {
      const urlAssessment = { ...mockAssessment, inputType: 'url' as const };
      render(<AssessmentViewer assessment={urlAssessment} />);

      expect(screen.getByText('url')).toBeInTheDocument();
    });
  });

  describe('Role Title Section', () => {
    it('renders role title when provided', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Role Title')).toBeInTheDocument();
      expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument();
    });

    it('does not render role title section when not provided', () => {
      const assessmentWithoutRole = { ...mockAssessment, roleTitle: undefined };
      render(<AssessmentViewer assessment={assessmentWithoutRole} />);

      expect(screen.queryByText('Role Title')).not.toBeInTheDocument();
    });
  });

  describe('Job Description Section', () => {
    it('renders job description snippet', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Job Description (First 200 chars)')).toBeInTheDocument();
      expect(screen.getByText('We are looking for a Senior Software Engineer...')).toBeInTheDocument();
    });

    it('renders extracted URL when provided', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('URL:')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'https://example.com/job' });
      expect(link).toHaveAttribute('href', 'https://example.com/job');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render URL section when not provided', () => {
      const assessmentWithoutUrl = { ...mockAssessment, extractedUrl: undefined };
      render(<AssessmentViewer assessment={assessmentWithoutUrl} />);

      expect(screen.queryByText('URL:')).not.toBeInTheDocument();
    });

    it('preserves whitespace in job description', () => {
      const assessmentWithWhitespace = {
        ...mockAssessment,
        jobDescriptionSnippet: 'Line 1\nLine 2\nLine 3',
      };
      const { container } = render(<AssessmentViewer assessment={assessmentWithWhitespace} />);

      const snippet = container.querySelector('.whitespace-pre-wrap');
      expect(snippet).toBeInTheDocument();
      expect(snippet).toHaveClass('whitespace-pre-wrap');
      expect(snippet?.textContent).toContain('Line 1');
      expect(snippet?.textContent).toContain('Line 2');
      expect(snippet?.textContent).toContain('Line 3');
    });
  });

  describe('Metrics Section', () => {
    it('renders input length with locale formatting', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Input Length')).toBeInTheDocument();
      expect(screen.getByText('1,500 chars')).toBeInTheDocument();
    });

    it('renders output length with locale formatting', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('Output Length')).toBeInTheDocument();
      expect(screen.getByText('3,000 chars')).toBeInTheDocument();
    });

    it('renders PDF download status as Yes when true', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('PDF Downloaded')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('renders PDF download status as No when false', () => {
      const assessmentNoPdf = { ...mockAssessment, downloadedPdf: false };
      render(<AssessmentViewer assessment={assessmentNoPdf} />);

      expect(screen.getByText('PDF Downloaded')).toBeInTheDocument();
      const noElements = screen.getAllByText('No');
      expect(noElements.length).toBeGreaterThan(0);
    });

    it('renders MD download status as Yes when true', () => {
      const assessmentWithMd = { ...mockAssessment, downloadedMd: true };
      render(<AssessmentViewer assessment={assessmentWithMd} />);

      expect(screen.getByText('MD Downloaded')).toBeInTheDocument();
      const yesElements = screen.getAllByText('Yes');
      expect(yesElements.length).toBeGreaterThan(0);
    });

    it('renders MD download status as No when false', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('MD Downloaded')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('handles large input and output lengths', () => {
      const largeAssessment = {
        ...mockAssessment,
        inputLength: 15000,
        completionLength: 50000,
      };
      render(<AssessmentViewer assessment={largeAssessment} />);

      expect(screen.getByText('15,000 chars')).toBeInTheDocument();
      expect(screen.getByText('50,000 chars')).toBeInTheDocument();
    });
  });

  describe('User Agent Section', () => {
    it('renders user agent when provided', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);

      expect(screen.getByText('User Agent')).toBeInTheDocument();
      expect(screen.getByText('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBeInTheDocument();
    });

    it('does not render user agent section when not provided', () => {
      const assessmentWithoutUserAgent = { ...mockAssessment, userAgent: undefined };
      render(<AssessmentViewer assessment={assessmentWithoutUserAgent} />);

      expect(screen.queryByText('User Agent')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values for metrics', () => {
      const zeroAssessment = {
        ...mockAssessment,
        inputLength: 0,
        completionLength: 0,
        streamDurationMs: 0,
      };
      render(<AssessmentViewer assessment={zeroAssessment} />);

      const charsElements = screen.getAllByText(/0 chars/);
      expect(charsElements.length).toBeGreaterThan(0);
      expect(screen.getByText('0.0s')).toBeInTheDocument();
    });

    it('handles very short stream duration', () => {
      const quickAssessment = {
        ...mockAssessment,
        streamDurationMs: 150,
      };
      render(<AssessmentViewer assessment={quickAssessment} />);

      expect(screen.getByText(/0\.\ds/)).toBeInTheDocument();
    });

    it('handles long stream duration', () => {
      const slowAssessment = {
        ...mockAssessment,
        streamDurationMs: 45000,
      };
      render(<AssessmentViewer assessment={slowAssessment} />);

      expect(screen.getByText('45.0s')).toBeInTheDocument();
    });

    it('handles minimal assessment data', () => {
      const minimalAssessment = {
        version: 1,
        assessmentId: 'minimal-123',
        environment: 'test',
        createdAt: '2024-01-01T00:00:00.000Z',
        inputType: 'text' as const,
        inputLength: 0,
        jobDescriptionSnippet: '',
        completionLength: 0,
        streamDurationMs: 0,
        downloadedPdf: false,
        downloadedMd: false,
      };
      render(<AssessmentViewer assessment={minimalAssessment} />);

      expect(screen.getByText('minimal-123')).toBeInTheDocument();
      const charsElements = screen.getAllByText(/0 chars/);
      expect(charsElements.length).toBeGreaterThan(0);
    });

    it('handles empty job description snippet', () => {
      const emptySnippet = { ...mockAssessment, jobDescriptionSnippet: '' };
      render(<AssessmentViewer assessment={emptySnippet} />);

      expect(screen.getByText('Job Description (First 200 chars)')).toBeInTheDocument();
    });

    it('handles all boolean combinations for downloads', () => {
      const bothFalse = { ...mockAssessment, downloadedPdf: false, downloadedMd: false };
      const { rerender } = render(<AssessmentViewer assessment={bothFalse} />);
      expect(screen.getAllByText('No')).toHaveLength(2);

      const bothTrue = { ...mockAssessment, downloadedPdf: true, downloadedMd: true };
      rerender(<AssessmentViewer assessment={bothTrue} />);
      expect(screen.getAllByText('Yes')).toHaveLength(2);

      const pdfOnlyTrue = { ...mockAssessment, downloadedPdf: true, downloadedMd: false };
      rerender(<AssessmentViewer assessment={pdfOnlyTrue} />);
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('applies correct CSS classes for card backgrounds', () => {
      const { container } = render(<AssessmentViewer assessment={mockAssessment} />);
      const cards = container.querySelectorAll('.bg-\\[var\\(--color-card\\)\\]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('renders monospace font for assessment ID', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);
      const assessmentIdElement = screen.getByText('test-assessment-123');
      expect(assessmentIdElement).toHaveClass('font-mono');
    });

    it('renders monospace font for user agent', () => {
      render(<AssessmentViewer assessment={mockAssessment} />);
      const userAgentElement = screen.getByText('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
      expect(userAgentElement).toHaveClass('font-mono');
    });
  });
});
