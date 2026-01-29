import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditLogTable } from '@/components/admin/AuditLogTable';

const mockEvents = [
  {
    id: 'event-1',
    pathname: '/admin/audit',
    eventType: 'page_view',
    environment: 'production',
    timestamp: '2026-01-28T10:00:00.000Z',
    size: 512,
    url: 'https://example.com/event-1.json',
  },
  {
    id: 'event-2',
    pathname: '/admin/audit',
    eventType: 'admin_login_success',
    environment: 'production',
    timestamp: '2026-01-28T11:00:00.000Z',
    size: 256,
    url: 'https://example.com/event-2.json',
  },
  {
    id: 'event-3',
    pathname: '/admin/audit',
    eventType: 'chat_message_sent',
    environment: 'production',
    timestamp: '2026-01-28T09:00:00.000Z',
    size: 1024,
    url: 'https://example.com/event-3.json',
  },
];

const mockEventDetails = {
  eventType: 'page_view',
  timestamp: '2026-01-28T10:00:00.000Z',
  sessionId: 'session-123',
  path: '/home',
  metadata: {
    userAgent: 'Mozilla/5.0',
  },
};

describe('AuditLogTable', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading spinner when isLoading is true', () => {
      render(<AuditLogTable events={[]} isLoading={true} />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('border-2');
    });
  });

  describe('Empty State', () => {
    it('displays empty state when no events are provided', () => {
      render(<AuditLogTable events={[]} isLoading={false} />);
      expect(screen.getByText('No events found')).toBeInTheDocument();
    });

    it('applies correct styling to empty state', () => {
      render(<AuditLogTable events={[]} isLoading={false} />);
      const emptyState = screen.getByText('No events found');
      expect(emptyState).toBeInTheDocument();
      expect(emptyState.closest('div')).toHaveClass('border');
    });
  });

  describe('Table Rendering', () => {
    it('renders table with correct headers', () => {
      render(<AuditLogTable events={mockEvents} />);
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('Date/Time')).toBeInTheDocument();
    });

    it('renders all events in the table', () => {
      render(<AuditLogTable events={mockEvents} />);
      expect(screen.getByText('page view')).toBeInTheDocument();
      expect(screen.getByText('admin login success')).toBeInTheDocument();
      expect(screen.getByText('chat message sent')).toBeInTheDocument();
    });

    it('formats event types with spaces instead of underscores', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeBadge = screen.getByText('admin login success');
      expect(eventTypeBadge).toBeInTheDocument();
      expect(screen.queryByText('admin_login_success')).not.toBeInTheDocument();
    });

    it('formats timestamps correctly', () => {
      render(<AuditLogTable events={mockEvents} />);
      const timestamps = screen.getAllByText(/AM|PM/);
      expect(timestamps.length).toBeGreaterThan(0);
    });

    it('applies color coding to event type badges', () => {
      render(<AuditLogTable events={mockEvents} />);
      const pageViewBadge = screen.getByText('page view');
      expect(pageViewBadge).toHaveClass('bg-blue-500/10');
      expect(pageViewBadge).toHaveClass('text-blue-400');
    });
  });

  describe('Sorting Functionality', () => {
    it('displays sort indicators on headers', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type');
      const timestampHeader = screen.getByText('Date/Time');

      expect(eventTypeHeader.textContent).toMatch(/[▲▼]/);
      expect(timestampHeader.textContent).toMatch(/[▲▼]/);
    });

    it('sorts by timestamp in descending order by default', () => {
      render(<AuditLogTable events={mockEvents} />);
      const timestampHeader = screen.getByText('Date/Time');
      expect(timestampHeader.closest('th')).toHaveAttribute('aria-sort', 'descending');
    });

    it('sorts events by timestamp ascending when clicked', () => {
      render(<AuditLogTable events={mockEvents} />);
      const timestampHeader = screen.getByText('Date/Time');

      fireEvent.click(timestampHeader);

      expect(timestampHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
      const rows = screen.getAllByRole('button');
      expect(rows[0]).toHaveTextContent('chat message sent');
    });

    it('sorts events by event type when header is clicked', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type');

      fireEvent.click(eventTypeHeader);

      expect(eventTypeHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('toggles sort direction on subsequent clicks', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type');

      fireEvent.click(eventTypeHeader);
      expect(eventTypeHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(eventTypeHeader);
      expect(eventTypeHeader.closest('th')).toHaveAttribute('aria-sort', 'descending');
    });

    it('handles keyboard navigation for sorting (Enter key)', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type').closest('th');

      fireEvent.keyDown(eventTypeHeader!, { key: 'Enter' });

      expect(eventTypeHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('handles keyboard navigation for sorting (Space key)', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type').closest('th');

      fireEvent.keyDown(eventTypeHeader!, { key: ' ' });

      expect(eventTypeHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('renders correct sort indicator icon', () => {
      render(<AuditLogTable events={mockEvents} />);
      const timestampHeader = screen.getByText('Date/Time');

      expect(timestampHeader.textContent).toContain('▼');

      fireEvent.click(timestampHeader);
      expect(timestampHeader.textContent).toContain('▲');
    });
  });

  describe('Row Click and Expansion', () => {
    it('marks rows as interactive with correct ARIA attributes', () => {
      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');
      rows.forEach((row) => {
        expect(row).toHaveAttribute('aria-expanded', 'false');
        expect(row).toHaveAttribute('tabindex', '0');
      });
    });

    it('expands row and fetches details when clicked', async () => {
      const loginEventDetails = {
        eventType: 'admin_login_success',
        timestamp: '2026-01-28T11:00:00.000Z',
        metadata: {},
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => loginEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(firstRow).toHaveAttribute('aria-expanded', 'true');
        expect(global.fetch).toHaveBeenCalledWith(mockEvents[1].url, expect.any(Object));
      });
    });

    it('displays loading state while fetching details', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => mockEventDetails,
              } as Response);
            }, 100);
          })
      );

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('Loading details...')).toBeInTheDocument();
      });
    });

    it('displays event details after successful fetch', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');
      const secondRow = rows[1];

      fireEvent.click(secondRow);

      await waitFor(
        () => {
          expect(screen.getByText('/home')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('collapses row when clicked again', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);
      await waitFor(() => {
        expect(firstRow).toHaveAttribute('aria-expanded', 'true');
      });

      fireEvent.click(firstRow);
      expect(firstRow).toHaveAttribute('aria-expanded', 'false');
    });

    it('handles keyboard interaction (Enter key)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.keyDown(firstRow, { key: 'Enter' });

      await waitFor(() => {
        expect(firstRow).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('handles keyboard interaction (Space key)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.keyDown(firstRow, { key: ' ' });

      await waitFor(() => {
        expect(firstRow).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('displays error message when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('Failed to load details')).toBeInTheDocument();
      });
    });

    it('cancels previous fetch when expanding different row', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEventDetails,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEventDetails,
        } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');

      fireEvent.click(rows[0]);
      fireEvent.click(rows[1]);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('rotates expand icon when row is expanded', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];
      const expandIcon = firstRow.querySelector('svg');

      expect(expandIcon).not.toHaveClass('rotate-180');

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(expandIcon).toHaveClass('rotate-180');
      });
    });
  });

  describe('Event Details Display', () => {
    it('displays session ID when available', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');
      const secondRow = rows[1];

      fireEvent.click(secondRow);

      await waitFor(
        () => {
          expect(screen.getByText('Session:')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const sessionCodeElement = document.querySelector('code');
      expect(sessionCodeElement).toBeInTheDocument();
      expect(sessionCodeElement?.textContent).toBe('session-...');
    });

    it('displays raw data toggle button when metadata exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('Show raw data')).toBeInTheDocument();
      });
    });

    it('toggles raw data display when button is clicked', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEventDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(screen.getByText('Show raw data')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Show raw data');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Hide raw data')).toBeInTheDocument();
        expect(screen.getByText(/"userAgent"/)).toBeInTheDocument();
      });
    });

    it('formats admin login success events correctly', async () => {
      const loginSuccessDetails = {
        eventType: 'admin_login_success',
        timestamp: '2026-01-28T11:00:00.000Z',
        metadata: {},
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => loginSuccessDetails,
      } as Response);

      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');
      const loginRow = rows[0];

      fireEvent.click(loginRow);

      await waitFor(
        () => {
          expect(screen.getByText('Authentication successful')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('formats admin login failure events with reason', async () => {
      const failureEvent = {
        id: 'event-failure',
        pathname: '/admin/audit',
        eventType: 'admin_login_failure',
        environment: 'production',
        timestamp: '2026-01-28T11:00:00.000Z',
        size: 256,
        url: 'https://example.com/event-failure.json',
      };

      const loginFailureDetails = {
        eventType: 'admin_login_failure',
        timestamp: '2026-01-28T11:00:00.000Z',
        metadata: {
          reason: 'invalid_password',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => loginFailureDetails,
      } as Response);

      render(<AuditLogTable events={[failureEvent]} />);
      const loginRow = screen.getByRole('button');

      fireEvent.click(loginRow);

      await waitFor(
        () => {
          expect(screen.getByText('Incorrect password entered')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Accessibility', () => {
    it('provides keyboard navigation for sortable headers', () => {
      render(<AuditLogTable events={mockEvents} />);
      const eventTypeHeader = screen.getByText('Event Type').closest('th');
      const timestampHeader = screen.getByText('Date/Time').closest('th');

      expect(eventTypeHeader).toHaveAttribute('tabindex', '0');
      expect(timestampHeader).toHaveAttribute('tabindex', '0');
    });

    it('provides ARIA sort attributes', () => {
      render(<AuditLogTable events={mockEvents} />);
      const timestampHeader = screen.getByText('Date/Time').closest('th');
      expect(timestampHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('provides ARIA expanded attributes for expandable rows', () => {
      render(<AuditLogTable events={mockEvents} />);
      const rows = screen.getAllByRole('button');
      rows.forEach((row) => {
        expect(row).toHaveAttribute('aria-expanded');
      });
    });

    it('hides decorative icons from screen readers', () => {
      render(<AuditLogTable events={mockEvents} />);
      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles events with missing timestamps', () => {
      const eventWithoutTimestamp = {
        ...mockEvents[0],
        timestamp: '',
      };

      render(<AuditLogTable events={[eventWithoutTimestamp]} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('handles events with unknown event types', () => {
      const unknownEvent = {
        ...mockEvents[0],
        eventType: 'unknown_event_type',
      };

      render(<AuditLogTable events={[unknownEvent]} />);
      const badge = screen.getByText('unknown event type');
      expect(badge).toHaveClass('bg-gray-500/10');
      expect(badge).toHaveClass('text-gray-400');
    });

    it('handles fetch abortion without errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new DOMException('The operation was aborted', 'AbortError')
      );

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);
      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('logs fetch errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch event details:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('cleans up abort controller on unmount', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => mockEventDetails,
              } as Response);
            }, 100);
          })
      );

      const { unmount } = render(<AuditLogTable events={mockEvents} />);
      const firstRow = screen.getAllByRole('button')[0];

      fireEvent.click(firstRow);

      unmount();

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalled();
      });
    });
  });
});
