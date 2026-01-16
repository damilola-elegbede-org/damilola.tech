import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { About } from '@/components/sections/about';

describe('About', () => {
  it('renders the section heading', () => {
    render(<About />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('About');
  });

  it('renders the branding statement', () => {
    render(<About />);
    expect(screen.getByText(/engineer at heart with business acumen/i)).toBeInTheDocument();
  });

  it('mentions years of experience', () => {
    render(<About />);
    expect(screen.getByText(/15\+ years/i)).toBeInTheDocument();
  });

  it('mentions key companies', () => {
    render(<About />);
    expect(screen.getByText(/Verily Life Sciences/i)).toBeInTheDocument();
    expect(screen.getByText(/Qualcomm/i)).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<About />);
    expect(document.getElementById('about')).toBeInTheDocument();
  });
});
