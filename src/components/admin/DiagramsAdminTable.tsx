'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { Braces, Database, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { DataTable, DataTableFooter, formatDateTime, formatNumber } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listAllDiagrams, type AdminDiagramRow } from '@/lib/firebase/diagrams';

/** Columns that should shrink to their content instead of stretching. */
const NARROW_COLUMNS = new Set(['public', 'nodeCount', 'edgeCount', 'updatedAt', 'createdAt', 'actions']);
/** Columns whose content should align to the right (numbers, actions). */
const RIGHT_ALIGNED_COLUMNS = new Set(['nodeCount', 'edgeCount', 'actions']);

export function AdminDiagramsPage() {
  const [rows, setRows] = useState<AdminDiagramRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewing, setViewing] = useState<AdminDiagramRow | null>(null);

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
    void refresh();
  }, [refresh]);

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
        accessorKey: 'public',
        header: 'Visibility',
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <span className='whitespace-nowrap rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30'>Public</span>
          ) : (
            <span className='whitespace-nowrap rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 ring-1 ring-white/10'>Private</span>
          ),
      },
      {
        accessorKey: 'nodeCount',
        header: 'Nodes',
        cell: ({ getValue }) => <span className='tabular-nums'>{formatNumber(getValue<number>())}</span>,
      },
      {
        accessorKey: 'edgeCount',
        header: 'Edges',
        cell: ({ getValue }) => <span className='tabular-nums'>{formatNumber(getValue<number>())}</span>,
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
            <Button variant='ghost' size='xs' onClick={() => setViewing(row.original)} className='text-zinc-400 hover:text-sky-200'>
              <Eye size={13} />
              View
            </Button>
            <Link href={`/diagrams/${row.original.id}/view`} target='_blank' className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/6 hover:text-sky-200' title='Open read-only viewer'>
              <ExternalLink size={13} />
              Open
            </Link>
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
          <Button variant='toolbar' onClick={() => void refresh()}>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-3 px-6 py-3'>
        <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name, id or owner…' variant='toolbar' className='max-w-xs' />
        <p className='text-xs text-zinc-500'>{status === 'ready' ? `${table.getFilteredRowModel().rows.length} diagram(s)` : status === 'error' ? 'Failed to load diagrams' : 'Loading diagrams…'}</p>
      </div>

      <DataTable
        table={table}
        narrowColumns={NARROW_COLUMNS}
        rightAlignedColumns={RIGHT_ALIGNED_COLUMNS}
        emptyMessage={status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No diagrams found.'}
      />

      <DataTableFooter table={table} />

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
