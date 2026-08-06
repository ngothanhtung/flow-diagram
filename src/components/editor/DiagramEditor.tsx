'use client';

import { Boxes, Copy, Globe, LoaderCircle, LockKeyhole, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { ShareDialog } from '@/components/diagrams/ShareDialog';
import { EditorFileMenu, EditorStatusScreen, FileMenuItem, ResetCanvasDialog, SaveButton, downloadDocumentJson } from '@/components/editor/EditorChrome';
import { EditorShell } from '@/components/editor/EditorShell';
import { TemplatePickerDialog, useTemplateLibrary } from '@/components/editor/TemplatePickerDialog';
import { getDiagramTemplate } from '@/lib/diagram-templates';
import { useEditorStore } from '@/lib/editor-store';
import { createDiagram, loadDiagram, saveDiagram } from '@/lib/firebase/diagrams';
import { saveEditorSession } from '@/lib/editor-session';

/** Inline editor for the diagram name in the header. Click to edit,
 *  Enter or blur commits, Escape cancels. */
function DiagramName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <input
        autoFocus
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
        className='w-56 rounded-md border border-sky-400/40 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/15'
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
      className='-mx-1 rounded px-1 text-xs text-zinc-400 transition hover:bg-white/6 hover:text-zinc-200'
    >
      {name}
    </button>
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
  const templateId = useEditorStore((state) => state.templateId);
  const loadedTemplate = useEditorStore((state) => state.loadedTemplate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const currentDiagramId = useEditorStore((state) => state.currentDiagramId);
  // A session that already restored this exact diagram (unsaved edits
  // included) is ready as soon as the store hydrates — no Firestore fetch.
  const effectiveStatus = hydrated && currentDiagramId === diagramId ? 'ready' : status;
  const currentDiagramName = useEditorStore((state) => state.currentDiagramName);
  const currentDiagramPublic = useEditorStore((state) => state.currentDiagramPublic);
  const savedSignature = useEditorStore((state) => state.savedSignature);
  const savingDiagram = useEditorStore((state) => state.savingDiagram);
  const { renameDiagram, setDiagramPublic, markDiagramSaved, loadStoredDiagram, setSavingDiagram } = useEditorStore();

  const templateItems = useTemplateLibrary();

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [savingAs, setSavingAs] = useState(false);

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
    saveEditorSession(user.uid, { doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature });
  }, [doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature, user]);
  const currentTemplate = useMemo(() => loadedTemplate ?? getDiagramTemplate(templateId), [loadedTemplate, templateId]);

  const handleSaveDiagram = useCallback(async () => {
    if (!user) return;
    const nextName = currentDiagramName.trim();
    if (!nextName) {
      toast.error('Please name the diagram');
      return;
    }
    setSavingDiagram(true);
    try {
      await saveDiagram(user.uid, diagramId, nextName, doc, currentDiagramPublic);
      markDiagramSaved(diagramId, nextName, doc);
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
      const id = await createDiagram(user.uid, 'Untitled diagram', { nodes: [], edges: [] }, false);
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
      const id = await createDiagram(user.uid, nextName, doc, false);
      toast.success('Saved as a new diagram', { description: nextName });
      router.push(`/diagrams/${id}/edit`);
    } catch {
      toast.error('Could not save as a new diagram', { description: 'Check sign-in and Firestore rules.' });
    } finally {
      setSavingAs(false);
    }
  }, [user, currentDiagramName, doc, router]);

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
      icon={<Boxes size={18} className='text-sky-300' />}
      subtitle={<DiagramName name={currentDiagramName} onRename={renameDiagram} />}
      fileMenu={
        <EditorFileMenu
          onNew={() => void handleNewDiagram()}
          onNewFromTemplate={() => setTemplatesDialogOpen(true)}
          openHref='/'
          onExport={() => downloadDocumentJson(doc, currentDiagramName.trim() || 'diagram')}
          onReset={() => setResetConfirmOpen(true)}
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
            variant='outline'
            onClick={() => setDiagramPublic(!currentDiagramPublic)}
            aria-pressed={currentDiagramPublic}
            title={currentDiagramPublic ? 'Public — anyone signed in can view via /diagrams/{id}/view' : 'Private — only you and administrators can view'}
            className={['h-9 gap-1.5 border-white/10 bg-black/25 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/8 dark:border-white/10 dark:bg-input/30 dark:hover:bg-input/50', currentDiagramPublic ? 'text-emerald-300' : ''].join(' ')}
          >
            {currentDiagramPublic ? <Globe size={13} className='text-emerald-300' /> : <LockKeyhole size={13} />}
            {currentDiagramPublic ? 'Public' : 'Private'}
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
      <ShareDialog diagramId={diagramId} isPublic={currentDiagramPublic} open={shareOpen} onOpenChange={setShareOpen} />
      <TemplatePickerDialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen} items={templateItems} />
    </EditorShell>
  );
}
