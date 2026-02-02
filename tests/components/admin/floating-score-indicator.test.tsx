import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloatingScoreIndicator } from '@/components/admin/FloatingScoreIndicator';

describe('FloatingScoreIndicator', () => {
  const defaultProps = {
    initialScore: 56,
    currentScore: 72,
    maximumScore: 89,
    isVisible: true,
    onScrollToScores: vi.fn(),
  };

  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <FloatingScoreIndicator {...defaultProps} isVisible={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders when isVisible is true', () => {
    render(<FloatingScoreIndicator {...defaultProps} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('ATS Score')).toBeInTheDocument();
  });

  it('displays initial and current scores with arrow when there is improvement', () => {
    render(<FloatingScoreIndicator {...defaultProps} />);

    expect(screen.getByText('56')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('(of 89)')).toBeInTheDocument();
  });

  it('displays only initial score when no improvement', () => {
    render(
      <FloatingScoreIndicator
        {...defaultProps}
        initialScore={72}
        currentScore={72}
      />
    );

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
    expect(screen.getByText('(of 89)')).toBeInTheDocument();
  });

  it('calls onScrollToScores when clicked', () => {
    const onScrollToScores = vi.fn();
    render(
      <FloatingScoreIndicator {...defaultProps} onScrollToScores={onScrollToScores} />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onScrollToScores).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-label', () => {
    render(<FloatingScoreIndicator {...defaultProps} />);

    expect(screen.getByLabelText('Scroll to score cards')).toBeInTheDocument();
  });

  it('applies correct color for excellent score (85+)', () => {
    render(
      <FloatingScoreIndicator
        {...defaultProps}
        initialScore={85}
        currentScore={90}
        maximumScore={100}
      />
    );

    const scoreElements = screen.getAllByText(/85|90/);
    expect(scoreElements.some(el => el.className.includes('text-green-400'))).toBe(true);
  });

  it('applies correct color for good score (70-84)', () => {
    render(<FloatingScoreIndicator {...defaultProps} />);

    const scoreElement = screen.getByText('72');
    expect(scoreElement.className).toContain('text-blue-400');
  });

  it('applies correct color for fair score (55-69)', () => {
    render(
      <FloatingScoreIndicator
        {...defaultProps}
        initialScore={56}
        currentScore={60}
        maximumScore={89}
      />
    );

    const scoreElement = screen.getByText('56');
    expect(scoreElement.className).toContain('text-yellow-400');
  });

  it('applies correct color for weak score (<55)', () => {
    render(
      <FloatingScoreIndicator
        {...defaultProps}
        initialScore={40}
        currentScore={50}
        maximumScore={89}
      />
    );

    const scoreElement = screen.getByText('40');
    expect(scoreElement.className).toContain('text-red-400');
  });

  it('handles edge case where current equals initial but less than max', () => {
    render(
      <FloatingScoreIndicator
        {...defaultProps}
        initialScore={60}
        currentScore={60}
        maximumScore={89}
      />
    );

    // Should not show arrow when scores are equal
    expect(screen.queryByText('→')).not.toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('(of 89)')).toBeInTheDocument();
  });
});
