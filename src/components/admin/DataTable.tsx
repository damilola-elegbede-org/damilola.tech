'use client';

import { useState, useMemo } from 'react';

export interface SortConfig<T> {
  key: keyof T | string;
  direction: 'asc' | 'desc';
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Custom key to use for sorting (defaults to column key) */
  sortKey?: keyof T;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  /** Default sort configuration */
  defaultSort?: SortConfig<T>;
  /** Callback when sort changes (for URL state sync) */
  onSortChange?: (sort: SortConfig<T>) => void;
}

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === null) {
    // Show faded indicator for sortable columns that aren't currently sorted
    return (
      <span className="ml-1 text-[var(--color-text-muted)]/30" aria-hidden="true">
        ▲
      </span>
    );
  }
  return (
    <span className="ml-1" aria-hidden="true">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  isLoading,
  defaultSort,
  onSortChange,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    const sortKey = column.sortKey || column.key;
    let newConfig: SortConfig<T>;

    if (sortConfig?.key === sortKey) {
      // Toggle direction or clear if already descending
      if (sortConfig.direction === 'asc') {
        newConfig = { key: sortKey, direction: 'desc' };
      } else {
        // Reset to ascending on third click
        newConfig = { key: sortKey, direction: 'asc' };
      }
    } else {
      // New column, start with ascending
      newConfig = { key: sortKey, direction: 'asc' };
    }

    setSortConfig(newConfig);
    onSortChange?.(newConfig);
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortConfig.key as string];
      const bVal = (b as Record<string, unknown>)[sortConfig.key as string];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle different types
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        // Check for ISO date strings (e.g., "2025-01-26T12:00:00.000Z")
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (isoDateRegex.test(aVal) && isoDateRegex.test(bVal)) {
          comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
        } else {
          comparison = aVal.localeCompare(bVal);
        }
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        // Fallback to string comparison
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-[var(--color-text-muted)]">
        No data found
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full">
        <thead className="bg-[var(--color-card)]">
          <tr>
            {columns.map((col) => {
              const sortKey = col.sortKey || col.key;
              const isCurrentSort = sortConfig?.key === sortKey;
              const isSortable = col.sortable;

              return (
                <th
                  key={col.key as string}
                  onClick={() => handleSort(col)}
                  onKeyDown={(e) => {
                    if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSort(col);
                    }
                  }}
                  tabIndex={isSortable ? 0 : undefined}
                  role={isSortable ? 'button' : undefined}
                  aria-sort={
                    isCurrentSort
                      ? sortConfig.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : isSortable
                        ? 'none'
                        : undefined
                  }
                  className={`px-4 py-3 text-left text-sm font-medium text-[var(--color-text-muted)] ${
                    isSortable
                      ? 'cursor-pointer select-none hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset'
                      : ''
                  }`}
                >
                  {col.header}
                  {isSortable && (
                    <SortIndicator
                      direction={isCurrentSort ? sortConfig.direction : null}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {sortedData.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(item);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              className={`bg-[var(--color-bg)] ${onRowClick ? 'cursor-pointer hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key as string}
                  className="px-4 py-3 text-sm text-[var(--color-text)]"
                >
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
