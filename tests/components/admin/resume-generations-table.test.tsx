import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeGenerationsTable } from '@/components/admin/ResumeGenerationsTable';
import type { ResumeGenerationSummary } from '@/lib/types/resume-generation';

const mockGeneration1: ResumeGenerationSummary = {
  jobId: 'job-1',
  generationId: 'gen-1',
  environment: 'production',
  id: 'gen-1',
  timestamp: '2024-01-15T10:00:00Z',
  companyName: 'Acme Corp',
  roleTitle: 'Senior Engineer',
  scoreBefore: 65,
  scoreAfter: 82,
  applicationStatus: 'applied',
  updatedAt: '2024-01-15T10:00:00Z',
  url: 'https://blob.vercel-storage.com/gen-1.pdf',
  size: 1024,
  generationCount: 1,
};

const mockGeneration2: ResumeGenerationSummary = {
  id: 'gen-2',
  jobId: 'job-2',
  generationId: 'gen-2',
  environment: 'production',
  timestamp: '2024-01-10T14:30:00Z',
  companyName: 'TechStart Inc',
  roleTitle: 'Engineering Manager',
  scoreBefore: 58,
  scoreAfter: 76,
  applicationStatus: 'interview',
  updatedAt: '2024-01-10T14:30:00Z',
  url: 'https://blob.vercel-storage.com/gen-2.pdf',
  size: 2048,
  generationCount: 3,
};

const mockGeneration3: ResumeGenerationSummary = {
  id: 'gen-3',
  jobId: 'job-3',
  generationId: 'gen-3',
  environment: 'production',
  timestamp: '2024-01-20T09:15:00Z',
  companyName: 'BigTech Co',
  roleTitle: 'Staff Engineer',
  scoreBefore: 70,
  scoreAfter: 88,
  applicationStatus: 'draft',
  updatedAt: '2024-01-20T09:15:00Z',
  url: 'https://blob.vercel-storage.com/gen-3.pdf',
  size: 3072,
  generationCount: 1,
};

const mockGenerations = [mockGeneration1, mockGeneration2, mockGeneration3];

describe('ResumeGenerationsTable', () => {
  const mockOnRowClick = vi.fn();
  const mockOnStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(
        <ResumeGenerationsTable
          generations={[]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={true}
        />
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('displays empty state when no generations exist', () => {
      render(
        <ResumeGenerationsTable
          generations={[]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByText('No resume generations yet')).toBeInTheDocument();
      expect(screen.getByText('Generate your first ATS-optimized resume to see it here')).toBeInTheDocument();
    });

    it('shows document icon in empty state', () => {
      const { container } = render(
        <ResumeGenerationsTable
          generations={[]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Table rendering', () => {
    it('renders table with data', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('TechStart Inc')).toBeInTheDocument();
      expect(screen.getByText('BigTech Co')).toBeInTheDocument();
    });

    it('renders all table headers', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders all data rows', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const rows = screen.getAllByRole('row');
      // 1 header row + 3 data rows
      expect(rows).toHaveLength(4);
    });
  });

  describe('Date formatting', () => {
    it('formats dates correctly', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      // Date formatting may vary by locale, but should contain date parts
      const dateCell = screen.getByText(/1\/15\/2024/i);
      expect(dateCell).toBeInTheDocument();
    });
  });

  describe('Generation count badge', () => {
    it('shows generation count badge when count > 1', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration2]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', '3 versions generated');
    });

    it('does not show badge when generation count is 1', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const badge = screen.queryByTitle(/versions generated/);
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('Score display', () => {
    it('displays score before and after with arrow', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByText('65')).toBeInTheDocument();
      expect(screen.getByText('82')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('shows positive score change in green with plus sign', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const scoreChange = screen.getByText('(+17)');
      expect(scoreChange).toBeInTheDocument();
      expect(scoreChange).toHaveClass('text-green-400');
    });

    it('shows negative score change in red without plus sign', () => {
      const negativeScoreGen: ResumeGenerationSummary = {
        ...mockGeneration1,
        scoreBefore: 80,
        scoreAfter: 70,
      };

      render(
        <ResumeGenerationsTable
          generations={[negativeScoreGen]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const scoreChange = screen.getByText('(-10)');
      expect(scoreChange).toBeInTheDocument();
      expect(scoreChange).toHaveClass('text-red-400');
    });

    it('does not show change indicator when score is unchanged', () => {
      const unchangedScoreGen: ResumeGenerationSummary = {
        ...mockGeneration1,
        scoreBefore: 75,
        scoreAfter: 75,
      };

      render(
        <ResumeGenerationsTable
          generations={[unchangedScoreGen]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const scoreChangePattern = /\([+-]\d+\)/;
      expect(screen.queryByText(scoreChangePattern)).not.toBeInTheDocument();
    });
  });

  describe('Status badges', () => {
    it('displays status dropdown with correct value', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      expect(statusDropdown).toHaveValue('applied');
    });

    it('shows all status options in dropdown', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      const options = Array.from(statusDropdown.querySelectorAll('option'));

      expect(options).toHaveLength(5);
      expect(options.map(opt => opt.value)).toEqual(['draft', 'applied', 'interview', 'offer', 'rejected']);
    });

    it('displays status with correct styling', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      expect(statusDropdown).toHaveClass('bg-blue-500/20', 'text-blue-400');
    });
  });

  describe('Row click handling', () => {
    it('calls onRowClick when row is clicked', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const row = screen.getByText('Acme Corp').closest('tr');
      fireEvent.click(row!);

      expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      expect(mockOnRowClick).toHaveBeenCalledWith(mockGeneration1);
    });

    it('calls onRowClick when Enter key is pressed on row', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const row = screen.getByText('Acme Corp').closest('tr');
      fireEvent.keyDown(row!, { key: 'Enter' });

      expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      expect(mockOnRowClick).toHaveBeenCalledWith(mockGeneration1);
    });

    it('calls onRowClick when Space key is pressed on row', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const row = screen.getByText('Acme Corp').closest('tr');
      fireEvent.keyDown(row!, { key: ' ' });

      expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      expect(mockOnRowClick).toHaveBeenCalledWith(mockGeneration1);
    });
  });

  describe('Status change handling', () => {
    it('calls onStatusChange when status is changed', async () => {
      mockOnStatusChange.mockResolvedValue(undefined);

      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      fireEvent.change(statusDropdown, { target: { value: 'interview' } });

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
        expect(mockOnStatusChange).toHaveBeenCalledWith(mockGeneration1, 'interview');
      });
    });

    it('shows loading spinner while status is updating', async () => {
      let resolveStatusChange: () => void;
      const statusChangePromise = new Promise<void>((resolve) => {
        resolveStatusChange = resolve;
      });
      mockOnStatusChange.mockReturnValue(statusChangePromise);

      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      fireEvent.change(statusDropdown, { target: { value: 'interview' } });

      // Should show spinner while updating
      await waitFor(() => {
        expect(document.querySelectorAll('.animate-spin')).toHaveLength(1);
      });

      // Resolve the promise
      resolveStatusChange!();

      // Spinner should disappear
      await waitFor(() => {
        expect(screen.getByLabelText('Application status')).toBeInTheDocument();
      });
    });

    it('does not call onRowClick when status dropdown is clicked', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusDropdown = screen.getByLabelText('Application status');
      fireEvent.click(statusDropdown);

      expect(mockOnRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('sorts by timestamp in descending order by default', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const rows = screen.getAllByRole('row').slice(1); // Skip header
      const companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);

      // Most recent first (Jan 20, Jan 15, Jan 10)
      expect(companies).toEqual(['BigTech Co', 'Acme Corp', 'TechStart Inc']);
    });

    it('toggles sort direction when clicking same header', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const dateHeader = screen.getByText('Date').closest('th');

      // First click: asc (oldest first)
      fireEvent.click(dateHeader!);
      let rows = screen.getAllByRole('row').slice(1);
      let companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);
      expect(companies).toEqual(['TechStart Inc', 'Acme Corp', 'BigTech Co']);

      // Second click: desc (newest first)
      fireEvent.click(dateHeader!);
      rows = screen.getAllByRole('row').slice(1);
      companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);
      expect(companies).toEqual(['BigTech Co', 'Acme Corp', 'TechStart Inc']);
    });

    it('sorts by company name alphabetically', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const companyHeader = screen.getByText('Company').closest('th');
      fireEvent.click(companyHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      const companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);

      expect(companies).toEqual(['Acme Corp', 'BigTech Co', 'TechStart Inc']);
    });

    it('sorts by role title alphabetically', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const roleHeader = screen.getByText('Role').closest('th');
      fireEvent.click(roleHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      const roles = rows.map(row => row.querySelector('td:nth-child(3)')?.textContent);

      expect(roles).toEqual(['Engineering Manager', 'Senior Engineer', 'Staff Engineer']);
    });

    it('sorts by score after numerically', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const scoreHeader = screen.getByText('Score').closest('th');
      fireEvent.click(scoreHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      const companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);

      // Ascending order: 76, 82, 88
      expect(companies).toEqual(['TechStart Inc', 'Acme Corp', 'BigTech Co']);
    });

    it('sorts by application status using predefined order', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const statusHeader = screen.getByText('Status').closest('th');
      fireEvent.click(statusHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      const companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);

      // Order: draft, applied, interview, offer, rejected
      expect(companies).toEqual(['BigTech Co', 'Acme Corp', 'TechStart Inc']);
    });

    it('supports keyboard navigation for sorting', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const companyHeader = screen.getByText('Company').closest('th');
      fireEvent.keyDown(companyHeader!, { key: 'Enter' });

      const rows = screen.getAllByRole('row').slice(1);
      const companies = rows.map(row => row.querySelector('td:nth-child(2)')?.textContent);

      expect(companies).toEqual(['Acme Corp', 'BigTech Co', 'TechStart Inc']);
    });

    it('shows sort indicator on active column', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const dateHeader = screen.getByText('Date').closest('th');

      // Default: descending
      expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
      expect(dateHeader?.textContent).toContain('▼');

      // Click to ascending
      fireEvent.click(dateHeader!);
      expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(dateHeader?.textContent).toContain('▲');
    });

    it('shows inactive sort indicator on non-sorted columns', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const companyHeader = screen.getByText('Company').closest('th');
      expect(companyHeader).toHaveAttribute('aria-sort', 'none');
    });
  });

  describe('Accessibility', () => {
    it('has proper table structure', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 3 data
    });

    it('rows are keyboard focusable', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const row = screen.getByText('Acme Corp').closest('tr');
      expect(row).toHaveAttribute('tabIndex', '0');
    });

    it('column headers are keyboard focusable for sorting', () => {
      render(
        <ResumeGenerationsTable
          generations={mockGenerations}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      const headers = screen.getAllByRole('columnheader');
      headers.forEach(header => {
        expect(header).toHaveAttribute('tabIndex', '0');
      });
    });

    it('status dropdown has accessible label', () => {
      render(
        <ResumeGenerationsTable
          generations={[mockGeneration1]}
          onRowClick={mockOnRowClick}
          onStatusChange={mockOnStatusChange}
          isLoading={false}
        />
      );

      expect(screen.getByLabelText('Application status')).toBeInTheDocument();
    });
  });
});
