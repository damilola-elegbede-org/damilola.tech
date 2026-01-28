import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from '@/components/admin/Pagination';

describe('Pagination', () => {
  it('renders Load More button when hasMore is true', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    expect(screen.getByRole('button', { name: 'Load More' })).toBeInTheDocument();
  });

  it('does not render when hasMore is false', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={false} onLoadMore={onLoadMore} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onLoadMore when button is clicked', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    const button = screen.getByRole('button', { name: 'Load More' });
    fireEvent.click(button);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows Loading... text when isLoading is true', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} isLoading={true} />);

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('disables button when isLoading is true', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Loading...' });
    expect(button).toBeDisabled();
  });

  it('does not call onLoadMore when button is clicked while loading', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Loading...' });
    fireEvent.click(button);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('enables button when isLoading is false', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} isLoading={false} />);

    const button = screen.getByRole('button', { name: 'Load More' });
    expect(button).not.toBeDisabled();
  });

  it('applies correct styling classes to button', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    const button = screen.getByRole('button', { name: 'Load More' });
    expect(button).toHaveClass('rounded-lg');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('border-[var(--color-border)]');
    expect(button).toHaveClass('bg-[var(--color-card)]');
    expect(button).toHaveClass('px-4');
    expect(button).toHaveClass('py-2');
    expect(button).toHaveClass('text-sm');
    expect(button).toHaveClass('text-[var(--color-text)]');
  });

  it('applies disabled opacity when isLoading is true', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Loading...' });
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('handles isLoading prop being undefined (defaults to false)', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    const button = screen.getByRole('button', { name: 'Load More' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Load More');
  });

  it('renders with correct container styling', () => {
    const onLoadMore = vi.fn();
    const { container } = render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    const wrapper = container.querySelector('div');
    expect(wrapper).toHaveClass('mt-4');
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('justify-center');
  });

  it('can be clicked multiple times when not loading', () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore={true} onLoadMore={onLoadMore} />);

    const button = screen.getByRole('button', { name: 'Load More' });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onLoadMore).toHaveBeenCalledTimes(3);
  });

  it('returns null and renders nothing when hasMore is false', () => {
    const onLoadMore = vi.fn();
    const { container } = render(<Pagination hasMore={false} onLoadMore={onLoadMore} />);

    expect(container.firstChild).toBeNull();
  });
});
