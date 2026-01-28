import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PageNavigation } from '@/components/admin/PageNavigation';

describe('PageNavigation', () => {
  const defaultProps = {
    currentPage: 2,
    totalPages: 5,
    onNext: vi.fn(),
    onPrev: vi.fn(),
  };

  it('renders navigation buttons', () => {
    render(<PageNavigation {...defaultProps} />);

    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  it('displays current page information', () => {
    render(<PageNavigation {...defaultProps} />);

    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });

  it('calls onPrev when previous button is clicked', () => {
    const onPrev = vi.fn();
    render(<PageNavigation {...defaultProps} onPrev={onPrev} />);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn();
    render(<PageNavigation {...defaultProps} onNext={onNext} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables previous button on first page', () => {
    render(<PageNavigation {...defaultProps} currentPage={1} />);

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('enables previous button when not on first page', () => {
    render(<PageNavigation {...defaultProps} currentPage={2} />);

    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<PageNavigation {...defaultProps} currentPage={5} totalPages={5} />);

    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('enables next button when not on last page', () => {
    render(<PageNavigation {...defaultProps} currentPage={2} totalPages={5} />);

    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('disables both buttons when loading', () => {
    render(<PageNavigation {...defaultProps} isLoading={true} />);

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    const { container } = render(<PageNavigation {...defaultProps} isLoading={true} />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('Page 2 of 5')).not.toBeInTheDocument();
  });

  it('does not call onClick handlers when buttons are disabled', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <PageNavigation
        currentPage={1}
        totalPages={1}
        onPrev={onPrev}
        onNext={onNext}
      />
    );

    fireEvent.click(screen.getByLabelText('Previous page'));
    fireEvent.click(screen.getByLabelText('Next page'));

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('applies disabled cursor styling when buttons are disabled', () => {
    render(<PageNavigation {...defaultProps} currentPage={1} totalPages={1} />);

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    expect(prevButton).toHaveClass('disabled:cursor-not-allowed');
    expect(nextButton).toHaveClass('disabled:cursor-not-allowed');
  });

  it('applies opacity styling to disabled buttons', () => {
    render(<PageNavigation {...defaultProps} currentPage={1} totalPages={1} />);

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    expect(prevButton).toHaveClass('disabled:opacity-50');
    expect(nextButton).toHaveClass('disabled:opacity-50');
  });

  it('handles single page scenario', () => {
    render(<PageNavigation {...defaultProps} currentPage={1} totalPages={1} />);

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('applies hover styles to enabled buttons', () => {
    render(<PageNavigation {...defaultProps} />);

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    expect(prevButton).toHaveClass('hover:border-[var(--color-accent)]');
    expect(nextButton).toHaveClass('hover:border-[var(--color-accent)]');
  });

  it('renders SVG icons correctly', () => {
    render(<PageNavigation {...defaultProps} />);

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    expect(prevButton.querySelector('svg')).toBeInTheDocument();
    expect(nextButton.querySelector('svg')).toBeInTheDocument();
  });

  it('maintains button accessibility attributes', () => {
    render(<PageNavigation {...defaultProps} />);

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    expect(prevButton).toHaveAttribute('aria-label', 'Previous page');
    expect(nextButton).toHaveAttribute('aria-label', 'Next page');
  });
});
