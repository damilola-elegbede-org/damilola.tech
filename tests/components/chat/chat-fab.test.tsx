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

  it('renders nothing when open', () => {
    const { container } = render(<ChatFab onClick={() => {}} isOpen={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('only renders when closed', () => {
    const { rerender, container } = render(<ChatFab onClick={() => {}} isOpen={false} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<ChatFab onClick={() => {}} isOpen={true} />);
    expect(container.firstChild).toBeNull();
  });
});
