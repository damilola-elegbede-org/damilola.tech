import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Contact } from '@/components/sections/contact';

describe('Contact', () => {
  it('renders social links', () => {
    render(<Contact />);
    expect(screen.getByRole('link', { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /linkedin/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /email/i })).toBeInTheDocument();
  });

  it('renders email link', () => {
    render(<Contact />);
    const emailLink = screen.getByRole('link', { name: /email/i });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute('href', 'mailto:damilola.elegbede@gmail.com');
  });

  it('renders LinkedIn link', () => {
    render(<Contact />);
    const linkedInLink = screen.getByRole('link', { name: /linkedin/i });
    expect(linkedInLink).toBeInTheDocument();
    expect(linkedInLink).toHaveAttribute('href', 'https://linkedin.com/in/damilola-elegbede');
    expect(linkedInLink).toHaveAttribute('target', '_blank');
    expect(linkedInLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders location', () => {
    render(<Contact />);
    expect(screen.getByText('Boulder, CO')).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<Contact />);
    expect(document.getElementById('contact')).toBeInTheDocument();
  });
});
