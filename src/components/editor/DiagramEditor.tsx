'use client';

import { Boxes, Copy, Globe, History, LoaderCircle, LockKeyhole, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { ShareDialog } from '@/components/diagrams/ShareDialog';
import { ConvertColorThemeDialog, EditorFileMenu, EditorStatusScreen, FileMenuItem, ResetCanvasDialog, SaveButton, downloadDocumentJson } from '@/components/editor/EditorChrome';
import { EditorShell } from '@/components/editor/EditorShell';
import { SqlExportDialog } from '@/components/editor/SqlExportDialog';
import { MermaidImportDialog } from '@/components/editor/MermaidImportDialog';
import { StarterPickerDialog } from '@/components/editor/StarterPickerDialog';
import { TemplatePickerDialog, useTemplateLibrary } from '@/components/editor/TemplatePickerDialog';
import { VersionHistorySheet } from '@/components/editor/VersionHistory';
import { formatDateTime } from '@/components/data-table';
import { sameDiagramContent, useEditorStore } from '@/lib/editor-store';
import { createDiagram, loadDiagram, saveDiagram } from '@/lib/firebase/diagrams';
import type { StoredVersion } from '@/lib/firebase/versions';
import { saveEditorSession } from '@/lib/editor-session';
import { normalizeDocument } from '@/lib/document-validation';
import { actorOf, savedByLabel, versionLabel } from '@/lib/version-history';

/** Inline editor for the diagram name in the header. Click to edit,
 *  Enter or blur commits, Escape cancels. */
function DiagramName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <Input
        autoFocus
        variant='toolbar'
        value={draft}
        maxLength={80}
        aria-label='Diagram name'
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => {
          setEditing(false);
          const next = draft.trim();
          if (next && next !== name) onRename(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          if (event.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        className='h-6 w-40 border-sky-400/40 px-1.5 py-0.5 text-xs sm:w-56'
      />
    );
  }

  return (
    <button
      type='button'
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title='Rename diagram'
      className='-mx-1 max-w-40 truncate rounded px-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground sm:max-w-none'
    >
      {name}
    </button>
  );
}

/** "Last saved by … at …" beside the diagram name — who performed the
 *  last Save (a Collaborator, once Share lands) and when. Hidden on narrow
 *  headers, where the name alone has to fit. */
function LastSavedNote({ currentUid }: { currentUid: string }) {
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const lastSavedBy = useEditorStore((state) => state.lastSavedBy);
  if (lastSavedAt === null) return null;
  const when = formatDateTime(lastSavedAt);
  return (
    <span className='hidden truncate text-[11px] text-muted-foreground lg:inline' data-testid='last-saved'>
      {lastSavedBy ? `Last saved by ${savedByLabel(lastSavedBy, currentUid)} at ${when}` : `Last saved at ${when}`}
    </span>
  );
}

/**
 * Full editor for one diagram at `/diagrams/{id}/edit`. The document is
 * fetched from `users/{uid}/diagrams/{id}` — only the owner can open it
 * here (the read goes through their own uid path). If a session with
 * the same diagram id is restored first, its unsaved edits are kept.
 */
export function DiagramEditor({ diagramId }: { diagramId: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'not-found' | 'error'>('loading');

  // All global editor state lives in the zustand store. Hydrate from the
  // localStorage session exactly once. This has to run in a layout effect
  // rather than directly in the render body — mutating the store mid-render
  // trips React's "setState while rendering a different component" guard.
  // A layout effect still resolves before paint, so this never causes a
  // visible flash.
  useLayoutEffect(() => {
    if (!user) return;
    const state = useEditorStore.getState();
    if (!state.hydrated) state.hydrate(user.uid);
  }, [user]);

  const doc = useEditorStore((state) => state.doc);
  const loadedTemplate = useEditorStore((state) => state.loadedTemplate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const currentDiagramId = useEditorStore((state) => state.currentDiagramId);
  // A session that already restored this exact diagram (unsaved edits
  // included) is ready as soon as the store hydrates — no Firestore fetch.
  const effectiveStatus = hydrated && currentDiagramId === diagramId ? 'ready' : status;
  const currentDiagramName = useEditorStore((state) => state.currentDiagramName);
  const currentDiagramPublic = useEditorStore((state) => state.currentDiagramPublic);
  const savedSignature = useEditorStore((state) => state.savedSignature);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const lastSavedBy = useEditorStore((state) => state.lastSavedBy);
  const savingDiagram = useEditorStore((state) => state.savingDiagram);
  const { renameDiagram, setDiagramPublic, markDiagramSaved, loadStoredDiagram, setSavingDiagram } = useEditorStore();

  const templateItems = useTemplateLibrary();

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [convertThemeConfirmOpen, setConvertThemeConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [starterOpen, setStarterOpen] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [savingAs, setSavingAs] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load the route's diagram into the store — unless the session already
  // restored this exact diagram, in which case unsaved edits are kept.
  useEffect(() => {
    if (!user) return;
    const state = useEditorStore.getState();
    if (state.hydrated && state.currentDiagramId === diagramId) return;
    let cancelled = false;
    loadDiagram(user.uid, diagramId)
      .then((diagram) => {
        if (cancelled) return;
        if (!diagram) {
          setStatus('not-found');
          return;
        }
        loadStoredDiagram(diagram);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [diagramId, user, loadStoredDiagram]);

  const documentSignature = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = savedSignature !== documentSignature;

  useEffect(() => {
    if (!user) return;
    saveEditorSession(user.uid, { doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature, lastSavedAt, lastSavedBy });
  }, [doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature, lastSavedAt, lastSavedBy, user]);
  const currentTemplate = loadedTemplate ?? {
    category: 'Saved diagram',
    name: currentDiagramName,
    description: '',
  };

  const handleSaveDiagram = useCallback(async () => {
    if (!user) return;
    const nextName = currentDiagramName.trim();
    if (!nextName) {
      toast.error('Please name the diagram');
      return;
    }
    setSavingDiagram(true);
    try {
      const actor = actorOf(user);
      await saveDiagram(user.uid, diagramId, nextName, doc, currentDiagramPublic, actor);
      markDiagramSaved(diagramId, nextName, doc, actor, Date.now());
      toast.success('Diagram saved', { description: nextName });
    } catch {
      toast.error('Could not save diagram', {
        description: 'You need to be signed in with write access for this UID.',
      });
    } finally {
      setSavingDiagram(false);
    }
  }, [user, diagramId, currentDiagramName, currentDiagramPublic, doc, markDiagramSaved, setSavingDiagram]);

  const handleNewDiagram = useCallback(async () => {
    if (!user) return;
    try {
      const id = await createDiagram(user.uid, 'Untitled diagram', { nodes: [], edges: [] }, false, actorOf(user));
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not create diagram', { description: 'Check sign-in and Firestore rules.' });
    }
  }, [user, router]);

  const handleSaveAs = useCallback(async () => {
    if (!user) return;
    const nextName = `${currentDiagramName.trim() || 'Untitled diagram'} copy`;
    setSavingAs(true);
    try {
      const id = await createDiagram(user.uid, nextName, doc, false, actorOf(user));
      toast.success('Saved as a new diagram', { description: nextName });
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not save as a new diagram', { description: 'Check sign-in and Firestore rules.' });
    } finally {
      setSavingAs(false);
    }
  }, [user, currentDiagramName, doc, router]);

  // Restore: the Version's document becomes an unsaved change on the
  // canvas — one undo step (the store's `restoreVersion`). Nothing is
  // written; the next Save makes it the main copy and a new Version.
  const handleRestoreVersion = useCallback((version: StoredVersion) => {
    setHistoryOpen(false);
    const label = versionLabel(version);
    if (sameDiagramContent(useEditorStore.getState().doc, normalizeDocument(version.document).document)) {
      toast('Already on the canvas', { description: `${label} matches what you are editing.` });
      return;
    }
    useEditorStore.getState().restoreVersion(version.document);
    toast.success('Version restored — not saved yet', { description: `${label}. Save to keep it, or Undo to go back.` });
  }, []);

  // A copy owned by whoever does it (with its own first Version); the
  // open diagram is untouched. Offered rather than opened, so unsaved
  // work here isn't swapped out from under the user.
  const handleVersionSaveAsNew = useCallback(
    async (version: StoredVersion) => {
      if (!user) return;
      const name = `${currentDiagramName.trim() || 'Untitled diagram'} (${versionLabel(version)})`;
      try {
        const id = await createDiagram(user.uid, name, version.document, false, actorOf(user));
        toast.success('Saved as a new diagram', {
          description: name,
          action: { label: 'Open', onClick: () => router.push(`/diagrams/${id}/edit`) },
        });
      } catch (error) {
        console.error('Could not save version as a new diagram', error);
        toast.error('Could not save as a new diagram', { description: 'Check sign-in and Firestore rules.' });
      }
    },
    [user, currentDiagramName, router],
  );

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;

  if (effectiveStatus !== 'ready') {
    return (
      <EditorStatusScreen
        fullScreen
        loading={status === 'loading'}
        title={status === 'loading' ? 'Loading diagram…' : status === 'not-found' ? 'Diagram not found' : 'Could not load diagram'}
        description={status === 'loading' ? `Opening ${diagramId}.` : status === 'not-found' ? 'You do not have a diagram with this id. Only the owner can edit a diagram.' : 'Check your connection and try again.'}
        backHref='/'
        backLabel='Back to diagrams'
      />
    );
  }

  return (
    <EditorShell
      fullScreen
      document={doc}
      onSave={() => void handleSaveDiagram()}
      icon={<Boxes size={18} className='text-sky-300' />}
      subtitle={
        <div className='flex min-w-0 items-baseline gap-2'>
          <DiagramName name={currentDiagramName} onRename={renameDiagram} />
          <LastSavedNote currentUid={user.uid} />
        </div>
      }
      fileMenu={
        <EditorFileMenu
          onNew={() => void handleNewDiagram()}
          onNewFromTemplate={() => setTemplatesDialogOpen(true)}
          onStartFrom={() => setStarterOpen(true)}
          onImportMermaid={() => setMermaidOpen(true)}
          openHref='/'
          onExport={() => downloadDocumentJson(doc, currentDiagramName.trim() || 'diagram')}
          onExportSql={() => setSqlOpen(true)}
          onConvertColorTheme={() => setConvertThemeConfirmOpen(true)}
          onReset={() => setResetConfirmOpen(true)}
          imageName={currentDiagramName.trim() || 'diagram'}
          afterOpen={
            <FileMenuItem icon={savingAs ? <LoaderCircle size={14} className='animate-spin' /> : <Copy size={14} />} disabled={savingAs} onClick={() => void handleSaveAs()}>
              Save as
            </FileMenuItem>
          }
          afterExport={
            <FileMenuItem icon={<Share2 size={14} />} tone='accent' disabled={!currentDiagramPublic} onClick={() => setShareOpen(true)}>
              Share
            </FileMenuItem>
          }
        />
      }
      actions={
        <>
          <Button
            variant='toolbar'
            size='lg'
            onClick={() => setDiagramPublic(!currentDiagramPublic)}
            aria-pressed={currentDiagramPublic}
            title={currentDiagramPublic ? 'Public — anyone signed in can view via /diagrams/{id}/view' : 'Private — only you and administrators can view'}
            className={currentDiagramPublic ? 'text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200' : ''}
          >
            {currentDiagramPublic ? <Globe size={13} className='text-emerald-700 dark:text-emerald-300' /> : <LockKeyhole size={13} />}
            {currentDiagramPublic ? 'Public' : 'Private'}
          </Button>
          <Button variant='toolbar' size='lg' onClick={() => setHistoryOpen(true)} title='Version history — every Save, newest first' aria-label='Version history'>
            <History size={13} />
            <span className='hidden sm:inline'>History</span>
          </Button>
          <SaveButton saving={savingDiagram} dirty={dirty} onSave={() => void handleSaveDiagram()} />
        </>
      }
      headerEnd={<UserMenu user={user} />}
      info={{
        category: currentTemplate.category,
        title: currentTemplate.name,
        description: currentTemplate.description,
        note: 'Choose another model from the library to replace the canvas. Every template remains fully editable: resize blocks, change shapes, reconnect nodes and customize line effects.',
      }}
      inspectorLabel='Editor inspector'
    >
      <ResetCanvasDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen} />
      <ConvertColorThemeDialog open={convertThemeConfirmOpen} onOpenChange={setConvertThemeConfirmOpen} />
      <ShareDialog diagramId={diagramId} isPublic={currentDiagramPublic} open={shareOpen} onOpenChange={setShareOpen} />
      <TemplatePickerDialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen} items={templateItems} />
      <StarterPickerDialog open={starterOpen} onOpenChange={setStarterOpen} />
      <MermaidImportDialog open={mermaidOpen} onOpenChange={setMermaidOpen} />
      <SqlExportDialog document={doc} filename={currentDiagramName.trim() || 'diagram'} open={sqlOpen} onOpenChange={setSqlOpen} />
      {/* Owner = the signed-in user until Share (T7) resolves it through the access index. */}
      <VersionHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        ownerUid={user.uid}
        diagramId={diagramId}
        currentUid={user.uid}
        onRestore={handleRestoreVersion}
        onSaveAsNew={handleVersionSaveAsNew}
      />
    </EditorShell>
  );
}
