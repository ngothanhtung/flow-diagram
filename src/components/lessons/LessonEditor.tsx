'use client';

import { Check, Copy, FileUp, Globe, GraduationCap, Info, LoaderCircle, LockKeyhole, Play, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthLoadingScreen } from '@/components/auth/LoginForm';
import { UserMenu } from '@/components/auth/UserMenu';
import { ConvertColorThemeDialog, EditorFileMenu, EditorStatusScreen, FileMenuItem, InlineNameField, SaveButton, downloadDocumentJson } from '@/components/editor/EditorChrome';
import { EditorShell } from '@/components/editor/EditorShell';
import { SqlExportDialog } from '@/components/editor/SqlExportDialog';
import { LessonImportDialog } from '@/components/lessons/LessonImportDialog';
import { LessonInfoDialog } from '@/components/lessons/LessonInfoDialog';
import { LessonPlayer } from '@/components/lessons/LessonPlayer';
import { LessonSidePanel } from '@/components/lessons/LessonSidePanel';
import { LessonStepBar } from '@/components/lessons/LessonStepBar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { lessonDocumentOf, useEditorStore } from '@/lib/editor-store';
import { createLesson, loadLesson, saveLesson, setLessonPublic } from '@/lib/firebase/lessons';
import { updateMeta } from '@/lib/lesson/lesson-edit';
import { normalizeLessonDocument } from '@/lib/lesson/lesson-normalize';
import { lessonRestoreChoice, loadLessonSession, saveLessonSession } from '@/lib/lesson/lesson-session';
import { resolveStepView, stepExportDocument } from '@/lib/lesson/lesson-step-view';
import { emptyLessonDocument, lessonNameOf, type LessonDocumentJSON } from '@/lib/lesson/lesson-types';

type Status = 'loading' | 'ready' | 'not-found' | 'invalid' | 'error';

/** Save failures that the connection message would misdescribe. */
const SAVE_ERROR_COPY: Record<string, string> = {
  'not-found': 'This lesson no longer exists.',
  'invalid-argument': "This lesson can't be saved: it contains an invalid id or is too large.",
  'permission-denied': "You don't have permission to save this lesson.",
};

const STATUS_COPY: Record<Exclude<Status, 'ready'>, [string, string]> = {
  loading: ['Loading lesson…', 'Opening the lesson.'],
  'not-found': ['Lesson not found', 'No lesson of yours has this id.'],
  invalid: ["This lesson can't be opened", 'Its content is damaged and could not be repaired.'],
  error: ['Could not load lesson', 'Check your connection and try again.'],
};

/** Header control for the lesson's Public link: the switch applies at
 *  once (`setLessonPublic`), and publishes what is saved, not the canvas. */
function LessonPublicControl({ uid, lessonId, isPublic, dirty, onChange }: { uid: string; lessonId: string; isPublic: boolean; dirty: boolean; onChange: (isPublic: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggle = async () => {
    const next = !isPublic;
    setPending(true);
    try {
      await setLessonPublic(uid, lessonId, next);
      onChange(next);
      toast.success(next ? 'Public link is on' : 'Public link is off', {
        description: next ? 'It shows the last saved version.' : 'The Public link no longer opens this lesson.',
      });
    } catch (error) {
      console.error('Could not change the Public link', error);
      toast.error(next ? 'Could not turn the Public link on' : 'Could not turn the Public link off', { description: 'Check your connection and try again.' });
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lessons/${lessonId}/view`);
      setCopied(true);
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Popover onOpenChange={(open) => !open && setCopied(false)}>
      <PopoverTrigger
        render={<Button variant='toolbar' size='lg' />}
        title={isPublic ? 'The Public link is on' : 'Turn on the Public link'}
        className={isPublic ? 'text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200' : ''}
      >
        {isPublic ? <Globe size={13} className='text-emerald-700 dark:text-emerald-300' /> : <LockKeyhole size={13} />}
        {isPublic ? 'Public' : 'Private'}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80 border border-border bg-popover p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='flex items-center gap-1.5 text-xs font-semibold text-foreground'>
              {isPublic ? <Globe size={13} className='text-emerald-700 dark:text-emerald-300' /> : <LockKeyhole size={13} className='text-muted-foreground' />}
              Public link
            </h3>
            <p className='mt-1 text-[11px] leading-5 text-muted-foreground'>{isPublic ? 'On — anyone with the link can view this lesson, without signing in.' : 'Off — only you can open this lesson.'}</p>
          </div>
          <button
            type='button'
            role='switch'
            aria-checked={isPublic}
            aria-label='Public link'
            disabled={pending}
            onClick={() => void toggle()}
            className={[
              'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              isPublic ? 'bg-emerald-500 ring-emerald-500/60' : 'bg-muted ring-border',
            ].join(' ')}
          >
            <span className={['inline-block size-4 rounded-full bg-background shadow transition-transform', isPublic ? 'translate-x-4.5' : 'translate-x-0.5'].join(' ')} />
            {pending && <LoaderCircle size={10} className='absolute inset-0 m-auto animate-spin text-foreground' />}
          </button>
        </div>
        <p className='text-[11px] leading-5 text-muted-foreground' data-testid='public-note'>
          The Public link shows the last saved version.
          {isPublic && dirty && <span className='font-semibold text-amber-700 dark:text-amber-300'> You have unsaved changes — Save to publish them.</span>}
        </p>
        {isPublic && (
          <Button variant='accent' size='sm' className='h-8 self-start' onClick={() => void copyLink()}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The Lesson editor at `/lessons/{id}/edit`: the Diagram editor's shell
 * around a Lesson — the canvas shows the selected Lesson step, the bottom
 * bar picks and arranges Lesson steps. Opens the local session copy when
 * it is this Lesson with unsaved changes, else the server's (both through
 * `normalizeLessonDocument`); either way the Public flag comes from the
 * server, and Save re-reads it (`saveLesson`). The name in the header is
 * the Lesson's `meta.title` (a rename is an undoable edit). Its own localStorage session
 * (`lesson-session.ts`) never touches the Diagram editor's; leaving calls
 * `closeLesson()`, so a Diagram editor mounted next restores its own.
 */
export function LessonEditor({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const router = useRouter();

  const [status, setStatus] = useState<Status>('loading');
  const [isPublic, setIsPublic] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [convertThemeOpen, setConvertThemeOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Open the route's Lesson. A layout effect, like the Diagram editor's
  // hydrate: the store write happens before paint, never during render.
  useLayoutEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const open = (document: LessonDocumentJSON, opened: { isPublic: boolean; savedSignature?: string | null }) => {
      const store = useEditorStore.getState();
      store.openLesson(document);
      setIsPublic(opened.isPublic);
      // A fresh open is clean: the signature is the document exactly as the
      // store rebuilds it, so key order can't make it read dirty.
      setSavedSignature(opened.savedSignature !== undefined ? opened.savedSignature : JSON.stringify(lessonDocumentOf(useEditorStore.getState())));
      setStatus('ready');
    };

    const session = loadLessonSession(uid);
    let local: LessonDocumentJSON | null = null;
    if (session && lessonRestoreChoice(session, lessonId) === 'local') {
      const result = normalizeLessonDocument(session.document);
      if (result.ok) local = result.lesson;
      else console.warn('Ignoring a damaged local copy of this lesson', result.error);
    }

    // The server is read on both paths. A local copy with unsaved changes
    // keeps its content, but its Public flag and the Lesson's existence come
    // from the server: the flag may have been turned off in the list since.
    loadLesson(uid, lessonId)
      .then((stored) => {
        if (cancelled) return;
        if (local && session) {
          if (!stored) {
            toast.error('This lesson no longer exists', { description: 'Showing your unsaved local copy. Export it to JSON to keep your changes.', duration: Infinity });
            return open(local, { isPublic: false, savedSignature: session.savedSignature });
          }
          return open(local, { isPublic: stored.public === true, savedSignature: session.savedSignature });
        }
        if (!stored) return setStatus('not-found');
        const result = normalizeLessonDocument(stored.document);
        if (!result.ok) return setStatus('invalid');
        open(result.lesson, { isPublic: stored.public === true });
      })
      .catch((error: unknown) => {
        console.error('Could not open lesson', error);
        if (cancelled) return;
        // Unreachable: the local copy still opens (Save re-reads the server flag).
        if (local && session) open(local, { isPublic: session.isPublic, savedSignature: session.savedSignature });
        else setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, lessonId]);

  // Leaving the Lesson editor drops the Lesson from the shared store. A
  // layout-effect cleanup, not a passive one: a removed component's layout
  // cleanups run before the next tree's layout effects, so the Diagram
  // editor's hydrate (or the next Lesson's open) always comes after this
  // close, never before it. Strict Mode's simulated unmount closes too, and
  // the open effect above (declared first) reopens on its re-run.
  useLayoutEffect(() => () => useEditorStore.getState().closeLesson(), []);

  const doc = useEditorStore((state) => state.doc);
  const lesson = useEditorStore((state) => state.lesson);
  const lessonStepId = useEditorStore((state) => state.lessonStepId);

  const lessonDocument = useMemo(() => lessonDocumentOf({ doc, lesson }), [doc, lesson]);
  const signature = useMemo(() => (lessonDocument ? JSON.stringify(lessonDocument) : null), [lessonDocument]);
  const dirty = signature !== savedSignature;
  const view = useMemo(() => (lesson ? resolveStepView(doc, lesson, lessonStepId ?? '', 'editor') : null), [doc, lesson, lessonStepId]);
  const imageDocument = useMemo(() => (view ? stepExportDocument(view) : undefined), [view]);

  // Local autosave of everything a refresh needs, on every change.
  useEffect(() => {
    if (!uid || status !== 'ready' || !lessonDocument) return;
    saveLessonSession(uid, { lessonId, name: lessonNameOf(lessonDocument), isPublic, savedSignature, document: lessonDocument });
  }, [uid, status, lessonId, isPublic, savedSignature, lessonDocument]);

  useEffect(() => {
    if (!dirty || status !== 'ready') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, status]);

  const handleSave = useCallback(async () => {
    if (!uid || saving) return;
    const document = lessonDocumentOf(useEditorStore.getState());
    if (!document) return;
    setSaving(true);
    try {
      const result = await saveLesson(uid, lessonId, document);
      if (result.status === 'missing') {
        toast.error('Could not save lesson', { description: SAVE_ERROR_COPY['not-found'] });
        return;
      }
      setSavedSignature(JSON.stringify(document));
      setIsPublic(result.isPublic);
      toast.success('Lesson saved', { description: lessonNameOf(document) });
    } catch (error) {
      console.error('Could not save lesson', error);
      const code = (error as { code?: unknown } | null)?.code;
      toast.error('Could not save lesson', { description: (typeof code === 'string' && Object.hasOwn(SAVE_ERROR_COPY, code) && SAVE_ERROR_COPY[code]) || 'Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  }, [uid, saving, lessonId]);

  const focusOnMount = useCallback((node: HTMLDivElement | null) => node?.focus(), []);

  const createAndOpen = useCallback(async () => {
    if (!uid) return;
    setCreating(true);
    try {
      const id = await createLesson(uid, emptyLessonDocument());
      router.push(`/lessons/${id}/edit`);
    } catch (error) {
      console.error('Could not create lesson', error);
      toast.error('Could not create lesson', { description: 'Check your connection and try again.' });
    } finally {
      setCreating(false);
    }
  }, [uid, router]);

  if (!user) return <AuthLoadingScreen />;

  if (status !== 'ready' || !lesson || !view || !lessonDocument) {
    const [title, description] = STATUS_COPY[status === 'ready' ? 'loading' : status];
    return <EditorStatusScreen fullScreen loading={status === 'loading' || status === 'ready'} title={title} description={description} backHref='/lessons' backLabel='Back to lessons' />;
  }

  const name = lessonNameOf(lessonDocument);
  const fileName = name;

  return (
    <EditorShell
      fullScreen
      document={doc}
      onSave={() => void handleSave()}
      icon={<GraduationCap size={18} className='text-sky-300' />}
      subtitle={<InlineNameField name={name} onRename={(title) => useEditorStore.getState().editLesson((c) => updateMeta(c, { title }))} label='Lesson name' title='Rename lesson' />}
      fileMenu={
        <EditorFileMenu
          onNew={() => (dirty ? setConfirmNewOpen(true) : void createAndOpen())}
          newDisabled={creating}
          openHref='/lessons'
          onExport={() => downloadDocumentJson(lessonDocument, fileName, '.lesson.json')}
          exportLabel='Export lesson to JSON'
          onExportSql={() => setSqlOpen(true)}
          onConvertColorTheme={() => setConvertThemeOpen(true)}
          imageName={fileName}
          imageDocument={imageDocument}
          afterOpen={
            <FileMenuItem icon={<FileUp size={14} />} onClick={() => setImportOpen(true)}>
              Import JSON…
            </FileMenuItem>
          }
        />
      }
      actions={
        <>
          <Button variant='toolbar' size='lg' onClick={() => setInfoOpen(true)} title='Title, summary, metrics and goals'>
            <Info size={13} />
            Lesson info
          </Button>
          <Button variant='toolbar' size='lg' onClick={() => setPreviewOpen(true)} title='Play this lesson as a learner sees it'>
            <Play size={13} />
            Preview
          </Button>
          <LessonPublicControl uid={user.uid} lessonId={lessonId} isPublic={isPublic} dirty={dirty} onChange={setIsPublic} />
          <SaveButton saving={saving} dirty={dirty} onSave={() => void handleSave()} />
        </>
      }
      headerEnd={<UserMenu user={user} />}
      info={{
        category: 'Lesson',
        title: name,
        description: lesson.meta.summary,
        note: 'The canvas shows the selected lesson step. Elements outside it are faded; hover one to see when it appears.',
      }}
      inspectorLabel='Lesson inspector'
      lesson={{
        canvasDocument: view.document,
        looks: view.looks,
        hints: view.hints,
        leftPanel: <LessonSidePanel />,
        footer: <LessonStepBar />,
      }}
    >
      <LessonImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {/* A modal dialog: the editor's shortcuts stay inert underneath
          (`contextOf` sees an open [role=dialog][aria-modal=true]). Mounted
          only while open, so the player's visited set starts fresh. Focus moves
          in on open: a focused editor button (the File menu trigger…)
          would otherwise keep the arrow keys for itself. */}
      {previewOpen && (
        <div ref={focusOnMount} tabIndex={-1} role='dialog' aria-modal='true' aria-label='Lesson preview' className='fixed inset-0 z-50 bg-background outline-none'>
          <LessonPlayer lesson={lessonDocument} initialStepId={lessonStepId ?? undefined} onClose={() => setPreviewOpen(false)} />
        </div>
      )}
      <LessonInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
      <ConvertColorThemeDialog open={convertThemeOpen} onOpenChange={setConvertThemeOpen} />
      <SqlExportDialog document={doc} filename={fileName} open={sqlOpen} onOpenChange={setSqlOpen} />
      <AlertDialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <AlertDialogContent className='border border-border bg-popover'>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-amber-400/10 text-amber-700 dark:text-amber-300'>
              <TriangleAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Leave unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>This lesson has changes that are not saved. A new lesson replaces it here, and those changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                // Base UI action buttons don't auto-close with a custom onClick.
                setConfirmNewOpen(false);
                void createAndOpen();
              }}
            >
              New lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorShell>
  );
}
