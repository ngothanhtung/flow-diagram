'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { BookOpen, Boxes, Ellipsis, Eye, ExternalLink, Globe, LayoutTemplate, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DataTable, DataTableFooter, formatDateTime, formatNumber } from '@/components/data-table';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { SharedVerifyNotice } from '@/components/auth/AccessViews';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShareDialog } from '@/components/diagrams/ShareDialog';
import { ThemeToggle } from '@/components/theme-toggle';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { createDiagram, deleteDiagram, listDiagrams, listSharedWithMe, type SharedDiagram, type StoredDiagram } from '@/lib/firebase/diagrams';
import { listOwnedAccess } from '@/lib/firebase/sharing';
import { ACCESS_LEVEL_LABELS, routeForRole, type AccessLevel } from '@/lib/sharing';
import { listTemplates, type StoredTemplate } from '@/lib/firebase/templates';
import { actorOf, savedByLabel, type VersionActor } from '@/lib/version-history';
import type { User } from 'firebase/auth';

/** Columns that should shrink to their content instead of stretching. */
const NARROW_COLUMNS = new Set(['no', 'public', 'nodeCount', 'edgeCount', 'updatedAt', 'createdAt', 'actions']);
/** Columns whose content should align to the right (numbers, actions). */
const RIGHT_ALIGNED_COLUMNS = new Set(['no', 'nodeCount', 'edgeCount', 'actions']);

/** Flattened row for the owner's diagram list (timestamps as millis). */
interface DiagramRow {
  id: string;
  name: string;
  public: boolean;
  nodeCount: number;
  edgeCount: number;
  createdAt: number | null;
  updatedAt: number | null;
  /** Who performed the last Save; absent before Versions existed. */
  lastSavedBy: VersionActor | null;
}

/** "people" with the right number: 1 person, 2 people. */
function people(count: number) {
  return count === 1 ? '1 person' : `${count} people`;
}

/** Marker on an owned Diagram that is shared: people icon + count. */
function SharedMarker({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-400/30 dark:text-violet-200'
      title={`Shared with ${people(count)}`}
      data-testid='shared-marker'
    >
      <Users size={10} />
      {count}
    </span>
  );
}

function LevelBadge({ level }: { level: AccessLevel }) {
  return level === 'edit' ? (
    <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-400/30 dark:text-sky-200'>
      <Pencil size={10} />
      {ACCESS_LEVEL_LABELS.edit}
    </span>
  ) : (
    <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border'>
      <Eye size={10} />
      {ACCESS_LEVEL_LABELS.view}
    </span>
  );
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
    lastSavedBy: diagram.lastSavedBy ?? null,
  };
}

/** Single-column row actions (Edit / View / Share / Delete) behind an ellipsis trigger. */
function RowActionsMenu({ diagram, onDelete, onShare }: { diagram: DiagramRow; onDelete: () => void; onShare: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant='ghost' size='icon-xs' className='text-muted-foreground hover:text-foreground' />}>
        <Ellipsis size={14} />
        <span className='sr-only'>Actions</span>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-40 border-border bg-popover/95 p-1 backdrop-blur-xl'>
        <Command className='bg-transparent p-0'>
          <CommandList className='max-h-none overflow-visible'>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  router.push(`/diagrams/${diagram.id}/edit`);
                }}
              >
                <Pencil size={13} />
                Edit
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  window.open(`/diagrams/${diagram.id}/view`, '_blank');
                }}
              >
                <ExternalLink size={13} />
                View
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onShare();
                }}
              >
                <Share2 size={13} />
                Share
              </CommandItem>
              <CommandItem
                className='text-rose-600 dark:text-rose-300 data-selected:bg-rose-500/10 data-selected:text-rose-700 dark:data-selected:text-rose-100'
                onSelect={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={13} />
                Delete
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  const [sharing, setSharing] = useState<DiagramRow | null>(null);
  const [remoteTemplates, setRemoteTemplates] = useState<StoredTemplate[]>([]);
  /** Diagram id → how many people it's shared with (my Diagrams only). */
  const [sharedCounts, setSharedCounts] = useState<Map<string, number>>(() => new Map());
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [sharedCount, setSharedCount] = useState<number | null>(null);
  const currentUid = user?.uid ?? null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listTemplates()
      .then((templates) => {
        if (!cancelled) setRemoteTemplates(templates);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const templateItems = useMemo(
    () =>
      remoteTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        category: template.category ?? 'General',
        description: template.description ?? '',
        nodeCount: template.document?.nodes?.length ?? 0,
        document: template.document ?? { nodes: [], edges: [] },
      })),
    [remoteTemplates],
  );

  const refresh = useCallback(async (userId: string) => {
    setStatus('loading');
    try {
      const [diagrams, owned] = await Promise.all([
        listDiagrams(userId),
        // Only the marker and the delete warning depend on it: a failed
        // read leaves them blank rather than failing the whole list.
        listOwnedAccess(userId).catch((error: unknown) => {
          console.warn('Could not read which diagrams are shared', error);
          return new Map();
        }),
      ]);
      setRows(diagrams.map(toDiagramRow));
      setSharedCounts(new Map([...owned].map(([id, index]) => [id, index.collaboratorEmails.length])));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh(user.uid);
  }, [user, refresh]);

  const handleCreate = async (document: FlowDocumentJSON = { nodes: [], edges: [] }, name = 'Untitled diagram') => {
    if (!user) return;
    setBusy(true);
    try {
      const id = await createDiagram(user.uid, name, document, false, actorOf(user));
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
      setSharedCounts((current) => {
        const next = new Map(current);
        next.delete(deleting.id);
        return next;
      });
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
        id: 'no',
        header: '#',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <span className='tabular-nums text-muted-foreground'>{row.index + 1}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Diagram',
        cell: ({ row }) => (
          <Link href={`/diagrams/${row.original.id}/edit`} className='block min-w-0 transition hover:opacity-80' title='Open in editor'>
            <p className='truncate font-medium text-foreground'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-muted-foreground'>{row.original.id}</p>
          </Link>
        ),
      },
      {
        accessorKey: 'public',
        header: 'Visibility',
        cell: ({ row, getValue }) => (
          <div className='flex items-center gap-1.5'>
            {getValue<boolean>() ? (
            <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-400/30'>
              <Globe size={10} />
              Public
            </span>
          ) : (
            <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border'>
              <LockKeyhole size={10} />
              Private
            </span>
            )}
            <SharedMarker count={sharedCounts.get(row.original.id) ?? 0} />
          </div>
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
        // "Last saved by … at …": the time is `updatedAt`, the person is
        // `lastSavedBy` (a Collaborator once Share lands, so not always you).
        accessorKey: 'updatedAt',
        header: 'Last saved',
        cell: ({ row, getValue }) => (
          <div className='whitespace-nowrap'>
            <p className='text-muted-foreground'>{formatDateTime(getValue<number | null>())}</p>
            {row.original.lastSavedBy && <p className='text-[10px] text-muted-foreground'>by {savedByLabel(row.original.lastSavedBy, currentUid)}</p>}
          </div>
        ),
        sortDescFirst: true,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => <span className='whitespace-nowrap text-muted-foreground'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <RowActionsMenu diagram={row.original} onDelete={() => setDeleting(row.original)} onShare={() => setSharing(row.original)} />,
      },
    ],
    [currentUid, sharedCounts],
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
    <div className='flex h-screen flex-col bg-background text-foreground'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-600 dark:text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>X Flow Tool</h1>
            <p className='text-xs text-muted-foreground'>Your diagrams · click one to open the editor</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='toolbar' disabled={busy} />}>
              <LayoutTemplate size={13} />
              New from template
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-80 border-border bg-popover/95 p-1.5 backdrop-blur-xl'>
              <DropdownMenuGroup>
                <DropdownMenuLabel className='px-2 py-1.5'>Templates</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className='bg-border' />
              {templateItems.length === 0 && <p className='px-2 py-4 text-center text-xs text-muted-foreground'>No templates are available in Firestore.</p>}
              {templateItems.map((template) => (
                <DropdownMenuItem key={template.id} onClick={() => void handleCreate(template.document, template.name)} className='flex-col items-start gap-0.5 px-2 py-2'>
                  <span className='flex w-full items-center justify-between gap-2 text-xs font-semibold text-foreground'>
                    {template.name}
                    <span className='shrink-0 font-mono text-[9px] font-normal text-muted-foreground'>{template.nodeCount} blocks</span>
                  </span>
                  <span className='block truncate text-[10px] font-normal text-muted-foreground'>
                    {template.category} · {template.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant='accent' disabled={busy} onClick={() => void handleCreate()}>
            {busy ? <LoaderCircle size={13} className='animate-spin' /> : <Plus size={13} />}
            New diagram
          </Button>
          <Button variant='toolbar' onClick={() => void refresh(user.uid)}>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
          <Button variant='toolbar' nativeButton={false} render={<Link href='/help' title='User guide' />}>
            <BookOpen size={13} />
            Help
          </Button>
          <Button variant='toolbar' nativeButton={false} render={<Link href='/guide' title='Diagram authoring guide' />}>
            <BookOpen size={13} />
            Guide
          </Button>
          <ThemeToggle variant='toolbar' size='icon' />
          <UserMenu user={user} />
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value === 'shared' ? 'shared' : 'mine')} className='min-h-0 flex-1 gap-0'>
        <div className='flex flex-wrap items-center gap-3 px-6 py-3'>
          <TabsList>
            <TabsTrigger value='mine' className='text-xs'>
              My diagrams
            </TabsTrigger>
            <TabsTrigger value='shared' className='text-xs' data-testid='shared-tab'>
              <Users size={12} />
              Shared with me{sharedCount ? ` (${sharedCount})` : ''}
            </TabsTrigger>
          </TabsList>
          {tab === 'mine' && (
            <>
              <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder='Search by name or id…' variant='toolbar' className='max-w-xs' />
              <p className='text-xs text-muted-foreground'>{status === 'ready' ? `${table.getFilteredRowModel().rows.length} diagram(s)` : status === 'error' ? 'Failed to load diagrams' : 'Loading diagrams…'}</p>
            </>
          )}
        </div>

        <TabsContent value='mine' className='flex min-h-0 flex-1 flex-col'>
          <DataTable
            table={table}
            narrowColumns={NARROW_COLUMNS}
            rightAlignedColumns={RIGHT_ALIGNED_COLUMNS}
            emptyMessage={status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No diagrams yet — create your first one with “New diagram”.'}
          />
          <DataTableFooter table={table} />
        </TabsContent>

        {/* Kept mounted (hidden when inactive) so the tab can show its count. */}
        <TabsContent value='shared' keepMounted className='flex min-h-0 flex-1 flex-col data-hidden:hidden'>
          <SharedWithMe user={user} onCount={setSharedCount} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className='border border-border bg-popover'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-600 dark:text-rose-300'>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” and its whole version history will be permanently deleted. This action cannot be undone.
              {deleting && (sharedCounts.get(deleting.id) ?? 0) > 0 && (
                <span className='mt-2 block font-semibold text-rose-700 dark:text-rose-300' data-testid='delete-shared-warning'>
                  This Diagram is shared with {people(sharedCounts.get(deleting.id) ?? 0)}. It disappears from their “Shared with me” and they lose access immediately.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' disabled={busy} onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareDialog
        open={sharing !== null}
        onOpenChange={(open) => !open && setSharing(null)}
        diagramId={sharing?.id ?? ''}
        owner={{ uid: user.uid, email: user.email }}
        isPublic={sharing?.public ?? false}
        onPublicChange={(isPublic) => {
          if (!sharing) return;
          setSharing({ ...sharing, public: isPublic });
          setRows((current) => current.map((row) => (row.id === sharing.id ? { ...row, public: isPublic } : row)));
        }}
        onCollaboratorsChange={(count) => {
          if (!sharing) return;
          setSharedCounts((current) => new Map(current).set(sharing.id, count));
        }}
      />
    </div>
  );
}

/** Flattened row for "Shared with me". */
interface SharedRow {
  id: string;
  name: string;
  ownerEmail: string;
  level: AccessLevel;
  updatedAt: number | null;
  lastSavedBy: VersionActor | null;
}

function toSharedRow({ diagram, ownerEmail, level }: SharedDiagram): SharedRow {
  return {
    id: diagram.id,
    name: diagram.name || '(untitled)',
    ownerEmail: ownerEmail || 'Unknown',
    level,
    updatedAt: diagram.updatedAt ? diagram.updatedAt.toMillis() : null,
    lastSavedBy: diagram.lastSavedBy ?? null,
  };
}

/**
 * "Shared with me" (PRD §4.2): Diagrams other people shared with the
 * signed-in user — Owner, Access level, last saved — opening in the Editor
 * (Can edit) or the Viewer (Can view). An unverified email sees why the
 * list is empty instead (`SharedVerifyNotice`): the rules only honour an
 * invite for a verified email.
 */
function SharedWithMe({ user, onCount }: { user: User; onCount: (count: number | null) => void }) {
  const [verified, setVerified] = useState(user.emailVerified);
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!verified || !user.email) return;
    let cancelled = false;
    listSharedWithMe({ email: user.email })
      .then((shared) => {
        if (cancelled) return;
        setRows(shared.map(toSharedRow));
        setStatus('ready');
        onCount(shared.length);
      })
      .catch((error: unknown) => {
        console.error('Could not list diagrams shared with me', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [verified, user, reloads, onCount]);

  // Newest save first. A plain table rather than a second TanStack one:
  // the list is short, needs no paging or search, and every column reads
  // straight off the row.
  const sorted = useMemo(() => [...rows].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)), [rows]);

  if (!verified) {
    return (
      <div className='px-6'>
        <SharedVerifyNotice user={user} onVerified={() => setVerified(true)} />
      </div>
    );
  }

  return (
    <>
      <div className='flex items-center gap-3 px-6 pb-2'>
        <p className='text-xs text-muted-foreground'>{status === 'ready' ? `${rows.length} shared with you` : status === 'error' ? 'Failed to load' : 'Loading…'}</p>
        <Button variant='ghost' size='xs' onClick={() => setReloads((count) => count + 1)} className='text-muted-foreground'>
          <RefreshCw size={11} />
          Refresh
        </Button>
      </div>
      <div className='min-h-0 flex-1 overflow-auto px-6'>
        <table className='w-full border-separate border-spacing-0 text-left text-sm' data-testid='shared-table'>
          <thead className='sticky top-0 z-10'>
            <tr>
              {['Diagram', 'Owner', 'Access', 'Last saved', ''].map((label, column) => (
                <th key={column} className={['border-b border-border bg-background/95 px-3 py-2.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase backdrop-blur-xl', column >= 2 ? 'w-px whitespace-nowrap' : ''].join(' ')}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className='px-3 py-16 text-center text-sm text-muted-foreground'>
                  {status === 'error' ? 'Could not read the Diagrams shared with you.' : status === 'loading' ? 'Loading…' : 'Nothing has been shared with you yet. When someone invites your email, the Diagram appears here.'}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const href = routeForRole(row.level, row.id);
                return (
                  <tr key={row.id} className='transition hover:bg-accent/40' data-testid='shared-row'>
                    <td className='border-b border-border px-3 py-2.5'>
                      <Link href={href} className='block min-w-0 transition hover:opacity-80' title={row.level === 'edit' ? 'Open in editor' : 'Open in viewer'}>
                        <p className='truncate font-medium text-foreground'>{row.name}</p>
                        <p className='truncate font-mono text-[10px] text-muted-foreground'>{row.id}</p>
                      </Link>
                    </td>
                    <td className='border-b border-border px-3 py-2.5 text-muted-foreground'>{row.ownerEmail}</td>
                    <td className='w-px border-b border-border px-3 py-2.5 whitespace-nowrap'>
                      <LevelBadge level={row.level} />
                    </td>
                    <td className='w-px border-b border-border px-3 py-2.5 whitespace-nowrap'>
                      <p className='text-muted-foreground'>{formatDateTime(row.updatedAt)}</p>
                      {row.lastSavedBy && <p className='text-[10px] text-muted-foreground'>by {savedByLabel(row.lastSavedBy, user.uid)}</p>}
                    </td>
                    <td className='w-px border-b border-border px-3 py-2.5 text-right whitespace-nowrap'>
                      <Button variant='toolbar' size='sm' nativeButton={false} render={<Link href={href} />}>
                        {row.level === 'edit' ? <Pencil size={12} /> : <Eye size={12} />}
                        {row.level === 'edit' ? 'Edit' : 'View'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
