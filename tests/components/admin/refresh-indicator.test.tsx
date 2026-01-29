import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RefreshIndicator } from '@/components/admin/RefreshIndicator';

describe('RefreshIndicator', () => {
  describe('Visibility', () => {
    it('renders when isRefreshing is true', () => {
      render(<RefreshIndicator isRefreshing={true} />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    it('does not render when isRefreshing is false', () => {
      render(<RefreshIndicator isRefreshing={false} />);

      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();
    });

    it('returns null when isRefreshing is false', () => {
      const { container } = render(<RefreshIndicator isRefreshing={false} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Loading Spinner', () => {
    it('shows loading spinner when refreshing', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      // Find the spinner element by its classes
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('spinner has correct animation classes', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');
      expect(spinner).toHaveClass('rounded-full');
      expect(spinner).toHaveClass('border-2');
    });

    it('spinner has accent color border', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-[var(--color-accent)]');
      expect(spinner).toHaveClass('border-t-transparent');
    });
  });

  describe('Styling', () => {
    it('has fixed positioning at top center', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const wrapper = container.querySelector('.fixed');
      expect(wrapper).toHaveClass('fixed');
      expect(wrapper).toHaveClass('left-1/2');
      expect(wrapper).toHaveClass('top-4');
      expect(wrapper).toHaveClass('-translate-x-1/2');
    });

    it('has high z-index for overlay', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const wrapper = container.querySelector('.fixed');
      expect(wrapper).toHaveClass('z-50');
    });

    it('has correct card styling', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const card = container.querySelector('.flex.items-center');
      expect(card).toHaveClass('rounded-full');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-[var(--color-border)]');
      expect(card).toHaveClass('bg-[var(--color-card)]');
      expect(card).toHaveClass('shadow-lg');
    });

    it('has correct padding and spacing', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const card = container.querySelector('.flex.items-center');
      expect(card).toHaveClass('px-4');
      expect(card).toHaveClass('py-2');
      expect(card).toHaveClass('gap-2');
    });

    it('has muted text color', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const card = container.querySelector('.flex.items-center');
      expect(card).toHaveClass('text-[var(--color-text-muted)]');
      expect(card).toHaveClass('text-sm');
    });
  });

  describe('Content', () => {
    it('displays "Refreshing..." text', () => {
      render(<RefreshIndicator isRefreshing={true} />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    it('text appears next to spinner', () => {
      const { container } = render(<RefreshIndicator isRefreshing={true} />);

      const card = container.querySelector('.flex.items-center');
      expect(card?.textContent).toContain('Refreshing...');

      const spinner = card?.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('State Changes', () => {
    it('shows indicator when state changes from false to true', () => {
      const { rerender } = render(<RefreshIndicator isRefreshing={false} />);

      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();

      rerender(<RefreshIndicator isRefreshing={true} />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    it('hides indicator when state changes from true to false', () => {
      const { rerender } = render(<RefreshIndicator isRefreshing={true} />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();

      rerender(<RefreshIndicator isRefreshing={false} />);

      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();
    });

    it('can toggle state multiple times', () => {
      const { rerender } = render(<RefreshIndicator isRefreshing={false} />);

      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();

      rerender(<RefreshIndicator isRefreshing={true} />);
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();

      rerender(<RefreshIndicator isRefreshing={false} />);
      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();

      rerender(<RefreshIndicator isRefreshing={true} />);
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });
});
