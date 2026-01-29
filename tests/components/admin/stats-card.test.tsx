import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCard } from '@/components/admin/StatsCard';

describe('StatsCard', () => {
  it('renders title correctly', () => {
    render(<StatsCard title="Total Users" value={100} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
  });

  it('renders numeric value with formatting', () => {
    render(<StatsCard title="Total Views" value={1500} />);
    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('renders string value without formatting', () => {
    render(<StatsCard title="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatsCard title="Total Users" value={100} subtitle="+12% from last month" />);
    expect(screen.getByText('+12% from last month')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<StatsCard title="Total Users" value={100} />);
    expect(screen.queryByText('+12% from last month')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const iconPath = 'M12 4v16m8-8H4';
    const { container } = render(<StatsCard title="Total Users" value={100} icon={iconPath} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const path = svg?.querySelector('path');
    expect(path).toHaveAttribute('d', iconPath);
  });

  it('does not render icon container when icon not provided', () => {
    const { container } = render(<StatsCard title="Total Users" value={100} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  describe('number formatting', () => {
    it('formats numbers >= 1,000,000 with M suffix', () => {
      render(<StatsCard title="Large Number" value={2500000} />);
      expect(screen.getByText('2.5M')).toBeInTheDocument();
    });

    it('formats numbers >= 1,000 with K suffix', () => {
      render(<StatsCard title="Medium Number" value={11000} />);
      expect(screen.getByText('11.0K')).toBeInTheDocument();
    });

    it('formats numbers < 1,000 with locale formatting', () => {
      render(<StatsCard title="Small Number" value={999} />);
      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('formats edge case at exactly 1,000', () => {
      render(<StatsCard title="Edge Case" value={1000} />);
      expect(screen.getByText('1.0K')).toBeInTheDocument();
    });

    it('formats edge case at exactly 1,000,000', () => {
      render(<StatsCard title="Edge Case" value={1000000} />);
      expect(screen.getByText('1.0M')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies correct container classes', () => {
      const { container } = render(<StatsCard title="Test" value={100} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-[var(--color-border)]');
      expect(card).toHaveClass('bg-[var(--color-card)]');
      expect(card).toHaveClass('p-6');
    });

    it('applies correct title styling', () => {
      render(<StatsCard title="Test Title" value={100} />);
      const title = screen.getByText('Test Title');
      expect(title).toHaveClass('text-sm');
      expect(title).toHaveClass('font-medium');
      expect(title).toHaveClass('text-[var(--color-text-muted)]');
    });

    it('applies correct value styling', () => {
      render(<StatsCard title="Test" value={100} />);
      const value = screen.getByText('100');
      expect(value).toHaveClass('mt-2');
      expect(value).toHaveClass('text-3xl');
      expect(value).toHaveClass('font-semibold');
      expect(value).toHaveClass('text-[var(--color-text)]');
    });

    it('applies correct subtitle styling', () => {
      render(<StatsCard title="Test" value={100} subtitle="Subtitle text" />);
      const subtitle = screen.getByText('Subtitle text');
      expect(subtitle).toHaveClass('mt-1');
      expect(subtitle).toHaveClass('text-sm');
      expect(subtitle).toHaveClass('text-[var(--color-text-muted)]');
    });

    it('applies correct icon container styling', () => {
      const { container } = render(<StatsCard title="Test" value={100} icon="M12 4v16" />);
      const iconContainer = container.querySelector('.rounded-lg.bg-\\[var\\(--color-accent\\)\\]\\/10');
      expect(iconContainer).toHaveClass('p-3');
    });

    it('applies correct icon SVG styling', () => {
      const { container } = render(<StatsCard title="Test" value={100} icon="M12 4v16" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-6');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('text-[var(--color-accent)]');
    });
  });

  describe('accessibility', () => {
    it('renders semantic HTML structure', () => {
      const { container } = render(<StatsCard title="Test" value={100} subtitle="Subtitle" />);
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(3); // title, value, subtitle
    });

    it('icon SVG has proper attributes', () => {
      const { container } = render(<StatsCard title="Test" value={100} icon="M12 4v16" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('stroke-linecap', 'round');
      expect(path).toHaveAttribute('stroke-linejoin', 'round');
      expect(path).toHaveAttribute('stroke-width', '1.5');
    });
  });

  describe('layout', () => {
    it('uses flex layout for content and icon', () => {
      const { container } = render(<StatsCard title="Test" value={100} icon="M12 4v16" />);
      const flexContainer = container.querySelector('.flex.items-start.justify-between');
      expect(flexContainer).toBeInTheDocument();
    });
  });
});
