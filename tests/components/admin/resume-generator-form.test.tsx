import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeGeneratorForm } from '@/components/admin/ResumeGeneratorForm';

describe('ResumeGeneratorForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('Form Rendering', () => {
    it('renders with input field and submit button', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      expect(screen.getByLabelText('Job Description')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/https:\/\/jobs.lever.co\/company\/position/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Analyze & Optimize' })
      ).toBeInTheDocument();
    });

    it('renders helper text with instructions', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      expect(
        screen.getByText('Paste a job posting URL or the full job description text')
      ).toBeInTheDocument();
    });

    it('renders textarea with correct initial state', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      expect(textarea).toHaveValue('');
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid job description text', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });

      fireEvent.change(textarea, {
        target: { value: 'Senior Software Engineer position with 5+ years experience' },
      });
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Senior Software Engineer position with 5+ years experience'
      );
    });

    it('submits form with valid URL', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });

      fireEvent.change(textarea, {
        target: { value: 'https://jobs.lever.co/anthropic/senior-engineer' },
      });
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'https://jobs.lever.co/anthropic/senior-engineer'
      );
    });

    it('trims whitespace before submission', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });

      fireEvent.change(textarea, {
        target: { value: '  Job description with leading/trailing spaces  ' },
      });
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        'Job description with leading/trailing spaces'
      );
    });

    it('submits on form submit event (Enter key)', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const form = screen.getByRole('button', { name: 'Analyze & Optimize' }).closest('form');
      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, { target: { value: 'Job description' } });
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    it('disables submit button when input is empty', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when input contains only whitespace', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });

      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when input has valid content', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const submitButton = screen.getByRole('button', { name: 'Analyze & Optimize' });

      fireEvent.change(textarea, { target: { value: 'Valid job description' } });
      expect(submitButton).not.toBeDisabled();
    });

    it('does not submit when input is empty', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const form = screen.getByRole('button', { name: 'Analyze & Optimize' }).closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('does not submit when input is only whitespace', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      const form = screen.getByRole('button', { name: 'Analyze & Optimize' }).closest('form');

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.submit(form!);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('URL Detection', () => {
    it('shows URL detection hint when input starts with http', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, {
        target: { value: 'https://jobs.lever.co/company/position' },
      });

      expect(
        screen.getByText('URL detected - will fetch and extract content')
      ).toBeInTheDocument();
    });

    it('shows URL detection hint when input starts with http (not https)', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, {
        target: { value: 'http://jobs.example.com/position' },
      });

      expect(
        screen.getByText('URL detected - will fetch and extract content')
      ).toBeInTheDocument();
    });

    it('does not show URL detection hint for non-URL input', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, {
        target: { value: 'Software Engineer at Company XYZ' },
      });

      expect(
        screen.queryByText('URL detected - will fetch and extract content')
      ).not.toBeInTheDocument();
    });

    it('hides URL detection hint when URL is cleared', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, { target: { value: 'https://example.com' } });
      expect(
        screen.getByText('URL detected - will fetch and extract content')
      ).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: '' } });
      expect(
        screen.queryByText('URL detected - will fetch and extract content')
      ).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
      expect(screen.queryByText('Analyze & Optimize')).not.toBeInTheDocument();
    });

    it('disables submit button during loading', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: 'Analyzing...' });
      expect(submitButton).toBeDisabled();
    });

    it('disables textarea during loading', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);

      const textarea = screen.getByLabelText('Job Description');
      expect(textarea).toBeDisabled();
    });

    it('prevents submission when already loading', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);

      const form = screen.getByRole('button', { name: 'Analyzing...' }).closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('transitions between loading and idle states', () => {
      const { rerender } = render(
        <ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />
      );

      expect(screen.getByText('Analyze & Optimize')).toBeInTheDocument();

      rerender(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();

      rerender(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);
      expect(screen.getByText('Analyze & Optimize')).toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('updates input value when user types', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, { target: { value: 'First line' } });
      expect(textarea).toHaveValue('First line');

      fireEvent.change(textarea, { target: { value: 'First line\nSecond line' } });
      expect(textarea).toHaveValue('First line\nSecond line');
    });

    it('maintains input state across multiple changes', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, { target: { value: 'A' } });
      expect(textarea).toHaveValue('A');

      fireEvent.change(textarea, { target: { value: 'AB' } });
      expect(textarea).toHaveValue('AB');

      fireEvent.change(textarea, { target: { value: 'ABC' } });
      expect(textarea).toHaveValue('ABC');
    });

    it('allows clearing the input', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');

      fireEvent.change(textarea, { target: { value: 'Some text' } });
      expect(textarea).toHaveValue('Some text');

      fireEvent.change(textarea, { target: { value: '' } });
      expect(textarea).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('associates label with textarea using htmlFor', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const label = screen.getByText('Job Description');
      const textarea = screen.getByLabelText('Job Description');

      expect(label).toHaveAttribute('for', 'job-description');
      expect(textarea).toHaveAttribute('id', 'job-description');
    });

    it('has descriptive placeholder text', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const textarea = screen.getByLabelText('Job Description');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'https://jobs.lever.co/company/position... or paste the full job description here'
      );
    });

    it('has proper button text for screen readers', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={false} />);

      const button = screen.getByRole('button', { name: 'Analyze & Optimize' });
      expect(button).toBeInTheDocument();
    });

    it('updates button text during loading for screen readers', () => {
      render(<ResumeGeneratorForm onSubmit={mockOnSubmit} isLoading={true} />);

      const button = screen.getByRole('button', { name: 'Analyzing...' });
      expect(button).toBeInTheDocument();
    });
  });
});
