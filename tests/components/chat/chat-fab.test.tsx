import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatFab } from '@/components/chat/chat-fab';

describe('ChatFab', () => {
  it('renders the button', () => {
    render(<ChatFab onClick={() => {}} isOpen={false} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ChatFab onClick={handleClick} isOpen={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows chat icon when closed', () => {
    render(<ChatFab onClick={() => {}} isOpen={false} />);
    expect(screen.getByLabelText('Open chat')).toBeInTheDocument();
  });

  it('shows close icon when open', () => {
    render(<ChatFab onClick={() => {}} isOpen={true} />);
    expect(screen.getByLabelText('Close chat')).toBeInTheDocument();
  });

  it('applies different styles when open vs closed', () => {
    const { rerender } = render(<ChatFab onClick={() => {}} isOpen={false} />);
    expect(screen.getByRole('button')).toHaveClass('bg-[var(--color-accent)]');

    rerender(<ChatFab onClick={() => {}} isOpen={true} />);
    expect(screen.getByRole('button')).toHaveClass('bg-[var(--color-text-muted)]');
  });
});
