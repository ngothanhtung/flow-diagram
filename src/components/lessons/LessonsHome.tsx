'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Boxes, ExternalLink, FolderInput, GraduationCap, LoaderCircle, MoreHorizontal, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { DataTable, DataTableFooter, formatDateTime, formatNumber } from '@/components/data-table';
import { ThemeToggle } from '@/components/theme-toggle';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FolderIcon } from '@/components/lessons/FolderIcon';
import { LessonTreePanel, type TreeSelection } from '@/components/lessons/LessonTreePanel';
import { MoveToFolderDialog } from '@/components/lessons/lesson-tree-dialogs';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { reconcileStoredTree, updateLessonTree } from '@/lib/firebase/lesson-tree';
import { createLesson, deleteLesson, listLessons, setLessonPublic, type StoredLesson } from '@/lib/firebase/lessons';
import { childFolders, emptyLessonTree, folderLessons, folderNumber, moveLesson, reconcileLessonTree, reorderLesson, type LessonTree, type TreeEdit } from '@/lib/lesson/lesson-tree';
import { emptyLessonDocument, lessonNameOf } from '@/lib/lesson/lesson-types';

/** Which folders are expanded on `/lessons`, per user, in this browser. */
const openKey = (uid: string) => `xflow:lesson-tree-open:${uid}`;

function loadOpenIds(uid: string): Set<string> | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(openKey(uid)) ?? 'null');
    return Array.isArray(raw) ? new Set(raw.filter((id): id is string => typeof id === 'string')) : null;
  } catch {
    return null;
  }
}

function saveOpenIds(uid: string, ids: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(openKey(uid), JSON.stringify([...ids]));
  } catch {
    // Storage full or blocked: the tree just won't remember what was open.
  }
}

const NARROW_COLUMNS = new Set(['stepCount', 'public', 'updatedAt', 'actions', 'folder']);
const RIGHT_ALIGNED_COLUMNS = new Set(['stepCount', 'actions']);

interface LessonRow {
  id: string;
  name: string;
  public: boolean;
  stepCount: number;
  updatedAt: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toLessonRow(lesson: StoredLesson): LessonRow {
  // listLessons returns raw Firestore data: never trust the shape.
  const steps: unknown = lesson.document?.steps;
  return {
    id: lesson.id,
    // The Lesson's one name is its meta.title (what the editor and viewer
    // show); the stored `name` is its copy as of the last Save.
    name: isRecord(lesson.document) && isRecord(lesson.document.meta) ? lessonNameOf(lesson.document) : typeof lesson.name === 'string' && lesson.name ? lesson.name : 'Untitled lesson',
    public: lesson.public === true,
    stepCount: Array.isArray(steps) ? steps.length : 0,
    updatedAt: lesson.updatedAt ? lesson.updatedAt.toMillis() : null,
  };
}

/** Token-coloured on/off switch (there is no Switch primitive in ui/). */
function PublicSwitch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 ring-border transition disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-accent'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** `/lessons`: every Lesson owned by the signed-in user, organised in their Lesson tree. */
export function LessonsHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LessonRow | null>(null);
  // The stored tree (null = the user has none yet) and what the panel shows.
  const [storedTree, setStoredTree] = useState<LessonTree | null>(null);
  const [selection, setSelection] = useState<TreeSelection>({ kind: 'all' });
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [movingLesson, setMovingLesson] = useState<LessonRow | null>(null);

  const refresh = useCallback(async (userId: string) => {
    setStatus('loading');
    try {
      const lessons = await listLessons(userId);
      // The tree is extra: failing to read or repair it never hides the list.
      const tree = await reconcileStoredTree(userId, lessons).catch(() => null);
      // Rows and tree land together, so the list never flashes everything as Unfiled.
      setRows(lessons.map(toLessonRow));
      setStoredTree(tree);
      setOpenIds(loadOpenIds(userId) ?? new Set(tree ? childFolders(tree, null).map((folder) => folder.id) : []));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh(user.uid);
  }, [user, refresh]);

  // The index always lists every Lesson on screen, even before the stored tree caught up.
  const summaries = useMemo(() => rows.map((row) => ({ id: row.id, title: row.name, public: row.public })), [rows]);
  const tree = useMemo(() => reconcileLessonTree(storedTree ?? emptyLessonTree(), summaries).tree, [storedTree, summaries]);
  // A selected folder that was deleted (or moved away in another tab) falls back to All lessons.
  const view = useMemo<TreeSelection>(() => (selection.kind === 'folder' && !Object.hasOwn(tree.folders, selection.id) ? { kind: 'all' } : selection), [selection, tree]);

  const editTree = async (edit: (tree: LessonTree) => TreeEdit): Promise<boolean> => {
    if (!user) return false;
    try {
      // Index what this page shows (the first folder ever created indexes every Lesson), but only add:
      // this page's list may predate a Lesson another tab created into a folder, or a title it saved.
      // Titles and Public flags are kept current by Save / Public themselves and by the load-time reconcile.
      const result = await updateLessonTree(user.uid, (current) => edit(reconcileLessonTree(current, summaries, { prune: false, refresh: false }).tree));
      if (!result.ok) {
        toast.error(result.reason);
        return false;
      }
      setStoredTree(result.tree);
      return true;
    } catch {
      toast.error('Could not update folders', { description: 'Check your connection and try again.' });
      return false;
    }
  };

  const select = (next: TreeSelection) => {
    setSelection(next);
    // A folder lists its lessons in their own order; the other views sort by date.
    setSorting(next.kind === 'folder' ? [] : [{ id: 'updatedAt', desc: true }]);
  };

  const toggleOpen = (folderId: string, open?: boolean) => {
    if (!user) return;
    const next = new Set(openIds);
    if (open ?? !next.has(folderId)) next.add(folderId);
    else next.delete(folderId);
    setOpenIds(next);
    saveOpenIds(user.uid, next);
  };

  const visibleRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    if (view.kind === 'folder') return folderLessons(tree, view.id).flatMap((entry) => byId.get(entry.id) ?? []);
    if (view.kind === 'unfiled') return rows.filter((row) => (Object.hasOwn(tree.lessons, row.id) ? tree.lessons[row.id].folderId : null) === null);
    return rows;
  }, [rows, tree, view]);

  const handleCreate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const id = await createLesson(user.uid, emptyLessonDocument(), view.kind === 'folder' ? view.id : null);
      router.push(`/lessons/${id}/edit`);
    } catch {
      toast.error('Could not create lesson', { description: 'Check sign-in and Firestore rules.' });
      setBusy(false);
    }
  };

  const handleTogglePublic = async (row: LessonRow, next: boolean) => {
    if (!user) return;
    setTogglingId(row.id);
    try {
      await setLessonPublic(user.uid, row.id, next);
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, public: next } : entry)));
    } catch {
      toast.error('Could not change visibility', { description: row.name });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteLesson(user.uid, deleting.id);
      toast.success('Lesson deleted', { description: deleting.name });
      setDeleting(null);
      await refresh(user.uid);
    } catch {
      toast.error('Could not delete lesson');
    } finally {
      setBusy(false);
    }
  };

  const folderLabel = (folderId: string | null) => (folderId !== null && Object.hasOwn(tree.folders, folderId) ? `${folderNumber(tree, folderId)} ${tree.folders[folderId].name}` : null);

  const columns = useMemo<ColumnDef<LessonRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Lesson',
        cell: ({ row }) => (
          <Link href={`/lessons/${row.original.id}/edit`} className='block min-w-0 transition hover:opacity-80' title='Open in editor'>
            <p className='truncate font-medium text-foreground'>{row.original.name}</p>
            <p className='truncate font-mono text-[10px] text-muted-foreground'>{row.original.id}</p>
          </Link>
        ),
      },
      {
        id: 'folder',
        header: 'Folder',
        enableSorting: false,
        cell: ({ row }) => {
          const folderId = Object.hasOwn(tree.lessons, row.original.id) ? tree.lessons[row.original.id].folderId : null;
          const label = folderLabel(folderId);
          if (!label || folderId === null) return <span className='text-xs text-muted-foreground'>Unfiled</span>;
          return (
            <button type='button' className='flex max-w-48 items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground' onClick={() => select({ kind: 'folder', id: folderId })} title={`Show ${label}`}>
              <FolderIcon color={tree.folders[folderId].color} size={12} className='shrink-0' />
              <span className='truncate'>{label}</span>
            </button>
          );
        },
      },
      {
        accessorKey: 'stepCount',
        header: 'Lesson steps',
        cell: ({ getValue }) => <span className='tabular-nums'>{formatNumber(getValue<number>())}</span>,
      },
      {
        accessorKey: 'public',
        header: 'Public',
        cell: ({ row }) => (
          <PublicSwitch checked={row.original.public} disabled={togglingId === row.original.id} label={`Public: ${row.original.name}`} onChange={(next) => void handleTogglePublic(row.original, next)} />
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Last saved',
        cell: ({ getValue }) => <span className='whitespace-nowrap text-muted-foreground'>{formatDateTime(getValue<number | null>())}</span>,
        sortDescFirst: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            <Button variant='ghost' size='xs' className='text-muted-foreground hover:text-foreground' nativeButton={false} render={<Link href={`/lessons/${row.original.id}/view`} target='_blank' />}>
              <ExternalLink size={12} />
              View
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='ghost' size='icon-xs' aria-label={`More actions: ${row.original.name}`} className='text-muted-foreground hover:text-foreground' />}>
                <MoreHorizontal size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48 border-border bg-popover'>
                <DropdownMenuItem onClick={() => setMovingLesson(row.original)}>
                  <FolderInput /> Move to folder…
                </DropdownMenuItem>
                {view.kind === 'folder' && (
                  <>
                    <DropdownMenuItem disabled={row.index === 0} onClick={() => void editTree((current) => reorderLesson(current, row.original.id, -1))}>
                      <ArrowUp /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={row.index >= visibleRows.length - 1} onClick={() => void editTree((current) => reorderLesson(current, row.original.id, 1))}>
                      <ArrowDown /> Move down
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem variant='destructive' onClick={() => setDeleting(row.original)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // The handlers only close over `user`, the tree and the rows on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [togglingId, user, tree, view.kind, visibleRows],
  );

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting, columnVisibility: { folder: view.kind === 'all' } },
    // A folder lists its lessons in their own order — the one Move up/down changes — so its
    // columns don't sort; All lessons and Unfiled do.
    enableSorting: view.kind !== 'folder',
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
            <GraduationCap size={18} className='text-sky-600 dark:text-sky-300' />
          </div>
          <div>
            <h1 className='text-base font-semibold'>X Flow Tool</h1>
            <p className='text-xs text-muted-foreground'>Your lessons · organise them in folders, click one to open the editor</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='accent' disabled={busy} onClick={() => void handleCreate()}>
            {busy ? <LoaderCircle size={13} className='animate-spin' /> : <Plus size={13} />}
            New lesson
          </Button>
          <Button variant='toolbar' onClick={() => void refresh(user.uid)}>
            <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : undefined} />
            Refresh
          </Button>
          <Button variant='toolbar' nativeButton={false} render={<Link href='/' title='Your diagrams' />}>
            <Boxes size={13} />
            Diagrams
          </Button>
          <ThemeToggle variant='toolbar' size='icon' />
          <UserMenu user={user} />
        </div>
      </header>

      <div className='flex min-h-0 flex-1 flex-col md:flex-row'>
        <aside className='max-h-[40vh] shrink-0 overflow-auto border-b border-border md:max-h-none md:w-72 md:border-r md:border-b-0'>
          <LessonTreePanel tree={tree} totalCount={rows.length} selection={view} openIds={openIds} onSelect={select} onToggle={toggleOpen} onEdit={editTree} />
        </aside>
        <section className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <div className='flex items-center gap-2 px-6 py-3 text-xs text-muted-foreground'>
            {view.kind === 'folder' && <FolderIcon color={tree.folders[view.id].color} size={13} />}
            <span className='font-medium text-foreground'>{view.kind === 'folder' ? folderLabel(view.id) : view.kind === 'unfiled' ? 'Unfiled' : 'All lessons'}</span>
            <span>{status === 'ready' ? `· ${visibleRows.length} lesson(s)` : status === 'error' ? '· Failed to load lessons' : '· Loading lessons…'}</span>
          </div>
          <DataTable
            table={table}
            narrowColumns={NARROW_COLUMNS}
            rightAlignedColumns={RIGHT_ALIGNED_COLUMNS}
            emptyMessage={
              status === 'error'
                ? 'Could not read Firestore. Check sign-in and rules.'
                : status === 'loading'
                  ? 'Loading…'
                  : view.kind === 'all'
                    ? 'No lessons yet — create your first one with “New lesson”.'
                    : view.kind === 'unfiled'
                      ? 'Every lesson is in a folder.'
                      : 'No lessons directly in this folder — “New lesson” creates one here.'
            }
          />
          <DataTableFooter table={table} />
        </section>
      </div>

      <MoveToFolderDialog
        open={movingLesson !== null}
        tree={tree}
        title='Move lesson'
        description={`Choose a folder for “${movingLesson?.name ?? ''}”.`}
        noneLabel='Unfiled'
        currentId={movingLesson && Object.hasOwn(tree.lessons, movingLesson.id) ? tree.lessons[movingLesson.id].folderId : null}
        onPick={(folderId) => {
          if (!movingLesson) return;
          const id = movingLesson.id;
          void editTree((current) => moveLesson(current, id, folderId)).then((moved) => moved && folderId && toggleOpen(folderId, true));
        }}
        onOpenChange={(next) => !next && setMovingLesson(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className='border border-border bg-popover'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-rose-400/10 text-rose-600 dark:text-rose-300'>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.name}” will be permanently deleted, and its public link stops working. This action cannot be undone.</AlertDialogDescription>
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
