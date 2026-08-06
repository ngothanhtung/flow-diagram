'use client';

// Shared building blocks for the app's TanStack tables (diagrams home,
// admin diagrams, admin templates). One place owns the sort-header
// button, the table markup with narrow/right-aligned column handling,
// and the pagination footer, so the three tables cannot drift apart.

import { flexRender, type Header, type Table as TanstackTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Millis → "Aug 6, 2026, 9:41 AM", or an em dash for null. */
export function formatDateTime(value: number | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

/** Sort header button — shows the current sort direction of the column. */
export function SortHeaderButton<TData>({ header }: { header: Header<TData, unknown> }) {
  const column = header.column;
  const sorted = column.getIsSorted();
  return (
    <button type='button' onClick={column.getToggleSortingHandler()} className='inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-zinc-100'>
      {flexRender(column.columnDef.header, header.getContext())}
      {sorted === 'asc' ? <ArrowUp size={12} className='text-sky-300' /> : sorted === 'desc' ? <ArrowDown size={12} className='text-sky-300' /> : <ArrowUpDown size={12} className='text-zinc-600' />}
    </button>
  );
}

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  /** Columns that should shrink to their content instead of stretching. */
  narrowColumns: ReadonlySet<string>;
  /** Columns whose content should align to the right (numbers, actions). */
  rightAlignedColumns: ReadonlySet<string>;
  /** Message for the empty state — reflect loading/error status here. */
  emptyMessage: string;
}

/** The scrollable table body every list page shares. */
export function DataTable<TData>({ table, narrowColumns, rightAlignedColumns, emptyMessage }: DataTableProps<TData>) {
  const columnCount = table.getAllLeafColumns().length;
  return (
    <div className='min-h-0 flex-1 overflow-auto px-6'>
      <table className='w-full border-separate border-spacing-0 text-left text-sm'>
        <thead className='sticky top-0 z-10'>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={[
                    'border-b border-white/8 bg-zinc-950/95 px-3 py-2.5 text-[10px] font-bold text-zinc-400 backdrop-blur-xl',
                    narrowColumns.has(header.column.id) ? 'w-px whitespace-nowrap' : '',
                    rightAlignedColumns.has(header.column.id) ? 'text-right' : '',
                  ].join(' ')}
                >
                  {header.column.getCanSort() ? <SortHeaderButton header={header} /> : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className='px-3 py-16 text-center text-sm text-zinc-500'>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className='group transition hover:bg-white/4'>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={[
                      'border-b border-white/5 px-3 py-2.5',
                      narrowColumns.has(cell.column.id) ? 'w-px whitespace-nowrap' : '',
                      rightAlignedColumns.has(cell.column.id) ? 'text-right' : '',
                    ].join(' ')}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50, 100];

/** Pagination footer: page indicator, prev/next, page-size picker. */
export function DataTableFooter<TData>({ table }: { table: TanstackTable<TData> }) {
  return (
    <footer className='flex items-center justify-between border-t border-white/5 px-6 py-3 text-xs text-zinc-400'>
      <span>
        Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
      </span>
      <div className='flex items-center gap-2'>
        <Button variant='toolbar' size='xs' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <ChevronLeft size={13} />
          Prev
        </Button>
        <Button variant='toolbar' size='xs' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
          <ChevronRight size={13} />
        </Button>
        <Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
          <SelectTrigger size='sm' className='border-white/10 bg-black/40 text-xs text-zinc-300' aria-label='Rows per page'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='border-white/10 bg-zinc-950'>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </footer>
  );
}
