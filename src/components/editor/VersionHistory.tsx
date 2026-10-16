'use client';

import { Bookmark, BookmarkX, Check, CopyPlus, Eye, History, LoaderCircle, Pencil, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FlowCanvas } from '@/components/FlowCanvas';
import { RunControls } from '@/components/editor/PlaybackControls';
import { useViewerRun } from '@/components/viewer/use-viewer-run';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { normalizeDocument } from '@/lib/document-validation';
import { listVersions, renameVersion, type StoredVersion } from '@/lib/firebase/versions';
import { formatRelativeTime, formatSavedAt, savedByLabel, UNNAMED_VERSIONS_KEPT, VERSION_NAME_MAX, versionLabel } from '@/lib/version-history';

interface VersionActions {
  /** Load the Version into the editor as an unsaved change. */
  onRestore: (version: StoredVersion) => void;
  /** Copy the Version into a new Diagram owned by the signed-in user. */
  onSaveAsNew: (version: StoredVersion) => Promise<void>;
}

interface VersionHistorySheetProps extends VersionActions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose path the Diagram lives under (`users/{ownerUid}/diagrams/{id}`). */
  ownerUid: string;
  diagramId: string;
  /** Signed-in user, so their own Saves read "You". */
  currentUid: string;
}

/**
 * The Editor's History panel (PRD v0.3 §4.1): every Version of the open
 * Diagram, newest first, Named versions highlighted. A modal sheet — the
 * canvas isn't edited while browsing history, and keyboard shortcuts are
 * inert while it is open, so nothing here can touch the document except
 * Restore, which goes through the store as one undo step.
 *
 * The list lives in a child that Base UI mounts only while the sheet is
 * open, so every opening fetches afresh (a Save made since shows up).
 */
export function VersionHistorySheet({ open, onOpenChange, ownerUid, diagramId, currentUid, onRestore, onSaveAsNew }: VersionHistorySheetProps) {
  const [previewing, setPreviewing] = useState<StoredVersion | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='gap-0 border-border bg-popover/95 backdrop-blur-xl data-[side=right]:sm:max-w-md' aria-label='Version history'>
        <SheetHeader className='border-b border-border pr-12'>
          <SheetTitle className='flex items-center gap-2 text-sm font-semibold'>
            <History size={14} className='text-sky-600 dark:text-sky-300' />
            Version history
          </SheetTitle>
          <SheetDescription className='text-xs leading-relaxed'>
            Every Save adds a version. Name one to keep it for good — unnamed versions beyond the latest {UNNAMED_VERSIONS_KEPT} are removed automatically.
          </SheetDescription>
        </SheetHeader>
        <VersionList
          ownerUid={ownerUid}
          diagramId={diagramId}
          currentUid={currentUid}
          onPreview={setPreviewing}
          onRestore={onRestore}
          onSaveAsNew={onSaveAsNew}
        />
      </SheetContent>

      <VersionPreviewDialog
        version={previewing}
        currentUid={currentUid}
        onOpenChange={(next) => !next && setPreviewing(null)}
        onRestore={(version) => {
          setPreviewing(null);
          onRestore(version);
        }}
        onSaveAsNew={onSaveAsNew}
      />
    </Sheet>
  );
}

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; versions: StoredVersion[]; now: number };

function VersionList({ ownerUid, diagramId, currentUid, onPreview, onRestore, onSaveAsNew }: { ownerUid: string; diagramId: string; currentUid: string; onPreview: (version: StoredVersion) => void } & VersionActions) {
  const [state, setState] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listVersions(ownerUid, diagramId)
      .then((versions) => {
        // "Now" is when the list arrived; relative times don't tick while
        // the panel is open, which is fine for a list opened on demand.
        if (!cancelled) setState({ status: 'ready', versions, now: Date.now() });
      })
      .catch((error: unknown) => {
        console.error('Could not load versions', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [ownerUid, diagramId]);

  if (state.status !== 'ready') {
    return (
      <div className='grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground'>
        {state.status === 'loading' ? (
          <span className='inline-flex items-center gap-2'>
            <LoaderCircle size={14} className='animate-spin' /> Loading versions…
          </span>
        ) : (
          'Could not load the version history. Check your connection and try again.'
        )}
      </div>
    );
  }

  const { versions, now } = state;
  const namedCount = versions.filter((version) => version.name !== null).length;

  const patchVersion = (id: string, name: string | null) =>
    setState((current) => (current.status === 'ready' ? { ...current, versions: current.versions.map((version) => (version.id === id ? { ...version, name } : version)) } : current));

  return (
    <>
      {versions.length === 0 ? (
        <div className='grid flex-1 place-items-center p-6 text-center text-xs leading-relaxed text-muted-foreground'>
          No versions yet. Each Save from now on adds one — this diagram was last saved before version history existed.
        </div>
      ) : (
        <ScrollArea className='min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:w-2'>
          <ol className='flex flex-col gap-1.5 p-3' aria-label='Versions, newest first'>
            {versions.map((version, index) => (
              <VersionRow
                key={version.id}
                version={version}
                latest={index === 0}
                now={now}
                ownerUid={ownerUid}
                diagramId={diagramId}
                currentUid={currentUid}
                onRenamed={(name) => patchVersion(version.id, name)}
                onPreview={() => onPreview(version)}
                onRestore={() => onRestore(version)}
                onSaveAsNew={() => onSaveAsNew(version)}
              />
            ))}
          </ol>
        </ScrollArea>
      )}
      <p className='border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground' data-testid='version-counts'>
        {versions.length - namedCount} unnamed (latest {UNNAMED_VERSIONS_KEPT} kept) · {namedCount} named (never removed)
      </p>
    </>
  );
}

interface VersionRowProps {
  version: StoredVersion;
  latest: boolean;
  now: number;
  ownerUid: string;
  diagramId: string;
  currentUid: string;
  onRenamed: (name: string | null) => void;
  onPreview: () => void;
  onRestore: () => void;
  onSaveAsNew: () => Promise<void>;
}

function VersionRow({ version, latest, now, ownerUid, diagramId, currentUid, onRenamed, onPreview, onRestore, onSaveAsNew }: VersionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'rename' | 'copy' | null>(null);
  const named = version.name !== null;

  const commitName = async (value: string) => {
    setEditing(false);
    if ((value.trim() || null) === version.name) return;
    setBusy('rename');
    try {
      const stored = await renameVersion(ownerUid, diagramId, version.id, value);
      onRenamed(stored);
      toast.success(stored ? 'Version named' : 'Name removed', { description: stored ?? formatSavedAt(version.savedAt) });
    } catch (error) {
      console.error('Could not rename version', error);
      toast.error('Could not rename the version');
    } finally {
      setBusy(null);
    }
  };

  const saveAsNew = async () => {
    setBusy('copy');
    try {
      await onSaveAsNew();
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      data-testid='version-row'
      data-named={named ? 'true' : 'false'}
      className={[
        'rounded-lg px-3 py-2.5 ring-1 transition',
        named ? 'bg-amber-400/10 ring-amber-500/35 dark:ring-amber-300/30' : 'bg-card ring-border hover:bg-accent/60',
      ].join(' ')}
    >
      <div className='flex items-start gap-2'>
        {named ? <Bookmark size={13} className='mt-0.5 shrink-0 fill-current text-amber-600 dark:text-amber-300' aria-label='Named version' /> : <History size={13} className='mt-0.5 shrink-0 text-muted-foreground' />}
        <div className='min-w-0 flex-1'>
          {editing ? (
            <Input
              autoFocus
              value={draft}
              maxLength={VERSION_NAME_MAX}
              placeholder='Name this version'
              aria-label='Version name'
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={() => void commitName(draft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                if (event.key === 'Escape') {
                  // Keep Escape from also closing the sheet.
                  event.stopPropagation();
                  event.preventDefault();
                  setEditing(false);
                }
              }}
              className='h-7 text-xs'
            />
          ) : (
            <p className={['truncate text-xs font-semibold', named ? 'text-amber-800 dark:text-amber-100' : 'text-foreground'].join(' ')} title={versionLabel(version)}>
              {versionLabel(version)}
              {latest && <span className='ml-2 rounded-full bg-sky-500/15 px-1.5 py-px align-middle text-[9px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-sky-400/40 dark:text-sky-200'>Latest</span>}
            </p>
          )}
          <p className='mt-0.5 truncate text-[11px] text-muted-foreground'>
            <span>{savedByLabel(version.savedBy, currentUid)}</span>
            {' · '}
            <time dateTime={version.savedAt ? new Date(version.savedAt).toISOString() : undefined} title={formatSavedAt(version.savedAt)}>
              {formatRelativeTime(version.savedAt, now)}
            </time>
            {named && <span> · {formatSavedAt(version.savedAt)}</span>}
          </p>
        </div>
      </div>

      <div className='mt-2 flex flex-wrap items-center gap-1 pl-5'>
        <Button variant='ghost' size='xs' onClick={onPreview}>
          <Eye /> Preview
        </Button>
        <Button variant='ghost' size='xs' onClick={onRestore} title='Load this version onto the canvas as an unsaved change'>
          <RotateCcw /> Restore
        </Button>
        <Button
          variant='ghost'
          size='xs'
          disabled={busy !== null}
          onClick={() => {
            setDraft(version.name ?? '');
            setEditing(true);
          }}
        >
          {busy === 'rename' ? <LoaderCircle className='animate-spin' /> : <Pencil />} {named ? 'Rename' : 'Name'}
        </Button>
        {named && (
          <Button variant='ghost' size='icon-xs' disabled={busy !== null} onClick={() => void commitName('')} title='Remove name' aria-label='Remove name'>
            <BookmarkX />
          </Button>
        )}
        <Button variant='ghost' size='icon-xs' disabled={busy !== null} onClick={() => void saveAsNew()} title='Save as a new diagram' aria-label='Save as a new diagram'>
          {busy === 'copy' ? <LoaderCircle className='animate-spin' /> : <CopyPlus />}
        </Button>
      </div>
    </li>
  );
}

/**
 * Read-only preview of one Version with its own Replay — the Viewer's
 * pieces (`FlowCanvas readOnly`, `RunControls`, `useViewerRun`) on local
 * state, so nothing here reads or writes the editor store's document.
 */
function VersionPreviewDialog({ version, currentUid, onOpenChange, onRestore, onSaveAsNew }: { version: StoredVersion | null; currentUid: string; onOpenChange: (open: boolean) => void } & VersionActions) {
  return (
    <Dialog open={version !== null} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[min(88vh,900px)] w-[min(96vw,1400px)] max-w-none flex-col gap-0 overflow-hidden border-border bg-popover p-0 sm:max-w-none' showCloseButton={false}>
        {/* Keyed by id: the run state starts from this Version's own run mode. */}
        {version && <VersionPreviewBody key={version.id} version={version} currentUid={currentUid} onClose={() => onOpenChange(false)} onRestore={onRestore} onSaveAsNew={onSaveAsNew} />}
      </DialogContent>
    </Dialog>
  );
}

function VersionPreviewBody({ version, currentUid, onClose, onRestore, onSaveAsNew }: { version: StoredVersion; currentUid: string; onClose: () => void } & VersionActions) {
  // The same gate every document passes on its way to a canvas.
  const [document] = useState(() => normalizeDocument(version.document).document);
  const run = useViewerRun(document);
  const [copying, setCopying] = useState(false);
  const noop = () => undefined;

  return (
    <>
      <DialogHeader className='flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3'>
        <div className='min-w-0'>
          <DialogTitle className='flex items-center gap-2 truncate text-sm font-semibold'>
            {version.name ? <Bookmark size={13} className='shrink-0 fill-current text-amber-600 dark:text-amber-300' /> : <Eye size={13} className='shrink-0 text-sky-600 dark:text-sky-300' />}
            Preview · {versionLabel(version)}
          </DialogTitle>
          <DialogDescription className='mt-0.5 text-[11px]'>
            Read-only. Saved by {savedByLabel(version.savedBy, currentUid)} · {formatSavedAt(version.savedAt)}. The diagram you are editing is unchanged.
          </DialogDescription>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <RunControls
            runMode={run.runMode}
            repeatEnabled={run.repeatEnabled}
            advanceDisabled={document.nodes.length === 0}
            onSelectMode={run.setRunMode}
            onAdvance={run.advanceStep}
            onToggleRepeat={run.toggleRepeat}
            onReplay={run.replay}
          />
          <Button variant='toolbar' size='icon-lg' onClick={onClose} title='Close preview' aria-label='Close preview'>
            <X size={14} />
          </Button>
        </div>
      </DialogHeader>

      <section className='relative min-h-0 flex-1 overflow-hidden bg-background' aria-label='Version preview canvas'>
        <FlowCanvas
          document={document}
          readOnly
          infoOpen={false}
          onToggleInfo={noop}
          runningEdgeIds={run.runningEdgeIds}
          nodeExecutionStates={run.nodeExecutionStates}
          edgeExecutionStates={run.edgeExecutionStates}
          effectsPaused={run.runMode === 'static'}
          selectedNodeId={null}
          onSelectNode={noop}
          onNodeMove={noop}
          onNodeResize={noop}
          onNodeDragStart={noop}
          onNodeDragEnd={noop}
          onConnect={noop}
          isDragging={false}
          linkingFromId={null}
          onLinkStart={noop}
          onLinkMove={noop}
          onLinkEnd={noop}
          selectedEdgeId={null}
          onSelectEdge={noop}
          onEdgeReconnect={noop}
          onEdgeUpdate={noop}
          activeShape={null}
          onShapeDrawn={noop}
        />
      </section>

      <div className='flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3'>
        <Button
          variant='toolbar'
          disabled={copying}
          onClick={() => {
            setCopying(true);
            void onSaveAsNew(version).finally(() => setCopying(false));
          }}
        >
          {copying ? <LoaderCircle className='animate-spin' /> : <CopyPlus />} Save as new diagram
        </Button>
        <Button variant='accent' onClick={() => onRestore(version)}>
          <Check /> Restore this version
        </Button>
      </div>
    </>
  );
}
