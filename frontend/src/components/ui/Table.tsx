import * as React from 'react';

export interface TableHeader {
  label: string;
  key: string;
  sortable?: boolean;
}

export interface TableProps {
  headers: TableHeader[];
  data: any[];
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  page?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  renderCell?: (row: any, key: string) => React.ReactNode;
}

export const Table: React.FC<TableProps> = ({
  headers,
  data,
  sortKey,
  sortOrder,
  onSort,
  page,
  totalCount = 0,
  pageSize = 10,
  onPageChange,
  renderCell,
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
            <tr>
              {headers.map((header) => {
                const isSorted = sortKey === header.key;
                return (
                  <th
                    key={header.key}
                    onClick={() => header.sortable && onSort && onSort(header.key)}
                    className={`px-4 py-3 ${
                      header.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {header.label}
                      {header.sortable && isSorted && (
                        <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-gray-900">
            {data.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-500 font-medium">
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50/50">
                  {headers.map((header) => (
                    <td key={header.key} className="px-4 py-3 whitespace-nowrap">
                      {renderCell ? renderCell(row, header.key) : String(row[header.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs">
          <span className="text-gray-500 font-medium">
            Page {page} of {totalPages} ({totalCount} total records)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, (page ?? 1) - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 font-medium disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, (page ?? 1) + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 font-medium disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
