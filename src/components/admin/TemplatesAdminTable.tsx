'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { LayoutTemplate, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DataTable, DataTableFooter, formatDateTime, formatNumber } from '@/components/data-table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTemplate, deleteTemplate, listTemplates, type StoredTemplate } from '@/lib/firebase/templates';

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
            <p className='truncate font-medium text-foreground'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-muted-foreground'>{row.original.id}</p>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => <span className='whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border'>{getValue<string>()}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => <span className='block max-w-64 truncate text-xs text-muted-foreground'>{getValue<string>() || '—'}</span>,
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
        cell: ({ getValue }) => <span className='whitespace-nowrap text-muted-foreground'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <Link href={`/admin/templates/${row.original.id}/edit`} className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-sky-700 dark:hover:text-sky-200' title='Edit template'>
              <Pencil size={13} />
              Edit
            </Link>
            <Button variant='ghost' size='xs' onClick={() => setDeleting(row.original)} className='text-muted-foreground hover:text-rose-600 dark:hover:text-rose-200'>
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
    <div className='flex h-full flex-col bg-background text-foreground'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <LayoutTemplate size={18} className='text-sky-600 dark:text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>Templates admin</h1>
            <p className='text-xs text-muted-foreground'>templates/{'{template_id}'} · shared library for every user</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='accent' disabled={busy} onClick={() => void handleCreate()}>
            <Plus size={13} />
            New template
          </Button>
          <Button variant='toolbar' onClick={() => void refresh()}>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-3 px-6 py-3'>
        <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name, category or id…' variant='toolbar' className='max-w-xs' />
        <p className='text-xs text-muted-foreground'>{status === 'ready' ? `${table.getFilteredRowModel().rows.length} template(s)` : status === 'error' ? 'Failed to load templates' : 'Loading templates…'}</p>
      </div>

      <DataTable
        table={table}
        narrowColumns={NARROW_COLUMNS}
        rightAlignedColumns={RIGHT_ALIGNED_COLUMNS}
        emptyMessage={status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No templates yet — use “New template”.'}
      />

      <DataTableFooter table={table} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className='border border-border bg-popover'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-600 dark:text-rose-300'>
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
