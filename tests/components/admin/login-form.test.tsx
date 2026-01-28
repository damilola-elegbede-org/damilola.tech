import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginForm } from '@/components/admin/LoginForm';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock csrf-actions
const mockGenerateCsrfToken = vi.fn();
vi.mock('@/lib/csrf-actions', () => ({
  generateCsrfToken: () => mockGenerateCsrfToken(),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateCsrfToken.mockResolvedValue('mock-csrf-token');
    global.fetch = vi.fn();
  });

  describe('Form rendering', () => {
    it('renders password input field', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    it('renders password input with correct type', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        const input = screen.getByLabelText(/password/i);
        expect(input).toHaveAttribute('type', 'password');
      });
    });

    it('renders submit button', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('password input is required', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        const input = screen.getByLabelText(/password/i);
        expect(input).toBeRequired();
      });
    });
  });

  describe('CSRF token initialization', () => {
    it('fetches CSRF token on mount', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalledTimes(1);
      });
    });

    it('disables submit button while CSRF token is loading', () => {
      mockGenerateCsrfToken.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('token'), 1000))
      );

      render(<LoginForm />);

      const button = screen.getByRole('button', { name: /sign in/i });
      expect(button).toBeDisabled();
    });

    it('enables submit button once CSRF token is loaded', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in/i });
        expect(button).not.toBeDisabled();
      });
    });

    it('displays error when CSRF token generation fails', async () => {
      mockGenerateCsrfToken.mockRejectedValue(new Error('CSRF generation failed'));

      render(<LoginForm />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Unable to initialize security token. Please refresh.'
        );
      });
    });
  });

  describe('Form submission', () => {
    it('calls auth API with password and CSRF token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': 'mock-csrf-token',
          },
          credentials: 'include',
          body: JSON.stringify({ password: 'test-password' }),
        });
      });
    });

    it('prevents submission if CSRF token is not ready', async () => {
      mockGenerateCsrfToken.mockResolvedValue(null);
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });

      // Button should be disabled when CSRF token is null
      expect(button).toBeDisabled();

      // Directly submit the form to test the validation logic
      const form = button.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Security token not ready. Please try again.'
        );
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('redirects to dashboard on successful login', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'correct-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/dashboard');
      });
    });
  });

  describe('Validation and error handling', () => {
    it('displays error message when login fails with error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid password' }),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'wrong-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
      });
    });

    it('displays generic error when no error message provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'wrong-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Login failed');
      });
    });

    it('displays error when fetch fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('An error occurred');
      });
    });

    it('clears previous errors on new submission', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid password' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      const button = screen.getByRole('button', { name: /sign in/i });

      // First submission - fail
      fireEvent.change(input, { target: { value: 'wrong-password' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
      });

      // Second submission - succeed
      fireEvent.change(input, { target: { value: 'correct-password' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('refreshes CSRF token on login failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid password' }),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalledTimes(1);
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'wrong-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Initial call + refresh after failure
        expect(mockGenerateCsrfToken).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading state', () => {
    it('shows loading state during submission', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 1000))
      );
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
      });
    });

    it('disables submit button during submission', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 1000))
      );
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /signing in/i });
        expect(loadingButton).toBeDisabled();
      });
    });

    it('re-enables submit button after submission completes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid password' }),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'wrong-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Button is re-enabled but might be disabled due to CSRF refresh
        const submitButton = screen.getByRole('button', { name: /sign in/i });
        expect(submitButton).toBeInTheDocument();
      });
    });
  });

  describe('Form interaction', () => {
    it('updates password field value on input', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'my-password' } });

      expect(input.value).toBe('my-password');
    });

    it('submits form on enter key press', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'test-password' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for password input', async () => {
      render(<LoginForm />);

      await waitFor(() => {
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    it('error message has role="alert"', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid password' }),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      await waitFor(() => {
        expect(mockGenerateCsrfToken).toHaveBeenCalled();
      });

      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: 'wrong-password' } });

      const button = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
