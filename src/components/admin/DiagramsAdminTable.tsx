'use client';

import { useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type Header, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Braces, ChevronLeft, ChevronRight, Database, Eye, RefreshCw, ShieldOff } from 'lucide-react';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listAllDiagrams, type AdminDiagramRow } from '@/lib/firebase/diagrams';
import { isAdminUser } from '@/lib/firebase/roles';

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: number | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

/** Sort header button — shows the current sort direction of the column. */
function SortButton({ header }: { header: Header<AdminDiagramRow, unknown> }) {
  const column = header.column;
  const sorted = column.getIsSorted();
  return (
    <button type='button' onClick={column.getToggleSortingHandler()} className='inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-zinc-100'>
      {flexRender(column.columnDef.header, header.getContext())}
      {sorted === 'asc' ? <ArrowUp size={12} className='text-sky-300' /> : sorted === 'desc' ? <ArrowDown size={12} className='text-sky-300' /> : <ArrowUpDown size={12} className='text-zinc-600' />}
    </button>
  );
}

export function AdminDiagramsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<AdminDiagramRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewing, setViewing] = useState<AdminDiagramRow | null>(null);
  const [roleStatus, setRoleStatus] = useState<'checking' | 'denied' | 'admin'>('checking');

  // Gate on `users-roles/{uid}` before touching any diagram data.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void isAdminUser(user.uid).then((allowed) => {
      if (!cancelled) setRoleStatus(allowed ? 'admin' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useMemo(
    () => async () => {
      setStatus('loading');
      try {
        setRows(await listAllDiagrams());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (roleStatus === 'admin') void refresh();
  }, [roleStatus, refresh]);

  const columns = useMemo<ColumnDef<AdminDiagramRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Diagram',
        cell: ({ row }) => (
          <div className='min-w-0'>
            <p className='truncate font-medium text-zinc-100'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-zinc-500'>{row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: 'ownerUid',
        header: 'Owner UID',
        cell: ({ getValue }) => <span className='font-mono text-[11px] text-zinc-400'>{getValue<string>().slice(0, 10)}…</span>,
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
          <Button variant='ghost' size='xs' onClick={() => setViewing(row.original)} className='text-zinc-400 hover:text-sky-200'>
            <Eye size={13} />
            View
          </Button>
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

  if (loading || roleStatus === 'checking') return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  if (roleStatus === 'denied') {
    return (
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-red-500/15 ring-1 ring-red-400/40'>
            <ShieldOff size={22} className='text-red-300' />
          </div>
          <div>
            <h1 className='text-sm font-semibold'>Không có quyền truy cập</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>Trang này chỉ dành cho người dùng có role `administrators` trong `users-roles`.</p>
          </div>
          <Button variant='outline' size='sm' onClick={() => (window.location.href = '/')} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex items-center justify-between border-b border-white/5 px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Database size={18} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Diagrams admin</h1>
            <p className='text-xs text-zinc-500'>
              users/{'{uid}'}/diagrams/{'{diagram_id}'} · read-only
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => void refresh()} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
          <Button variant='outline' size='sm' onClick={() => (window.location.href = '/')} className='border-white/10 bg-black/25 text-zinc-300 hover:bg-white/8'>
            Back to editor
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-3 px-6 py-3'>
        <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name, id or owner…' className='max-w-xs border-white/10 bg-black/25' />
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
                  {status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No diagrams found.'}
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

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className='max-w-3xl border-white/10 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-sm font-semibold'>
              <Braces size={14} className='text-sky-300' />
              {viewing?.name}
            </DialogTitle>
            <DialogDescription className='font-mono text-[11px] text-zinc-500'>
              users/{viewing?.ownerUid}/diagrams/{viewing?.id}
            </DialogDescription>
          </DialogHeader>
          <pre className='max-h-[60vh] overflow-auto rounded-lg bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/8'>{viewing ? JSON.stringify(viewing.document, null, 2) : ''}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
