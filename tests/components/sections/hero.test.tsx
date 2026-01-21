import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Hero } from '@/components/sections/hero';

describe('Hero', () => {
  it('renders the name', () => {
    render(<Hero onOpenChat={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Damilola Elegbede');
  });

  it('renders the title', () => {
    render(<Hero onOpenChat={() => {}} />);
    // Title appears as both the main title and in the role bubbles
    const titleElements = screen.getAllByText('Engineering Manager');
    expect(titleElements.length).toBeGreaterThanOrEqual(1);
    // Verify the main title has accent color styling
    const mainTitle = titleElements.find(el =>
      el.classList.contains('text-3xl') || el.classList.contains('text-4xl')
    );
    expect(mainTitle).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<Hero onOpenChat={() => {}} />);
    expect(
      screen.getByText('I build engineering organizations that deliver results, retain top talent, and develop leaders')
    ).toBeInTheDocument();
  });

  it('renders the CTA button', () => {
    render(<Hero onOpenChat={() => {}} />);
    expect(screen.getByRole('button', { name: /ask ai about me/i })).toBeInTheDocument();
  });

  it('calls onOpenChat when CTA is clicked', () => {
    const handleOpenChat = vi.fn();
    render(<Hero onOpenChat={handleOpenChat} />);
    fireEvent.click(screen.getByRole('button', { name: /ask ai about me/i }));
    expect(handleOpenChat).toHaveBeenCalledTimes(1);
  });

  it('has correct section id for navigation', () => {
    render(<Hero onOpenChat={() => {}} />);
    expect(document.getElementById('hero')).toBeInTheDocument();
  });
});
