import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Experience } from '@/components/sections/experience';

// Mock dependencies
vi.mock('@/hooks/use-scroll-reveal', () => ({
  useScrollReveal: () => ({
    ref: { current: null },
    isVisible: true,
  }),
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    experiences: [
      {
        id: 'verily',
        company: 'Verily Life Sciences',
        title: 'Engineering Manager - Cloud Infrastructure & Developer Experience',
        location: 'Boulder, CO',
        startDate: 'Sep 2022',
        endDate: 'Nov 2024',
        highlights: [
          'Architected and executed enterprise-wide GCP cloud transformation supporting 30+ production systems',
          'Built Cloud Infrastructure and developer experience functions from ground up',
          'Drove platform efficiency initiatives reducing GitHub Actions usage by 30%',
          'Led executive stakeholder alignment across Engineering, Product, and Security organizations',
        ],
      },
      {
        id: 'qualcomm-staff-manager',
        company: 'Qualcomm Technologies',
        title: 'Engineer, Senior Staff/Manager',
        location: 'Boulder, CO',
        startDate: 'Oct 2019',
        endDate: 'Jul 2022',
        highlights: [
          'Transformed customer support operations from reactive to proactive model',
          'Created self-service 5G training platform replacing quarterly live sessions',
        ],
      },
      {
        id: 'qualcomm-staff',
        company: 'Qualcomm Technologies',
        title: 'Engineer, Staff/Manager',
        location: 'Boulder, CO',
        startDate: 'Oct 2014',
        endDate: 'Oct 2019',
        highlights: [
          'Delivered 6 major 4G feature releases annually while maintaining 99.9% platform stability',
        ],
      },
      {
        id: 'qualcomm-senior',
        company: 'Qualcomm Technologies',
        title: 'Senior Engineer',
        location: 'Boulder, CO',
        startDate: 'Oct 2009',
        endDate: 'Oct 2014',
        highlights: [
          'Drove 40% productivity improvement through Scrum implementation',
        ],
      },
    ],
  },
}));

describe('Experience', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the section heading', async () => {
    render(<Experience />);
    expect(screen.getByRole('heading', { level: 2, name: 'Experience' })).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('has correct section id for navigation', async () => {
    render(<Experience />);
    const section = document.getElementById('experience');
    expect(section).toBeInTheDocument();
    expect(section?.tagName.toLowerCase()).toBe('section');

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders only first 3 experience cards initially', async () => {
    render(<Experience />);
    expect(screen.getByText('Verily Life Sciences')).toBeInTheDocument();
    expect(screen.getAllByText('Qualcomm Technologies').length).toBeGreaterThanOrEqual(1);
    // Senior Engineer role should not be visible initially
    expect(screen.queryByText('Senior Engineer')).not.toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders company names', async () => {
    render(<Experience />);
    expect(screen.getByText('Verily Life Sciences')).toBeInTheDocument();
    expect(screen.getAllByText('Qualcomm Technologies').length).toBeGreaterThanOrEqual(1);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders job titles', async () => {
    render(<Experience />);
    expect(
      screen.getByText('Engineering Manager - Cloud Infrastructure & Developer Experience')
    ).toBeInTheDocument();
    expect(screen.getByText('Engineer, Senior Staff/Manager')).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders date ranges correctly', async () => {
    render(<Experience />);
    expect(screen.getByText(/Sep 2022 - Nov 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 2019 - Jul 2022/)).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders location information', async () => {
    render(<Experience />);
    const boulderLocations = screen.getAllByText(/Boulder, CO/);
    expect(boulderLocations.length).toBeGreaterThan(0);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders highlights/bullet points', async () => {
    render(<Experience />);
    expect(
      screen.getByText(
        /Architected and executed enterprise-wide GCP cloud transformation supporting 30\+ production systems/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Transformed customer support operations from reactive to proactive model/
      )
    ).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('shows expand button when more than 3 experiences exist', async () => {
    render(<Experience />);
    const expandButton = screen.getByRole('button', { name: /Show 1 more position/ });
    expect(expandButton).toBeInTheDocument();

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('expands to show all experiences when expand button is clicked', async () => {
    render(<Experience />);

    // Initially 4th experience should not be visible
    expect(screen.queryByText('Senior Engineer')).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByRole('button', { name: /Show 1 more position/ });
    fireEvent.click(expandButton);

    // Now 4th experience should be visible
    await waitFor(() => {
      expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
    });
  });

  it('shows collapse button after expanding', async () => {
    render(<Experience />);

    // Click expand button
    const expandButton = screen.getByRole('button', { name: /Show 1 more position/ });
    fireEvent.click(expandButton);

    // Collapse button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Show less/ })).toBeInTheDocument();
    });
  });

  it('collapses experiences when show less is clicked', async () => {
    render(<Experience />);

    // Expand first
    const expandButton = screen.getByRole('button', { name: /Show 1 more position/ });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
    });

    // Then collapse
    const collapseButton = screen.getByRole('button', { name: /Show less/ });
    fireEvent.click(collapseButton);

    // 4th experience should be hidden again
    await waitFor(() => {
      expect(screen.queryByText('Senior Engineer')).not.toBeInTheDocument();
    });
  });

  it('fetches AI context on mount', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            verily: {
              strategicContext: 'Test strategic context',
              leadershipChallenge: 'Test leadership challenge',
              keyInsight: 'Test key insight',
            },
          }),
      })
    ) as unknown as typeof fetch;
    global.fetch = mockFetch;

    render(<Experience />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ai-context');
    });
  });

  it('handles AI context fetch failure gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetch = vi.fn(() => Promise.reject(new Error('Fetch failed')));
    global.fetch = mockFetch as unknown as typeof fetch;

    render(<Experience />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load AI context:',
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });

  it('applies correct CSS classes for alternate background', async () => {
    render(<Experience />);
    const section = document.getElementById('experience');
    expect(section).toHaveClass('bg-[var(--color-bg-alt)]');

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('handles singular form for "Show 1 more position"', async () => {
    render(<Experience />);
    const expandButton = screen.getByRole('button', { name: /Show 1 more position/ });
    expect(expandButton).toHaveTextContent('Show 1 more position');

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
