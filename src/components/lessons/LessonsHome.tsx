'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { Boxes, ExternalLink, GraduationCap, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { DataTable, DataTableFooter, formatDateTime, formatNumber } from '@/components/data-table';
import { ThemeToggle } from '@/components/theme-toggle';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { createLesson, deleteLesson, listLessons, setLessonPublic, type StoredLesson } from '@/lib/firebase/lessons';
import { emptyLessonDocument, lessonNameOf } from '@/lib/lesson/lesson-types';

const NARROW_COLUMNS = new Set(['stepCount', 'public', 'updatedAt', 'actions']);
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

/** `/lessons`: every Lesson owned by the signed-in user. */
export function LessonsHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LessonRow | null>(null);

  const refresh = useCallback(async (userId: string) => {
    setStatus('loading');
    try {
      setRows((await listLessons(userId)).map(toLessonRow));
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
      const id = await createLesson(user.uid, emptyLessonDocument());
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
            <Button variant='ghost' size='xs' className='text-rose-600 dark:text-rose-300' onClick={() => setDeleting(row.original)}>
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // handleTogglePublic only closes over `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [togglingId, user],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
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
            <p className='text-xs text-muted-foreground'>Your lessons · click one to open the editor</p>
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

      <p className='px-6 py-3 text-xs text-muted-foreground'>{status === 'ready' ? `${rows.length} lesson(s)` : status === 'error' ? 'Failed to load lessons' : 'Loading lessons…'}</p>
      <DataTable
        table={table}
        narrowColumns={NARROW_COLUMNS}
        rightAlignedColumns={RIGHT_ALIGNED_COLUMNS}
        emptyMessage={status === 'error' ? 'Could not read Firestore. Check sign-in and rules.' : status === 'loading' ? 'Loading…' : 'No lessons yet — create your first one with “New lesson”.'}
      />
      <DataTableFooter table={table} />

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
