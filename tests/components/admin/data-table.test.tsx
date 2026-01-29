import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '@/components/admin/DataTable';
import type { SortConfig } from '@/components/admin/DataTable';

interface TestItem {
  id: string;
  name: string;
  age: number;
  email: string;
  createdAt: string;
  status?: string;
}

const mockData: TestItem[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    age: 30,
    email: 'alice@example.com',
    createdAt: '2025-01-15T10:00:00.000Z',
    status: 'active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    age: 25,
    email: 'bob@example.com',
    createdAt: '2025-01-20T15:30:00.000Z',
    status: 'inactive',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    age: 35,
    email: 'charlie@example.com',
    createdAt: '2025-01-10T08:45:00.000Z',
    status: 'active',
  },
];

const basicColumns = [
  { key: 'name' as const, header: 'Name', sortable: true },
  { key: 'age' as const, header: 'Age', sortable: true },
  { key: 'email' as const, header: 'Email', sortable: false },
];

describe('DataTable', () => {
  describe('Rendering', () => {
    it('renders with columns and data', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      // Check headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();

      // Check data
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<DataTable data={mockData} columns={basicColumns} isLoading />);

      // Should show spinner and not show data
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    });

    it('renders empty state', () => {
      render(<DataTable data={[]} columns={basicColumns} />);

      expect(screen.getByText('No data found')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders all rows with correct number', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const rows = screen.getAllByRole('row');
      // +1 for header row
      expect(rows).toHaveLength(mockData.length + 1);
    });
  });

  describe('Header Rendering', () => {
    it('applies correct ARIA attributes to sortable headers', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader).toHaveAttribute('role', 'button');
      expect(nameHeader).toHaveAttribute('tabIndex', '0');
      expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    });

    it('does not apply button role to non-sortable headers', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const emailHeader = screen.getByText('Email').closest('th');
      expect(emailHeader).not.toHaveAttribute('role', 'button');
      expect(emailHeader).not.toHaveAttribute('tabIndex');
      expect(emailHeader).not.toHaveAttribute('aria-sort');
    });

    it('shows sort indicator for sortable columns', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      // Sortable headers show a faded indicator
      expect(nameHeader?.textContent).toMatch(/Name.*▲/);
    });

    it('does not show sort indicator for non-sortable columns', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const emailHeader = screen.getByText('Email').closest('th');
      expect(emailHeader?.textContent).toBe('Email');
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts data in ascending order on first click', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      const rows = screen.getAllByRole('row').slice(1); // Skip header
      expect(rows[0]).toHaveTextContent('Alice Johnson');
      expect(rows[1]).toHaveTextContent('Bob Smith');
      expect(rows[2]).toHaveTextContent('Charlie Brown');
    });

    it('sorts data in descending order on second click', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);
      fireEvent.click(nameHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('Charlie Brown');
      expect(rows[1]).toHaveTextContent('Bob Smith');
      expect(rows[2]).toHaveTextContent('Alice Johnson');
    });

    it('cycles back to ascending on third click', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!); // asc
      fireEvent.click(nameHeader!); // desc
      fireEvent.click(nameHeader!); // back to asc

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('Alice Johnson');
    });

    it('sorts numbers correctly', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const ageHeader = screen.getByText('Age').closest('th');
      fireEvent.click(ageHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('25'); // Bob
      expect(rows[1]).toHaveTextContent('30'); // Alice
      expect(rows[2]).toHaveTextContent('35'); // Charlie
    });

    it('sorts ISO date strings correctly', () => {
      const columns = [
        { key: 'name' as const, header: 'Name' },
        { key: 'createdAt' as const, header: 'Created', sortable: true },
      ];

      render(<DataTable data={mockData} columns={columns} />);

      const createdHeader = screen.getByText('Created').closest('th');
      fireEvent.click(createdHeader!);

      const rows = screen.getAllByRole('row').slice(1);
      // Oldest first (2025-01-10)
      expect(rows[0]).toHaveTextContent('Charlie Brown');
      // Middle (2025-01-15)
      expect(rows[1]).toHaveTextContent('Alice Johnson');
      // Newest (2025-01-20)
      expect(rows[2]).toHaveTextContent('Bob Smith');
    });

    it('handles null/undefined values in sorting', () => {
      const dataWithNulls: TestItem[] = [
        { ...mockData[0], status: undefined },
        { ...mockData[1], status: 'active' },
        { ...mockData[2], status: undefined },
      ];

      const columns = [
        { key: 'name' as const, header: 'Name' },
        { key: 'status' as const, header: 'Status', sortable: true },
      ];

      render(<DataTable data={dataWithNulls} columns={columns} />);

      const statusHeader = screen.getByText('Status').closest('th');
      fireEvent.click(statusHeader!);

      // Non-null values should come first in ascending order
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('Bob Smith');
    });

    it('updates aria-sort attribute when sorting', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');

      // Initial state
      expect(nameHeader).toHaveAttribute('aria-sort', 'none');

      // After ascending click
      fireEvent.click(nameHeader!);
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

      // After descending click
      fireEvent.click(nameHeader!);
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('shows correct sort indicator direction', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');

      // Ascending
      fireEvent.click(nameHeader!);
      expect(nameHeader?.textContent).toMatch(/▲/);

      // Descending
      fireEvent.click(nameHeader!);
      expect(nameHeader?.textContent).toMatch(/▼/);
    });

    it('does not sort when clicking non-sortable column', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const emailHeader = screen.getByText('Email').closest('th');
      fireEvent.click(emailHeader!);

      // Order should remain as provided in mockData
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('Alice Johnson');
      expect(rows[1]).toHaveTextContent('Bob Smith');
      expect(rows[2]).toHaveTextContent('Charlie Brown');
    });

    it('supports keyboard navigation for sorting', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');

      // Enter key
      fireEvent.keyDown(nameHeader!, { key: 'Enter' });
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

      // Space key
      fireEvent.keyDown(nameHeader!, { key: ' ' });
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('calls onSortChange callback when sorting', () => {
      const onSortChange = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onSortChange={onSortChange}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(onSortChange).toHaveBeenCalledWith({
        key: 'name',
        direction: 'asc',
      });
    });

    it('respects defaultSort prop', () => {
      const defaultSort: SortConfig<TestItem> = {
        key: 'age',
        direction: 'desc',
      };

      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          defaultSort={defaultSort}
        />
      );

      // Should be sorted by age descending initially
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('35'); // Charlie
      expect(rows[1]).toHaveTextContent('30'); // Alice
      expect(rows[2]).toHaveTextContent('25'); // Bob

      // Check aria-sort
      const ageHeader = screen.getByText('Age').closest('th');
      expect(ageHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('uses custom sortKey when provided', () => {
      const columnsWithSortKey = [
        {
          key: 'displayName' as const,
          header: 'Display Name',
          sortable: true,
          sortKey: 'name' as const,
        },
        { key: 'age' as const, header: 'Age' },
      ];

      const dataWithDisplay = mockData.map((item) => ({
        ...item,
        displayName: item.name,
      }));

      render(<DataTable data={dataWithDisplay} columns={columnsWithSortKey} />);

      const header = screen.getByText('Display Name').closest('th');
      fireEvent.click(header!);

      // Should sort by 'name' field even though column key is 'displayName'
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent('Alice Johnson');
    });
  });

  describe('Custom Cell Renderers', () => {
    it('renders custom cell content', () => {
      const columnsWithRenderer = [
        {
          key: 'name' as const,
          header: 'Name',
          render: (item: TestItem) => <strong>{item.name.toUpperCase()}</strong>,
        },
        { key: 'age' as const, header: 'Age' },
      ];

      render(<DataTable data={mockData} columns={columnsWithRenderer} />);

      expect(screen.getByText('ALICE JOHNSON')).toBeInTheDocument();
      expect(screen.getByText('BOB SMITH')).toBeInTheDocument();
    });

    it('renders complex custom elements', () => {
      const columnsWithBadge = [
        { key: 'name' as const, header: 'Name' },
        {
          key: 'status' as const,
          header: 'Status',
          render: (item: TestItem) => (
            <span className={`badge ${item.status}`}>{item.status}</span>
          ),
        },
      ];

      render(<DataTable data={mockData} columns={columnsWithBadge} />);

      const badges = document.querySelectorAll('.badge');
      expect(badges).toHaveLength(3);
      expect(badges[0]).toHaveTextContent('active');
    });

    it('handles undefined values with custom renderer', () => {
      const dataWithUndefined: TestItem[] = [
        { ...mockData[0], status: undefined },
      ];

      const columnsWithRenderer = [
        { key: 'name' as const, header: 'Name' },
        {
          key: 'status' as const,
          header: 'Status',
          render: (item: TestItem) => item.status || 'N/A',
        },
      ];

      render(<DataTable data={dataWithUndefined} columns={columnsWithRenderer} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('falls back to string representation when no renderer provided', () => {
      const columns = [
        { key: 'name' as const, header: 'Name' },
        { key: 'age' as const, header: 'Age' },
      ];

      render(<DataTable data={mockData} columns={columns} />);

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('handles empty string values', () => {
      const dataWithEmpty: TestItem[] = [
        { ...mockData[0], email: '' },
      ];

      const columns = [
        { key: 'name' as const, header: 'Name' },
        { key: 'email' as const, header: 'Email' },
      ];

      render(<DataTable data={dataWithEmpty} columns={columns} />);

      const rows = screen.getAllByRole('row');
      const emailCell = rows[1].querySelectorAll('td')[1];
      expect(emailCell).toHaveTextContent('');
    });
  });

  describe('Row Click Functionality', () => {
    it('calls onRowClick when row is clicked', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR');
      fireEvent.click(rows[0]);

      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('applies clickable styles when onRowClick is provided', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR');
      expect(rows[0]).toHaveClass('cursor-pointer');
    });

    it('does not apply clickable styles when onRowClick is not provided', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const rows = screen.getAllByRole('row').slice(1); // Skip header
      expect(rows[0]).not.toHaveClass('cursor-pointer');
      expect(rows[0]).not.toHaveAttribute('role', 'button');
    });

    it('supports keyboard navigation for row clicks', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR');

      // Enter key
      fireEvent.keyDown(rows[0], { key: 'Enter' });
      expect(onRowClick).toHaveBeenCalledTimes(1);

      // Space key
      fireEvent.keyDown(rows[1], { key: ' ' });
      expect(onRowClick).toHaveBeenCalledTimes(2);
    });

    it('sets correct tabIndex for clickable rows', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR');
      rows.forEach((row) => {
        expect(row).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Accessibility', () => {
    it('uses semantic table elements', () => {
      const { container } = render(<DataTable data={mockData} columns={basicColumns} />);

      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();

      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(3);

      const rows = container.querySelectorAll('tr');
      expect(rows).toHaveLength(4); // 1 header + 3 data
    });

    it('provides proper focus management for sortable headers', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      nameHeader?.focus();

      expect(document.activeElement).toBe(nameHeader);
    });

    it('provides proper focus management for clickable rows', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={mockData}
          columns={basicColumns}
          onRowClick={onRowClick}
        />
      );

      const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR');
      rows[0].focus();

      expect(document.activeElement).toBe(rows[0]);
    });

    it('applies aria-hidden to sort indicators', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const indicators = document.querySelectorAll('[aria-hidden="true"]');
      expect(indicators.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles single row data', () => {
      render(<DataTable data={[mockData[0]]} columns={basicColumns} />);

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(2); // 1 header + 1 data
    });

    it('handles single column', () => {
      const singleColumn = [{ key: 'name' as const, header: 'Name' }];
      render(<DataTable data={mockData} columns={singleColumn} />);

      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    });

    it('handles data with same values', () => {
      const duplicateData: TestItem[] = [
        { ...mockData[0], age: 30 },
        { ...mockData[1], age: 30 },
        { ...mockData[2], age: 30 },
      ];

      render(<DataTable data={duplicateData} columns={basicColumns} />);

      const ageHeader = screen.getByText('Age').closest('th');
      fireEvent.click(ageHeader!);

      // Should not crash and maintain stable order
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(3);
    });

    it('preserves original data array', () => {
      const originalData = [...mockData];
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      // Original array should not be mutated
      expect(mockData).toEqual(originalData);
    });

    it('handles rapid sort changes', () => {
      render(<DataTable data={mockData} columns={basicColumns} />);

      const nameHeader = screen.getByText('Name').closest('th');

      // Rapid clicks
      fireEvent.click(nameHeader!);
      fireEvent.click(nameHeader!);
      fireEvent.click(nameHeader!);
      fireEvent.click(nameHeader!);

      // Should still render correctly
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(3);
    });
  });
});
