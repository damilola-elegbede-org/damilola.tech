import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminNav } from '@/components/admin/AdminNav';

// Mock next/navigation
const mockPathname = vi.fn(() => '/admin/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock AdminNav component
vi.mock('@/components/admin/AdminNav', () => ({
  AdminNav: vi.fn(() => <div data-testid="admin-nav">Admin Navigation</div>),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children content', () => {
    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('includes AdminNav component when not on login page', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    render(
      <AdminLayout>
        <div>Dashboard Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
    expect(AdminNav).toHaveBeenCalled();
  });

  it('does not include AdminNav on login page', () => {
    mockPathname.mockReturnValue('/admin/login');

    render(
      <AdminLayout>
        <div>Login Form</div>
      </AdminLayout>
    );

    expect(screen.queryByTestId('admin-nav')).not.toBeInTheDocument();
    expect(AdminNav).not.toHaveBeenCalled();
  });

  it('renders children directly on login page without layout wrapper', () => {
    mockPathname.mockReturnValue('/admin/login');

    const { container } = render(
      <AdminLayout>
        <div>Login Form</div>
      </AdminLayout>
    );

    // Should not have the layout wrapper div with flex classes
    expect(container.querySelector('.flex.min-h-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Login Form')).toBeInTheDocument();
  });

  it('has correct layout structure when not on login page', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Dashboard Content</div>
      </AdminLayout>
    );

    // Check for main layout container
    const layoutDiv = container.querySelector('.flex.min-h-screen');
    expect(layoutDiv).toBeInTheDocument();
    expect(layoutDiv).toHaveClass('bg-[var(--color-bg)]');
  });

  it('wraps children in main element with correct classes', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Dashboard Content</div>
      </AdminLayout>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveClass('flex-1');
    expect(mainElement).toHaveClass('overflow-auto');
    expect(mainElement).toHaveClass('p-6');
  });

  it('renders multiple children correctly', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    render(
      <AdminLayout>
        <div>First Child</div>
        <div>Second Child</div>
        <div>Third Child</div>
      </AdminLayout>
    );

    expect(screen.getByText('First Child')).toBeInTheDocument();
    expect(screen.getByText('Second Child')).toBeInTheDocument();
    expect(screen.getByText('Third Child')).toBeInTheDocument();
  });

  it('preserves children structure on login page', () => {
    mockPathname.mockReturnValue('/admin/login');

    render(
      <AdminLayout>
        <div data-testid="login-container">
          <h1>Login</h1>
          <form>Login Form</form>
        </div>
      </AdminLayout>
    );

    const loginContainer = screen.getByTestId('login-container');
    expect(loginContainer).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Login Form')).toBeInTheDocument();
  });

  it('correctly identifies login page by exact pathname match', () => {
    mockPathname.mockReturnValue('/admin/login');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.queryByTestId('admin-nav')).not.toBeInTheDocument();
  });

  it('shows navigation for dashboard page', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('shows navigation for traffic page', () => {
    mockPathname.mockReturnValue('/admin/traffic');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('shows navigation for usage page', () => {
    mockPathname.mockReturnValue('/admin/usage');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('shows navigation for chats page', () => {
    mockPathname.mockReturnValue('/admin/chats');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('shows navigation for fit assessments page', () => {
    mockPathname.mockReturnValue('/admin/fit-assessments');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('shows navigation for nested routes', () => {
    mockPathname.mockReturnValue('/admin/chats/123');

    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('has correct responsive flex layout', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    const layoutDiv = container.querySelector('.flex.min-h-screen');
    expect(layoutDiv).toHaveClass('flex');
    expect(layoutDiv).toHaveClass('min-h-screen');
  });

  it('main content area takes remaining space with flex-1', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).toHaveClass('flex-1');
  });

  it('main content area has overflow handling', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).toHaveClass('overflow-auto');
  });

  it('applies consistent padding to main content area', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    const { container } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    );

    const mainElement = container.querySelector('main');
    expect(mainElement).toHaveClass('p-6');
  });

  it('renders with complex nested children structure', () => {
    mockPathname.mockReturnValue('/admin/dashboard');

    render(
      <AdminLayout>
        <div>
          <header>Page Header</header>
          <section>
            <article>Nested Content</article>
          </section>
          <footer>Page Footer</footer>
        </div>
      </AdminLayout>
    );

    expect(screen.getByText('Page Header')).toBeInTheDocument();
    expect(screen.getByText('Nested Content')).toBeInTheDocument();
    expect(screen.getByText('Page Footer')).toBeInTheDocument();
  });
});
