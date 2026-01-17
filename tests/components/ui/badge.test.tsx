import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-[var(--color-bg-alt)]');
  });

  it('applies outline variant styles', () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText('Outline');
    expect(badge).toHaveClass('border');
    expect(badge).toHaveClass('bg-[var(--color-card)]');
  });

  it('applies accent variant styles', () => {
    render(<Badge variant="accent">Accent</Badge>);
    const badge = screen.getByText('Accent');
    expect(badge).toHaveClass('bg-[var(--color-accent)]');
    expect(badge).toHaveClass('text-white');
  });

  it('merges custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });
});
