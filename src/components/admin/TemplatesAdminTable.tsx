'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type Header, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LayoutTemplate, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTemplate, deleteTemplate, listTemplates, type StoredTemplate } from '@/lib/firebase/templates';

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: number | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

const numberFormat = new Intl.NumberFormat('en-US');

/** Columns that should shrink to their content instead of stretching. */
const NARROW_COLUMNS = new Set(['nodeCount', 'edgeCount', 'updatedAt', 'actions']);
/** Columns whose content should align to the right (numbers, actions). */
const RIGHT_ALIGNED_COLUMNS = new Set(['nodeCount', 'edgeCount', 'actions']);

/** Flattened row for the admin table (timestamps as epoch millis). */
interface TemplateRow {
  id: string;
  name: string;
  category: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: number | null;
  updatedAt: number | null;
}

function toTemplateRow(template: StoredTemplate): TemplateRow {
  const document = template.document ?? { nodes: [], edges: [] };
  return {
    id: template.id,
    name: template.name || '(untitled)',
    category: template.category ?? '—',
    description: template.description ?? '',
    nodeCount: document.nodes?.length ?? 0,
    edgeCount: document.edges?.length ?? 0,
    createdAt: template.createdAt ? template.createdAt.toMillis() : null,
    updatedAt: template.updatedAt ? template.updatedAt.toMillis() : null,
  };
}

/** Sort header button — shows the current sort direction of the column. */
function SortButton({ header }: { header: Header<TemplateRow, unknown> }) {
  const column = header.column;
  const sorted = column.getIsSorted();
  return (
    <button type='button' onClick={column.getToggleSortingHandler()} className='inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-zinc-100'>
      {flexRender(column.columnDef.header, header.getContext())}
      {sorted === 'asc' ? <ArrowUp size={12} className='text-sky-300' /> : sorted === 'desc' ? <ArrowDown size={12} className='text-sky-300' /> : <ArrowUpDown size={12} className='text-zinc-600' />}
    </button>
  );
}

export function AdminTemplatesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const templates = await listTemplates();
      setRows(templates.map(toTemplateRow));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const id = await createTemplate('Untitled template', 'General', '', { nodes: [], edges: [] });
      router.push(`/admin/templates/${id}/edit`);
    } catch {
      toast.error('Could not create template', { description: 'Check sign-in and Firestore rules.' });
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteTemplate(deleting.id);
      toast.success('Template deleted', { description: deleting.name });
      setDeleting(null);
      await refresh();
    } catch {
      toast.error('Could not delete template');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<TemplateRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Template',
        cell: ({ row }) => (
          <div className='min-w-0'>
            <p className='truncate font-medium text-zinc-100'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-zinc-500'>{row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => <span className='whitespace-nowrap rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-white/10'>{getValue<string>()}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => <span className='block max-w-64 truncate text-xs text-zinc-500'>{getValue<string>() || '—'}</span>,
      },
      {
        accessorKey: 'nodeCount',
        header: 'Nodes',
        cell: ({ getValue }) => <span className='tabular-nums'>{numberFormat.format(getValue<number>())}</span>,
      },
      {
        accessorKey: 'edgeCount',
        header: 'Edges',
        cell: ({ getValue }) => <span className='tabular-nums'>{numberFormat.format(getValue<number>())}</span>,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ getValue }) => <span className='whitespace-nowrap text-zinc-400'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <Link href={`/admin/templates/${row.original.id}/edit`} className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/6 hover:text-sky-200' title='Edit template'>
              <Pencil size={13} />
              Edit
            </Link>
            <Button variant='ghost' size='xs' onClick={() => setDeleting(row.original)} className='text-zinc-500 hover:text-rose-200'>
              <Trash2 size={13} />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className='flex h-full flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <LayoutTemplate size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Templates admin</h1>
            <p className='text-xs text-zinc-500'>templates/{'{template_id}'} · shared library for every user</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button disabled={busy} onClick={() => void handleCreate()} className='bg-cyan-300 text-zinc-950 hover:bg-cyan-200'>
            <Plus size={13} />
            New template
          </Button>
          <Button variant='outline' onClick={() => void refresh()} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-3 px-6 py-3'>
        <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name, category or id…' className='max-w-xs border-white/10 bg-black/25' />
        <p className='text-xs text-zinc-500'>{status === 'ready' ? `${table.getFilteredRowModel().rows.length} template(s)` : status === 'error' ? 'Failed to load templates' : 'Loading templates…'}</p>
      </div>

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
                      NARROW_COLUMNS.has(header.column.id) ? 'w-px whitespace-nowrap' : '',
                      RIGHT_ALIGNED_COLUMNS.has(header.column.id) ? 'text-right' : '',
                    ].join(' ')}
                  >
                    {header.column.getCanSort() ? <SortButton header={header} /> : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='px-3 py-16 text-center text-sm text-zinc-500'>
                  {status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No templates yet — use “New template”.'}
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
                        NARROW_COLUMNS.has(cell.column.id) ? 'w-px whitespace-nowrap' : '',
                        RIGHT_ALIGNED_COLUMNS.has(cell.column.id) ? 'text-right' : '',
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

      <footer className='flex items-center justify-between border-t border-white/5 px-6 py-3 text-xs text-zinc-400'>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </span>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='xs' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            <ChevronLeft size={13} />
            Prev
          </Button>
          <Button variant='outline' size='xs' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            Next
            <ChevronRight size={13} />
          </Button>
          <select value={table.getState().pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))} className='h-7 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-300 outline-none'>
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </footer>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className='border border-white/8 bg-zinc-950'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-300'>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.name}” will be removed from the shared library. Users will no longer be able to load it. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' disabled={busy} onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
