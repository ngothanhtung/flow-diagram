'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type Header, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronLeft, ChevronRight, ExternalLink, Globe, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialDocument } from '@/lib/flowchart-data';
import { createDiagram, deleteDiagram, listDiagrams, type StoredDiagram } from '@/lib/firebase/diagrams';

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: number | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

/** Flattened row for the owner's diagram list (timestamps as millis). */
interface DiagramRow {
  id: string;
  name: string;
  public: boolean;
  nodeCount: number;
  edgeCount: number;
  createdAt: number | null;
  updatedAt: number | null;
}

function toDiagramRow(diagram: StoredDiagram): DiagramRow {
  const document = diagram.document ?? { nodes: [], edges: [] };
  return {
    id: diagram.id,
    name: diagram.name || '(untitled)',
    public: diagram.public === true,
    nodeCount: document.nodes?.length ?? 0,
    edgeCount: document.edges?.length ?? 0,
    createdAt: diagram.createdAt ? diagram.createdAt.toMillis() : null,
    updatedAt: diagram.updatedAt ? diagram.updatedAt.toMillis() : null,
  };
}

/** Sort header button — shows the current sort direction of the column. */
function SortButton({ header }: { header: Header<DiagramRow, unknown> }) {
  const column = header.column;
  const sorted = column.getIsSorted();
  return (
    <button type='button' onClick={column.getToggleSortingHandler()} className='inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-zinc-100'>
      {flexRender(column.columnDef.header, header.getContext())}
      {sorted === 'asc' ? <ArrowUp size={12} className='text-sky-300' /> : sorted === 'desc' ? <ArrowDown size={12} className='text-sky-300' /> : <ArrowUpDown size={12} className='text-zinc-600' />}
    </button>
  );
}

/**
 * Landing page: lists every diagram owned by the signed-in user
 * (`users/{uid}/diagrams`). Opening one navigates to its editor at
 * `/diagrams/{id}/edit`.
 */
export function DiagramsHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<DiagramRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<DiagramRow | null>(null);

  const refresh = useCallback(async (userId: string) => {
    setStatus('loading');
    try {
      const diagrams = await listDiagrams(userId);
      setRows(diagrams.map(toDiagramRow));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh(user.uid);
  }, [user, refresh]);

  const handleCreate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const id = await createDiagram(user.uid, 'Untitled diagram', initialDocument, false);
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not create diagram', { description: 'Check sign-in and Firestore rules.' });
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteDiagram(user.uid, deleting.id);
      toast.success('Diagram deleted', { description: deleting.name });
      setDeleting(null);
      await refresh(user.uid);
    } catch {
      toast.error('Could not delete diagram');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<DiagramRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Diagram',
        cell: ({ row }) => (
          <Link href={`/diagrams/${row.original.id}/edit`} className='block min-w-0 transition hover:opacity-80' title='Open in editor'>
            <p className='truncate font-medium text-zinc-100'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-zinc-500'>{row.original.id}</p>
          </Link>
        ),
      },
      {
        accessorKey: 'public',
        header: 'Visibility',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30'>
              <Globe size={10} />
              Public
            </span>
          ) : (
            <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 ring-1 ring-white/10'>
              <LockKeyhole size={10} />
              Private
            </span>
          ),
      },
      {
        accessorKey: 'nodeCount',
        header: 'Nodes',
        cell: ({ getValue }) => <span className='tabular-nums'>{getValue<number>()}</span>,
      },
      {
        accessorKey: 'edgeCount',
        header: 'Edges',
        cell: ({ getValue }) => <span className='tabular-nums'>{getValue<number>()}</span>,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ getValue }) => <span className='whitespace-nowrap text-zinc-400'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => <span className='whitespace-nowrap text-zinc-500'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <Link href={`/diagrams/${row.original.id}/edit`} className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/6 hover:text-sky-200' title='Open in editor'>
              <Pencil size={13} />
              Edit
            </Link>
            <Link href={`/diagrams/${row.original.id}/view`} target='_blank' className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/6 hover:text-sky-200' title='Open read-only viewer'>
              <ExternalLink size={13} />
              View
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

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  return (
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Flowgram Tools</h1>
            <p className='text-xs text-zinc-500'>Your diagrams · click one to open the editor</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button size='sm' disabled={busy} onClick={() => void handleCreate()} className='bg-cyan-300 text-zinc-950 hover:bg-cyan-200'>
            {busy ? <LoaderCircle size={13} className='animate-spin' /> : <Plus size={13} />}
            New diagram
          </Button>
          <Button variant='outline' size='sm' onClick={() => void refresh(user.uid)} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
          <UserMenu user={user} />
        </div>
      </header>

      <div className='flex items-center gap-3 px-6 py-3'>
        <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name or id…' className='max-w-xs border-white/10 bg-black/25' />
        <p className='text-xs text-zinc-500'>{status === 'ready' ? `${table.getFilteredRowModel().rows.length} diagram(s)` : status === 'error' ? 'Failed to load diagrams' : 'Loading diagrams…'}</p>
      </div>

      <div className='min-h-0 flex-1 overflow-auto px-6'>
        <table className='w-full border-separate border-spacing-0 text-left text-sm'>
          <thead className='sticky top-0 z-10'>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className='border-b border-white/8 bg-zinc-950/95 px-3 py-2.5 text-[10px] font-bold text-zinc-400 backdrop-blur-xl'>
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
                  {status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No diagrams yet — create your first one with “New diagram”.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className='group transition hover:bg-white/4'>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className='border-b border-white/5 px-3 py-2.5'>
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
            <AlertDialogTitle>Delete diagram?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.name}” will be permanently deleted. This action cannot be undone.</AlertDialogDescription>
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
