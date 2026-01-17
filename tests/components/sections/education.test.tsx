import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Education } from '@/components/sections/education';

describe('Education', () => {
  it('renders the section heading', () => {
    render(<Education />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Education');
  });

  it('renders all degrees', () => {
    render(<Education />);
    expect(screen.getByText('MBA')).toBeInTheDocument();
    expect(screen.getByText('MS Computer Science')).toBeInTheDocument();
    expect(screen.getByText(/BS Electrical & Computer Engineering/i)).toBeInTheDocument();
  });

  it('renders all institutions', () => {
    render(<Education />);
    expect(screen.getByText(/Leeds School of Business/i)).toBeInTheDocument();
    expect(screen.getByText(/University of Colorado Boulder/i)).toBeInTheDocument();
    expect(screen.getByText(/University of Wisconsin-Madison/i)).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<Education />);
    expect(document.getElementById('education')).toBeInTheDocument();
  });
});
