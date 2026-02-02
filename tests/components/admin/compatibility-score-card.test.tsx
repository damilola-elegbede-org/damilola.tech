import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CompatibilityScoreCard } from '@/components/admin/CompatibilityScoreCard';
import type { ScoreBreakdown } from '@/lib/types/resume-generation';

const mockBreakdown: ScoreBreakdown = {
  keywordRelevance: 28,
  skillsQuality: 18,
  experienceAlignment: 16,
  formatParseability: 10,
};

describe('CompatibilityScoreCard', () => {
  it('renders score and title', () => {
    render(
      <CompatibilityScoreCard
        title="Current Score"
        score={72}
        breakdown={mockBreakdown}
        assessment="Good foundation"
      />
    );

    expect(screen.getByText('Current Score')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('shows target score with arrow format when targetScore is provided', () => {
    render(
      <CompatibilityScoreCard
        title="Current Score"
        score={60}
        breakdown={mockBreakdown}
        assessment="After 3 changes"
        targetScore={85}
      />
    );

    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('does not show arrow when targetScore equals score', () => {
    render(
      <CompatibilityScoreCard
        title="Current Score"
        score={85}
        breakdown={mockBreakdown}
        assessment="Maximum achieved"
        targetScore={85}
      />
    );

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  it('shows correct score label for excellent score (85+)', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={90}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows correct score label for good score (70-84)', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={75}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows correct score label for fair score (55-69)', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={60}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('shows correct score label for weak score (<55)', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={45}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('displays assessment text', () => {
    const assessment = 'Good foundation but missing key keywords';
    render(
      <CompatibilityScoreCard
        title="Test"
        score={72}
        breakdown={mockBreakdown}
        assessment={assessment}
      />
    );

    expect(screen.getByText(assessment)).toBeInTheDocument();
  });

  it('displays all breakdown categories', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={72}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('Keyword Relevance')).toBeInTheDocument();
    expect(screen.getByText('Skills Quality')).toBeInTheDocument();
    expect(screen.getByText('Experience Alignment')).toBeInTheDocument();
    expect(screen.getByText('Format Parseability')).toBeInTheDocument();
  });

  it('displays breakdown values with max values', () => {
    render(
      <CompatibilityScoreCard
        title="Test"
        score={72}
        breakdown={mockBreakdown}
        assessment="Test"
      />
    );

    expect(screen.getByText('28/40')).toBeInTheDocument();
    expect(screen.getByText('18/25')).toBeInTheDocument();
    expect(screen.getByText('16/20')).toBeInTheDocument();
    expect(screen.getByText('10/15')).toBeInTheDocument();
  });

  it('handles edge case of 0 score', () => {
    const zeroBreakdown: ScoreBreakdown = {
      keywordRelevance: 0,
      skillsQuality: 0,
      experienceAlignment: 0,
      formatParseability: 0,
    };

    render(
      <CompatibilityScoreCard
        title="Test"
        score={0}
        breakdown={zeroBreakdown}
        assessment="No match"
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('handles edge case of 100 score', () => {
    const perfectBreakdown: ScoreBreakdown = {
      keywordRelevance: 40,
      skillsQuality: 25,
      experienceAlignment: 20,
      formatParseability: 15,
    };

    render(
      <CompatibilityScoreCard
        title="Test"
        score={100}
        breakdown={perfectBreakdown}
        assessment="Perfect match"
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });
});
