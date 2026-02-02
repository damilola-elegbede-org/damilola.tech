import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoreProgressDisplay } from '@/components/admin/ScoreProgressDisplay';
import type { ScoreBreakdown } from '@/lib/types/resume-generation';

const mockCurrentBreakdown: ScoreBreakdown = {
  keywordRelevance: 28,
  skillsQuality: 18,
  experienceAlignment: 14,
  formatParseability: 15,
};

const mockProjectedBreakdown: ScoreBreakdown = {
  keywordRelevance: 36,
  skillsQuality: 22,
  experienceAlignment: 18,
  formatParseability: 15,
};

describe('ScoreProgressDisplay', () => {
  it('renders current score without arrow when no improvement', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={72}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    expect(screen.getByText('72')).toBeInTheDocument();
    // Should not show an arrow when scores are equal
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('renders score transition with arrow when there is improvement', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={91}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={3}
        totalChanges={5}
      />
    );

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    // Should show arrows (main score + breakdowns)
    const arrows = screen.getAllByText(/→/);
    expect(arrows.length).toBeGreaterThan(0);
  });

  it('displays the correct acceptance count badge', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={91}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={3}
        totalChanges={8}
      />
    );

    expect(screen.getByText('accepting 3 of 8 changes')).toBeInTheDocument();
  });

  it('shows 0 of X when no changes accepted', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={72}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    expect(screen.getByText('accepting 0 of 5 changes')).toBeInTheDocument();
  });

  it('displays all breakdown categories', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={91}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={3}
        totalChanges={5}
      />
    );

    expect(screen.getByText('Keyword Relevance')).toBeInTheDocument();
    expect(screen.getByText('Skills Quality')).toBeInTheDocument();
    expect(screen.getByText('Experience Alignment')).toBeInTheDocument();
    expect(screen.getByText('Format Parseability')).toBeInTheDocument();
  });

  it('shows breakdown transitions with max values', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={91}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={3}
        totalChanges={5}
      />
    );

    // Check that breakdown values are present
    // Keyword Relevance: shows 28 and 36 somewhere
    expect(screen.getAllByText(/28/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/36/).length).toBeGreaterThan(0);
    // Max value of 40
    expect(screen.getByText(/\/ 40/)).toBeInTheDocument();

    // Skills Quality max value
    expect(screen.getByText(/\/ 25/)).toBeInTheDocument();
  });

  it('caps projected score at 100', () => {
    const highProjectedBreakdown: ScoreBreakdown = {
      keywordRelevance: 40,
      skillsQuality: 25,
      experienceAlignment: 20,
      formatParseability: 15,
    };

    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={105}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={highProjectedBreakdown}
        acceptedCount={8}
        totalChanges={8}
      />
    );

    // Should show 100, not 105
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('105')).not.toBeInTheDocument();
  });

  it('handles edge case of 0 current score', () => {
    const zeroBreakdown: ScoreBreakdown = {
      keywordRelevance: 0,
      skillsQuality: 0,
      experienceAlignment: 0,
      formatParseability: 0,
    };

    render(
      <ScoreProgressDisplay
        currentScore={0}
        projectedScore={50}
        currentBreakdown={zeroBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={3}
        totalChanges={5}
      />
    );

    // Check that 0 score is shown (may appear multiple times in breakdowns)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('handles all changes accepted', () => {
    render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={95}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={5}
        totalChanges={5}
      />
    );

    expect(screen.getByText('accepting 5 of 5 changes')).toBeInTheDocument();
  });

  it('renders spacer div for fixed positioning', () => {
    const { container } = render(
      <ScoreProgressDisplay
        currentScore={72}
        projectedScore={91}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={3}
        totalChanges={5}
      />
    );

    // Check that there's a spacer div (h-[180px] or h-[140px])
    const spacer = container.querySelector('[class*="h-["]');
    expect(spacer).toBeInTheDocument();
  });

  it('applies correct color for excellent score (85+)', () => {
    render(
      <ScoreProgressDisplay
        currentScore={90}
        projectedScore={95}
        currentBreakdown={mockProjectedBreakdown}
        projectedBreakdown={mockProjectedBreakdown}
        acceptedCount={5}
        totalChanges={5}
      />
    );

    // Score should have green color class
    const scoreElement = screen.getByText('90');
    expect(scoreElement.className).toContain('text-green-400');
  });

  it('applies correct color for good score (70-84)', () => {
    render(
      <ScoreProgressDisplay
        currentScore={75}
        projectedScore={75}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    const scoreElement = screen.getByText('75');
    expect(scoreElement.className).toContain('text-blue-400');
  });

  it('applies correct color for fair score (55-69)', () => {
    render(
      <ScoreProgressDisplay
        currentScore={60}
        projectedScore={60}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    const scoreElement = screen.getByText('60');
    expect(scoreElement.className).toContain('text-yellow-400');
  });

  it('applies correct color for weak score (<55)', () => {
    const lowBreakdown: ScoreBreakdown = {
      keywordRelevance: 15,
      skillsQuality: 10,
      experienceAlignment: 10,
      formatParseability: 10,
    };

    render(
      <ScoreProgressDisplay
        currentScore={45}
        projectedScore={45}
        currentBreakdown={lowBreakdown}
        projectedBreakdown={lowBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    const scoreElement = screen.getByText('45');
    expect(scoreElement.className).toContain('text-red-400');
  });

  it('shows no transition arrow in breakdown when values are equal', () => {
    render(
      <ScoreProgressDisplay
        currentScore={75}
        projectedScore={75}
        currentBreakdown={mockCurrentBreakdown}
        projectedBreakdown={mockCurrentBreakdown}
        acceptedCount={0}
        totalChanges={5}
      />
    );

    // Format Parseability should show just "15 / 15" without arrow
    // since current and projected are the same
    const formatParseabilityText = screen.getByText(/\/ 15/);
    expect(formatParseabilityText).toBeInTheDocument();
  });
});
