import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminNav } from '@/components/admin/AdminNav';

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/admin/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('AdminNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders navigation links correctly', () => {
    render(<AdminNav />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Traffic')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByText('Fit Assessments')).toBeInTheDocument();
    expect(screen.getByText('Resume Generator')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });

  it('renders Admin Portal title', () => {
    render(<AdminNav />);
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });

  it('has correct href attributes for navigation items', () => {
    render(<AdminNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    const trafficLink = screen.getByText('Traffic').closest('a');
    const usageLink = screen.getByText('Usage').closest('a');
    const chatsLink = screen.getByText('Chats').closest('a');
    const fitAssessmentsLink = screen.getByText('Fit Assessments').closest('a');
    const resumeGeneratorLink = screen.getByText('Resume Generator').closest('a');
    const auditLogLink = screen.getByText('Audit Log').closest('a');
    const docsLink = screen.getByText('Docs').closest('a');

    expect(dashboardLink).toHaveAttribute('href', '/admin/dashboard');
    expect(trafficLink).toHaveAttribute('href', '/admin/traffic');
    expect(usageLink).toHaveAttribute('href', '/admin/usage');
    expect(chatsLink).toHaveAttribute('href', '/admin/chats');
    expect(fitAssessmentsLink).toHaveAttribute('href', '/admin/fit-assessments');
    expect(resumeGeneratorLink).toHaveAttribute('href', '/admin/resume-generator');
    expect(auditLogLink).toHaveAttribute('href', '/admin/audit');
    expect(docsLink).toHaveAttribute('href', '/admin/docs');
  });

  it('applies active styles to current route', () => {
    mockPathname.mockReturnValue('/admin/traffic');
    render(<AdminNav />);

    const trafficLink = screen.getByText('Traffic').closest('a');
    const dashboardLink = screen.getByText('Dashboard').closest('a');

    expect(trafficLink).toHaveClass('bg-[var(--color-accent)]/10');
    expect(trafficLink).toHaveClass('text-[var(--color-accent)]');
    expect(dashboardLink).toHaveClass('text-[var(--color-text-muted)]');
    expect(dashboardLink).not.toHaveClass('text-[var(--color-accent)]');
  });

  it('applies active styles to nested routes', () => {
    mockPathname.mockReturnValue('/admin/chats/some-chat-id');
    render(<AdminNav />);

    const chatsLink = screen.getByText('Chats').closest('a');

    expect(chatsLink).toHaveClass('bg-[var(--color-accent)]/10');
    expect(chatsLink).toHaveClass('text-[var(--color-accent)]');
  });

  it('renders logout button', () => {
    render(<AdminNav />);
    const logoutButton = screen.getByText('Logout');
    expect(logoutButton).toBeInTheDocument();
    expect(logoutButton.tagName).toBe('BUTTON');
  });

  it('handles logout click correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    render(<AdminNav />);

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/auth', { method: 'DELETE' });

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });

  it('renders icons for all navigation items', () => {
    const { container } = render(<AdminNav />);

    // Each nav item has an SVG icon
    const svgElements = container.querySelectorAll('svg');
    // 9 nav items + 1 logout button = 10 SVG icons
    expect(svgElements.length).toBe(10);
  });

  it('applies hover styles to inactive links', () => {
    mockPathname.mockReturnValue('/admin/dashboard');
    render(<AdminNav />);

    const trafficLink = screen.getByText('Traffic').closest('a');

    expect(trafficLink).toHaveClass('hover:bg-[var(--color-bg-alt)]');
    expect(trafficLink).toHaveClass('hover:text-[var(--color-text)]');
  });

  it('maintains exact route match for dashboard', () => {
    mockPathname.mockReturnValue('/admin/dashboard');
    render(<AdminNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');

    expect(dashboardLink).toHaveClass('bg-[var(--color-accent)]/10');
    expect(dashboardLink).toHaveClass('text-[var(--color-accent)]');
  });

  it('does not apply active styles to partial matches', () => {
    mockPathname.mockReturnValue('/admin/traffic');
    render(<AdminNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    const usageLink = screen.getByText('Usage').closest('a');

    expect(dashboardLink).not.toHaveClass('text-[var(--color-accent)]');
    expect(usageLink).not.toHaveClass('text-[var(--color-accent)]');
  });

  it('renders navigation items with correct structure', () => {
    render(<AdminNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');

    // Check that it has the expected flex layout classes
    expect(dashboardLink).toHaveClass('flex');
    expect(dashboardLink).toHaveClass('items-center');
    expect(dashboardLink).toHaveClass('gap-3');
    expect(dashboardLink).toHaveClass('rounded-lg');
  });

  it('renders logout button with correct structure', () => {
    render(<AdminNav />);

    const logoutButton = screen.getByText('Logout').closest('button');

    expect(logoutButton).toHaveClass('flex');
    expect(logoutButton).toHaveClass('w-full');
    expect(logoutButton).toHaveClass('items-center');
    expect(logoutButton).toHaveClass('gap-3');
  });
});
