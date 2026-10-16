'use client';

import { FirebaseError } from 'firebase/app';
import { Boxes, CloudOff, Copy, Download, Globe, History, LoaderCircle, LockKeyhole, Share2, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserMenu } from '@/components/auth/UserMenu';
import { ShareDialog } from '@/components/diagrams/ShareDialog';
import { SaveConflictDialog, type BlockedSave } from '@/components/editor/SaveConflictDialog';
import { ConvertColorThemeDialog, EditorFileMenu, EditorStatusScreen, FileMenuItem, ResetCanvasDialog, SaveButton, downloadDocumentJson } from '@/components/editor/EditorChrome';
import { EditorShell } from '@/components/editor/EditorShell';
import { SqlExportDialog } from '@/components/editor/SqlExportDialog';
import { MermaidImportDialog } from '@/components/editor/MermaidImportDialog';
import { StarterPickerDialog } from '@/components/editor/StarterPickerDialog';
import { TemplatePickerDialog, useTemplateLibrary } from '@/components/editor/TemplatePickerDialog';
import { VersionHistorySheet } from '@/components/editor/VersionHistory';
import { formatDateTime } from '@/components/data-table';
import { sameDiagramContent, selectCanUndo, useEditorStore } from '@/lib/editor-store';
import { createDiagram, loadDiagram, openDiagram, saveDiagram } from '@/lib/firebase/diagrams';
import { ACCESS_LEVEL_LABELS, permissionsOf, revisionOf, routeForRole } from '@/lib/sharing';
import { LOCAL_COPY_FALLBACK_MS, localCopyOf, restoreDecision, type LocalCopy, type ServerCheck } from '@/lib/session-restore';
import type { StoredVersion } from '@/lib/firebase/versions';
import { saveEditorSession } from '@/lib/editor-session';
import { normalizeDocument } from '@/lib/document-validation';
import { actorOf, savedByLabel, versionLabel, type VersionActor } from '@/lib/version-history';

const STATUS_TITLES = {
  loading: 'Loading diagram…',
  redirecting: 'Opening the Viewer…',
  'not-found': 'Diagram not found',
  unverified: 'Diagram not found',
  error: 'Could not load diagram',
} as const;

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

/** "Can edit · shared by …" in place of the Owner's Share button. */
function CollaboratorBadge({ ownerEmail }: { ownerEmail: string | null }) {
  return (
    <span
      className='inline-flex h-9 items-center gap-1.5 rounded-md bg-violet-500/10 px-2.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-400/30 dark:text-violet-200'
      title={`${ACCESS_LEVEL_LABELS.edit} — shared with you${ownerEmail ? ` by ${ownerEmail}` : ''}. Only the Owner can Share, make it Public or delete it.`}
      data-testid='collaborator-badge'
    >
      <Users size={13} />
      <span className='hidden sm:inline'>{ACCESS_LEVEL_LABELS.edit}</span>
      {ownerEmail && <span className='hidden max-w-40 truncate font-normal text-muted-foreground xl:inline'>· {ownerEmail}</span>}
    </span>
  );
}

function isPermissionDenied(error: unknown) {
  return error instanceof FirebaseError && error.code === 'permission-denied';
}

/** `dirty` exactly as the header's Save dot reads it. */
function isDirty(state: { doc: unknown; savedSignature: string | null }) {
  return JSON.stringify(state.doc) !== state.savedSignature;
}

/** A Save someone made after the revision the open copy is based on. */
interface NewerSave {
  revision: number;
  lastSavedBy: VersionActor | null;
  lastSavedAt: number | null;
}

/** Strip under the header: someone saved this Diagram after the revision
 *  the restored (unsaved) copy is based on. Non-modal — editing goes on.
 *  Load latest is the Save conflict dialog's (one undo step); Keep mine
 *  just dismisses it, and the next Save still meets the conflict check. */
function NewerSaveBanner({ newer, currentUid, onLoadLatest, onKeepMine }: { newer: NewerSave; currentUid: string; onLoadLatest: () => Promise<void>; onKeepMine: () => void }) {
  const [busy, setBusy] = useState(false);
  const who = savedByLabel(newer.lastSavedBy, currentUid);
  const when = newer.lastSavedAt ? formatDateTime(newer.lastSavedAt) : null;
  return (
    <div role='status' className='flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-amber-400/10 px-3 py-2 sm:px-6' data-testid='newer-save-banner'>
      <Download size={14} className='shrink-0 text-amber-700 dark:text-amber-300' />
      <p className='min-w-0 flex-1 text-xs text-foreground'>
        <span className='font-semibold'>{who === 'You' ? 'You (in another tab or device)' : who}</span> saved a newer version of this Diagram
        {when ? (
          <>
            {' '}
            at <span className='font-semibold'>{when}</span>
          </>
        ) : null}
        . <span className='text-muted-foreground'>Your unsaved changes are still here.</span>
      </p>
      <div className='flex items-center gap-2'>
        <Button
          size='sm'
          variant='outline'
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onLoadLatest().finally(() => setBusy(false));
          }}
          title='Replace the canvas with the latest saved version. Undo brings your changes back.'
        >
          {busy ? <LoaderCircle size={13} className='animate-spin' /> : <Download size={13} />}
          Load latest
        </Button>
        <Button size='sm' variant='ghost' disabled={busy} onClick={onKeepMine} title='Keep editing your copy. Saving it will ask before replacing theirs.'>
          Keep mine
        </Button>
      </div>
    </div>
  );
}

/** Strip under the header: the server couldn't be reached on open, so
 *  the canvas is the copy kept in this browser. Never blocks editing. */
function LocalCopyNote({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role='status' className='flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground sm:px-6' data-testid='local-copy-note'>
      <CloudOff size={13} className='shrink-0' />
      <span className='min-w-0 flex-1'>Couldn’t reach the server — showing your last local copy of this Diagram.</span>
      <button type='button' onClick={onDismiss} className='grid size-5 place-items-center rounded transition hover:bg-accent hover:text-accent-foreground' aria-label='Dismiss'>
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * Full editor for one diagram at `/diagrams/{id}/edit`. The id resolves
 * through `openDiagram` (ADR 0001): the signed-in user's own Diagram if
 * they have one with that id — every link from before Share — else a
 * Diagram shared with them, read from its Owner's path. A Can view
 * Collaborator is sent to the Viewer. A copy of the same Diagram already
 * in the editor (the restored session) is replaced by the server's latest
 * when it has no unsaved changes; with unsaved changes it is kept (with its
 * owner, role and base revision) and only compared against the server —
 * see `lib/session-restore.ts`.
 */
export function DiagramEditor({ diagramId }: { diagramId: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'unverified' | 'redirecting' | 'error'>('loading');
  const [blockedSave, setBlockedSave] = useState<BlockedSave | null>(null);
  const [newerSave, setNewerSave] = useState<NewerSave | null>(null);
  const [localCopyNote, setLocalCopyNote] = useState(false);

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
  const canUndo = useEditorStore(selectCanUndo);
  const currentDiagramName = useEditorStore((state) => state.currentDiagramName);
  const currentDiagramPublic = useEditorStore((state) => state.currentDiagramPublic);
  const savedSignature = useEditorStore((state) => state.savedSignature);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const lastSavedBy = useEditorStore((state) => state.lastSavedBy);
  const currentDiagramOwnerUid = useEditorStore((state) => state.currentDiagramOwnerUid);
  const currentOwnerEmail = useEditorStore((state) => state.currentOwnerEmail);
  const currentRole = useEditorStore((state) => state.currentRole);
  const currentRevision = useEditorStore((state) => state.currentRevision);
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

  // Load the route's diagram into the store. A copy the editor already
  // holds (the restored session, or this page load's store) is decided by
  // `restoreDecision`: without local work the server's latest replaces it —
  // the loading screen stays up until the server answers, so stale content
  // never flashes — and with local work it stays on the canvas while the
  // server is only compared against it (banner / blocked dialog).
  useEffect(() => {
    if (!user) return;
    const before = useEditorStore.getState();
    const copy = localCopyOf({ holdsDiagram: before.hydrated && before.currentDiagramId === diagramId, dirty: isDirty(before), canUndo: selectCanUndo(before) });
    let cancelled = false;
    let answered = false;
    // A clean copy is shown anyway if the server is slow to answer
    // (offline); its answer is still applied when it lands.
    const fallback =
      copy === 'clean'
        ? setTimeout(() => {
            if (cancelled || answered) return;
            setStatus('ready');
            setLocalCopyNote(true);
          }, LOCAL_COPY_FALLBACK_MS)
        : undefined;

    openDiagram({ uid: user.uid, email: user.email, emailVerified: user.emailVerified }, diagramId)
      .then((opening): { check: ServerCheck; opening: typeof opening } => ({
        check: opening.role === null ? { kind: 'gone', reason: opening.reason } : { kind: 'opened', role: opening.role, revision: revisionOf(opening.diagram) },
        opening,
      }))
      .catch((error: unknown): { check: ServerCheck; opening: null } => {
        if (copy === 'none') console.error('Could not open diagram', error);
        else console.warn('Could not check the server copy of this diagram', error);
        return { check: isPermissionDenied(error) ? { kind: 'denied' } : { kind: 'unreachable' }, opening: null };
      })
      .then(({ check, opening }) => {
        answered = true;
        clearTimeout(fallback);
        if (cancelled) return;
        // Judged against the store *now*: after the fallback the user may
        // have started editing the local copy, which must then be kept.
        const now = useEditorStore.getState();
        const current: LocalCopy = copy === 'none' ? 'none' : localCopyOf({ holdsDiagram: now.currentDiagramId === diagramId, dirty: isDirty(now), canUndo: selectCanUndo(now) });
        const decision = restoreDecision({ copy: current, role: now.currentRole, revision: now.currentRevision }, check);
        switch (decision.action) {
          case 'load-latest':
            if (opening?.role) loadStoredDiagram(opening.diagram, { ownerUid: opening.ownerUid, ownerEmail: opening.ownerEmail, role: opening.role });
            setLocalCopyNote(false);
            setStatus('ready');
            return;
          case 'redirect-view':
            setStatus('redirecting');
            router.replace(routeForRole('view', diagramId));
            return;
          case 'status':
            setStatus(decision.status);
            return;
          case 'offer-latest':
            if (opening?.role) setNewerSave({ revision: revisionOf(opening.diagram), lastSavedBy: opening.diagram.lastSavedBy ?? null, lastSavedAt: opening.diagram.updatedAt?.toMillis() ?? null });
            break;
          case 'blocked':
            setBlockedSave({ kind: decision.kind });
            break;
          case 'local-copy':
            setLocalCopyNote(true);
            break;
          case 'keep':
            break;
        }
        setStatus('ready');
      })
      .catch((error: unknown) => {
        console.error('Could not open diagram', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [diagramId, user, loadStoredDiagram, router]);

  const ownerUid = currentDiagramOwnerUid ?? user?.uid ?? '';
  const permissions = permissionsOf(currentRole);

  const documentSignature = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = savedSignature !== documentSignature;
  // A copy with local work (the restored session's unsaved edits) is on
  // the canvas as soon as the store hydrates, while the server is asked in
  // the background; any other copy waits for the server (see the effect).
  const keepsLocalWork = hydrated && currentDiagramId === diagramId && localCopyOf({ holdsDiagram: true, dirty, canUndo }) === 'unsaved';
  const effectiveStatus = status === 'loading' && keepsLocalWork ? 'ready' : status;

  useEffect(() => {
    if (!user) return;
    saveEditorSession(user.uid, {
      doc,
      currentDiagramId,
      currentDiagramName,
      currentDiagramPublic,
      savedSignature,
      lastSavedAt,
      lastSavedBy,
      currentDiagramOwnerUid,
      currentOwnerEmail,
      currentRole,
      currentRevision,
    });
  }, [doc, currentDiagramId, currentDiagramName, currentDiagramPublic, savedSignature, lastSavedAt, lastSavedBy, currentDiagramOwnerUid, currentOwnerEmail, currentRole, currentRevision, user]);
  const currentTemplate = loadedTemplate ?? {
    category: 'Saved diagram',
    name: currentDiagramName,
    description: '',
  };

  // Save, through the Save conflict check (`saveDiagram` runs it in a
  // transaction). `baseRevision` overrides the loaded one for Overwrite:
  // the base becomes the revision the conflict dialog showed, so a third
  // Save landing meanwhile raises a fresh conflict instead of being
  // silently overwritten too.
  const handleSaveDiagram = useCallback(
    async (baseRevision?: number) => {
      if (!user) return;
      const nextName = currentDiagramName.trim();
      if (!nextName) {
        toast.error('Please name the diagram');
        return;
      }
      setSavingDiagram(true);
      try {
        const actor = actorOf(user);
        const result = await saveDiagram({
          ownerUid,
          diagramId,
          name: nextName,
          document: doc,
          actor,
          baseRevision: baseRevision ?? currentRevision,
          asOwner: currentRole === 'owner',
        });
        if (result.status === 'conflict') {
          setBlockedSave({ kind: 'conflict', revision: result.revision, lastSavedBy: result.lastSavedBy, lastSavedAt: result.lastSavedAt });
          return;
        }
        if (result.status === 'missing') {
          setBlockedSave({ kind: 'missing' });
          return;
        }
        markDiagramSaved(diagramId, nextName, doc, actor, Date.now(), result.revision);
        setLocalCopyNote(false);
        // The Share dialog (maybe in another tab) owns `public`; follow it.
        setDiagramPublic(result.isPublic);
        toast.success('Diagram saved', { description: nextName });
      } catch (error) {
        if (currentRole !== 'owner' && isPermissionDenied(error)) {
          setBlockedSave({ kind: 'revoked' });
          return;
        }
        console.error('Could not save diagram', error);
        toast.error('Could not save diagram', { description: 'Check your connection and try again.' });
      } finally {
        setSavingDiagram(false);
      }
    },
    [user, ownerUid, diagramId, currentDiagramName, currentRevision, currentRole, doc, markDiagramSaved, setDiagramPublic, setSavingDiagram],
  );

  // Save conflict → Load latest: the server's copy replaces the canvas as
  // one undo step (`loadLatestSaved`), so ⌘Z brings the user's edits back.
  const handleLoadLatest = useCallback(async () => {
    try {
      const latest = await loadDiagram(ownerUid, diagramId);
      if (!latest) {
        setBlockedSave({ kind: 'missing' });
        return;
      }
      useEditorStore.getState().loadLatestSaved(latest);
      toast.success('Loaded the latest saved version', { description: 'Undo brings your changes back.' });
    } catch (error) {
      if (currentRole !== 'owner' && isPermissionDenied(error)) {
        setBlockedSave({ kind: 'revoked' });
        return;
      }
      console.error('Could not load the latest version', error);
      toast.error('Could not load the latest version', { description: 'Check your connection and try again.' });
    }
  }, [ownerUid, diagramId, currentRole]);

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
    const status = effectiveStatus;
    return (
      <EditorStatusScreen
        fullScreen
        loading={status === 'loading' || status === 'redirecting'}
        title={STATUS_TITLES[status]}
        description={
          status === 'loading'
            ? `Opening ${diagramId}.`
            : status === 'redirecting'
              ? 'You can view this Diagram, but not edit it. Opening the Viewer…'
              : status === 'not-found'
                ? 'No Diagram of yours has this id, and none with it has been shared with you.'
                : status === 'unverified'
                  ? 'No Diagram of yours has this id. If it was shared with you, verify your email first — sharing only works with a verified email. See “Shared with me” on your Diagrams list.'
                  : 'Check your connection and try again.'
        }
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
      subBar={
        // Hidden once the editor's base revision catches up — Load latest,
        // or a Save that went through (Overwrite) — not just on Keep mine.
        newerSave && newerSave.revision > currentRevision ? (
          <NewerSaveBanner newer={newerSave} currentUid={user.uid} onLoadLatest={handleLoadLatest} onKeepMine={() => setNewerSave(null)} />
        ) : localCopyNote ? (
          <LocalCopyNote onDismiss={() => setLocalCopyNote(false)} />
        ) : undefined
      }
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
            permissions.share ? (
              <FileMenuItem icon={<Share2 size={14} />} tone='accent' onClick={() => setShareOpen(true)}>
                Share
              </FileMenuItem>
            ) : undefined
          }
        />
      }
      actions={
        <>
          {/* Owner: Share (Collaborators + Public link), showing whether the
              Public link is on. Collaborators get a badge instead — Share
              and Public are the Owner's (PRD §4.2 table). */}
          {permissions.share ? (
            <Button
              variant='toolbar'
              size='lg'
              onClick={() => setShareOpen(true)}
              title={currentDiagramPublic ? 'Share — the Public link is on' : 'Share — invite Collaborators or turn on the Public link'}
              className={currentDiagramPublic ? 'text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200' : ''}
            >
              {currentDiagramPublic ? <Globe size={13} className='text-emerald-700 dark:text-emerald-300' /> : <LockKeyhole size={13} />}
              Share
              <span className='hidden font-normal text-muted-foreground md:inline'>· {currentDiagramPublic ? 'Public' : 'Private'}</span>
            </Button>
          ) : (
            <CollaboratorBadge ownerEmail={currentOwnerEmail} />
          )}
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
      {permissions.share && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          diagramId={diagramId}
          owner={{ uid: user.uid, email: user.email }}
          isPublic={currentDiagramPublic}
          onPublicChange={setDiagramPublic}
          unsavedChanges={dirty}
        />
      )}
      <SaveConflictDialog
        blocked={blockedSave}
        currentUid={user.uid}
        onClose={() => setBlockedSave(null)}
        onOverwrite={(revision) => handleSaveDiagram(revision)}
        onSaveAsNew={handleSaveAs}
        onLoadLatest={handleLoadLatest}
      />
      <TemplatePickerDialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen} items={templateItems} />
      <StarterPickerDialog open={starterOpen} onOpenChange={setStarterOpen} />
      <MermaidImportDialog open={mermaidOpen} onOpenChange={setMermaidOpen} />
      <SqlExportDialog document={doc} filename={currentDiagramName.trim() || 'diagram'} open={sqlOpen} onOpenChange={setSqlOpen} />
      {/* History lives under the Owner's path — a Can edit Collaborator
          reads (and names) the Owner's Versions. */}
      <VersionHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        ownerUid={ownerUid}
        diagramId={diagramId}
        currentUid={user.uid}
        onRestore={handleRestoreVersion}
        onSaveAsNew={handleVersionSaveAsNew}
      />
    </EditorShell>
  );
}
