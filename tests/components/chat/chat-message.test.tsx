import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatMessage } from '@/components/chat/chat-message';

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage role="user" content="Hello, world!" />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<ChatMessage role="assistant" content="Hello! How can I help?" />);
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('applies user message styles', () => {
    render(<ChatMessage role="user" content="User message" />);
    const message = screen.getByText('User message').closest('div');
    expect(message).toHaveClass('bg-[var(--color-accent)]');
    expect(message).toHaveClass('text-white');
  });

  it('applies assistant message styles', () => {
    render(<ChatMessage role="assistant" content="Assistant message" />);
    const messageContainer = screen.getByText('Assistant message').closest('.rounded-2xl');
    expect(messageContainer).toHaveClass('bg-[var(--color-bg-alt)]');
  });

  it('renders markdown in assistant messages', () => {
    render(<ChatMessage role="assistant" content="**Bold text**" />);
    expect(screen.getByText('Bold text')).toBeInTheDocument();
  });

  it('user messages align to the right', () => {
    render(<ChatMessage role="user" content="Right aligned" />);
    const wrapper = screen.getByText('Right aligned').closest('.flex');
    expect(wrapper).toHaveClass('justify-end');
  });

  it('assistant messages align to the left', () => {
    render(<ChatMessage role="assistant" content="Left aligned" />);
    const wrapper = screen.getByText('Left aligned').closest('.mb-4');
    expect(wrapper).toHaveClass('justify-start');
  });
});
