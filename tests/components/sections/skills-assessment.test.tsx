import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkillsAssessment } from '@/components/sections/skills-assessment';

describe('SkillsAssessment', () => {
  it('renders the section heading', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Skills Assessment');
  });

  it('renders expert skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Expert' })).toBeInTheDocument();
    expect(screen.getByText('Cross-Functional Leadership')).toBeInTheDocument();
  });

  it('renders proficient skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Proficient' })).toBeInTheDocument();
    expect(screen.getByText('GCP')).toBeInTheDocument();
  });

  it('renders familiar skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Familiar' })).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<SkillsAssessment />);
    expect(document.getElementById('skills-assessment')).toBeInTheDocument();
  });
});
