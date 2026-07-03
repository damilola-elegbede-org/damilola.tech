import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubActivity } from '@/components/sections/github-activity';

vi.mock('@/hooks/use-scroll-reveal', () => ({
  useScrollReveal: () => ({
    ref: { current: null },
    isVisible: true,
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GitHubActivity', () => {
  it('renders contribution count and repo cards on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        contributionCount: 42,
        repos: [
          {
            name: 'my-repo',
            description: 'A test repo',
            language: 'TypeScript',
            html_url: 'https://github.com/damilola-elegbede/my-repo',
            stargazers_count: 3,
          },
        ],
      }),
    });

    render(<GitHubActivity />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /engineering activity/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my-repo/i })).toHaveAttribute(
      'href',
      'https://github.com/damilola-elegbede/my-repo',
    );
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('renders section with correct id for navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ contributionCount: 1, repos: [] }),
    });

    render(<GitHubActivity />);

    await waitFor(() => {
      const section = document.getElementById('github-activity');
      expect(section).toBeInTheDocument();
      expect(section?.tagName.toLowerCase()).toBe('section');
    });
  });

  it('renders nothing once loaded with no contributions and no repos', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ contributionCount: 0, repos: [] }),
    });

    const { container } = render(<GitHubActivity />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('#github-activity')).not.toBeInTheDocument();
    });
  });

  it('renders nothing once loaded when the API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ contributionCount: 0, repos: [], error: 'GitHub token not configured' }),
    });

    const { container } = render(<GitHubActivity />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('#github-activity')).not.toBeInTheDocument();
    });
  });

  it('renders nothing when the fetch itself rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { container } = render(<GitHubActivity />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('#github-activity')).not.toBeInTheDocument();
    });
  });

  it('links to the full GitHub profile', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ contributionCount: 5, repos: [] }),
    });

    render(<GitHubActivity />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /view full github profile/i })).toHaveAttribute(
        'href',
        'https://github.com/damilola-elegbede',
      );
    });
  });
});
