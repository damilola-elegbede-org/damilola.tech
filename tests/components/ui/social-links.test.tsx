import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SocialLinks } from '@/components/ui/social-links';

describe('SocialLinks', () => {
  it('renders GitHub link', () => {
    render(<SocialLinks />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/damilola-elegbede');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders LinkedIn link', () => {
    render(<SocialLinks />);
    const link = screen.getByRole('link', { name: /linkedin/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://linkedin.com/in/damilola-elegbede');
  });

  it('renders Email link', () => {
    render(<SocialLinks />);
    const link = screen.getByRole('link', { name: /email/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'mailto:damilola.elegbede@gmail.com');
    // Email links should not have target="_blank"
    expect(link).not.toHaveAttribute('target');
  });

  it('applies custom className', () => {
    const { container } = render(<SocialLinks className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies correct size classes', () => {
    const { container, rerender } = render(<SocialLinks iconSize="sm" />);
    const links = container.querySelectorAll('a');
    links.forEach(link => expect(link).toHaveClass('h-5', 'w-5'));

    rerender(<SocialLinks iconSize="lg" />);
    const largeLinks = container.querySelectorAll('a');
    largeLinks.forEach(link => expect(link).toHaveClass('h-7', 'w-7'));
  });
});
