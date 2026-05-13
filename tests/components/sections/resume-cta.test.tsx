import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResumeCta } from '@/components/sections/resume-cta';

vi.mock('@/hooks/use-scroll-reveal', () => ({
  useScrollReveal: () => ({
    ref: { current: null },
    isVisible: true,
  }),
}));

describe('ResumeCta', () => {
  it('renders the CTA link to the resume generator', () => {
    render(<ResumeCta />);
    const link = screen.getByRole('link', { name: /try resume generator/i });
    expect(link).toHaveAttribute('href', '/admin/resume-generator');
  });

  it('indicates no account required', () => {
    render(<ResumeCta />);
    expect(screen.getByText(/no account required/i)).toBeInTheDocument();
  });

  it('renders section with correct id for navigation', () => {
    render(<ResumeCta />);
    const section = document.getElementById('resume-generator');
    expect(section).toBeInTheDocument();
    expect(section?.tagName.toLowerCase()).toBe('section');
  });

  it('communicates recruiter value proposition', () => {
    render(<ResumeCta />);
    expect(screen.getByRole('heading', { name: /tailored resume/i })).toBeInTheDocument();
  });
});
