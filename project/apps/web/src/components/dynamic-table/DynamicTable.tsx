import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import { useRouter } from 'next/router';
import type { Dispatch, SetStateAction } from 'react';

interface DynamicTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  pageCount: number;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  getRecordHref?: (row: TData) => string;
}

export function DynamicTable<TData>({
  data,
  columns,
  pageCount,
  pagination,
  setPagination,
  getRecordHref,
}: DynamicTableProps<TData>) {
  const router = useRouter();
  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Tell the table we're handling pagination server-side
  });

  const handleRowClick = (rowData: TData) => {
    if (!getRecordHref) return;
    const href = getRecordHref(rowData);
    if (href && href !== '#') {
      void router.push(href);
    }
  };

  return (
    <div className="stack">
      <div className="table-wrapper">
        <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                role={getRecordHref ? 'button' : undefined}
                tabIndex={getRecordHref ? 0 : undefined}
                onClick={() => handleRowClick(row.original)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleRowClick(row.original);
                  }
                }}
                style={getRecordHref ? { cursor: 'pointer' } : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center' }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button
          type="button"
          className="button secondary"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span className="helper-text">
          Page{' '}
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount() === 0 ? 1 : table.getPageCount()}
          </strong>
        </span>
        <button
          type="button"
          className="button secondary"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
      </div>
    </div>
  );
}
