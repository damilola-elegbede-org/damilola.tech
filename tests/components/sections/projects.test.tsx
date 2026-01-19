import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Projects } from '@/components/sections/projects';

vi.mock('@/hooks/use-scroll-reveal', () => ({
  useScrollReveal: () => ({
    ref: { current: null },
    isVisible: true,
  }),
}));

describe('Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section heading', () => {
    render(<Projects />);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  it('renders all project cards', () => {
    render(<Projects />);

    expect(screen.getByRole('heading', { name: 'A Lo Cubano Boulder Fest' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'damilola.tech' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pipedream Automation Suite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Claude Configuration System' })).toBeInTheDocument();
  });

  it('renders section with correct id for navigation', () => {
    render(<Projects />);
    const section = document.getElementById('projects');
    expect(section).toBeInTheDocument();
    expect(section?.tagName.toLowerCase()).toBe('section');
  });

  it('renders project descriptions', () => {
    render(<Projects />);

    expect(
      screen.getByText(/Complete ticketing and event management system/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Personal portfolio with an AI chatbot/i)
    ).toBeInTheDocument();
  });

  it('renders tech stack badges for projects', () => {
    render(<Projects />);

    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    // Claude API appears in multiple projects
    expect(screen.getAllByText('Claude API').length).toBeGreaterThan(0);
  });

  it('renders project links', () => {
    render(<Projects />);

    const liveLinks = screen.getAllByRole('link', { name: /live site/i });
    const githubLinks = screen.getAllByRole('link', { name: /github/i });

    expect(liveLinks.length).toBeGreaterThan(0);
    expect(githubLinks.length).toBeGreaterThan(0);
  });
});
