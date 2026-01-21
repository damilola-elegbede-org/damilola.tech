import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackToTop } from '@/components/ui/back-to-top';

describe('BackToTop', () => {
  beforeEach(() => {
    // Mock window.scrollTo
    window.scrollTo = vi.fn();
    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('renders button with correct aria-label', () => {
    render(<BackToTop />);
    const button = document.querySelector('button[aria-label="Back to top"]');
    expect(button).toBeInTheDocument();
  });

  it('is hidden from accessibility tree when scroll position is at top', () => {
    render(<BackToTop />);
    const button = document.querySelector('button[aria-label="Back to top"]');
    expect(button).toHaveClass('opacity-0');
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes visible when scrolled past threshold', () => {
    render(<BackToTop showAfter={400} />);

    // Simulate scroll
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /back to top/i });
    expect(button).toHaveClass('opacity-100');
    expect(button).toHaveAttribute('aria-hidden', 'false');
  });

  it('scrolls to top when clicked', () => {
    render(<BackToTop />);
    const button = document.querySelector('button[aria-label="Back to top"]') as HTMLButtonElement;

    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('applies custom className', () => {
    render(<BackToTop className="custom-class" />);
    const button = document.querySelector('button[aria-label="Back to top"]');
    expect(button).toHaveClass('custom-class');
  });
});
