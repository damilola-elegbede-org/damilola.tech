import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InitialsBadge } from '@/components/ui/initials-badge';

describe('InitialsBadge', () => {
  it('renders default initials', () => {
    render(<InitialsBadge />);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('renders custom initials', () => {
    render(<InitialsBadge initials="JD" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InitialsBadge className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
