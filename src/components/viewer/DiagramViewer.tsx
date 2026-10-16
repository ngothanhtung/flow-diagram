'use client';

import { motion } from 'framer-motion';
import { Boxes, Eye, FileQuestion, ImageDown, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthLoadingScreen } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { FlowCanvas } from '@/components/FlowCanvas';
import { JsonInspector } from '@/components/JsonInspector';
import { RunControls } from '@/components/editor/PlaybackControls';
import { ExportImageDialog } from '@/components/export/ExportImageDialog';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useViewerRun } from '@/components/viewer/use-viewer-run';
import { findPublicDiagramById, listAllDiagrams, openDiagram, toViewerRow, type AdminDiagramRow } from '@/lib/firebase/diagrams';
import { ACCESS_LEVEL_LABELS, routeForRole, type DiagramRole } from '@/lib/sharing';
import { normalizeDocument } from '@/lib/document-validation';
import { isAdminUser } from '@/lib/firebase/roles';

/**
 * Read-only viewer for a single diagram (`/diagrams/{id}/view`).
 * Access policy: the diagram opens when it is flagged `public` (no
 * login required — that's what makes it a Public link), when the
 * viewer owns it, when it is shared with them (Can view or Can edit —
 * read from the Owner's path through the access index, so a private
 * Diagram works too), or when the viewer is an administrator — anything
 * else resolves to "not found". Every editing tool is hidden; only
 * pan, zoom, fit, the info panel and the read-only play bar
 * (mode / repeat / replay) remain.
 */
export function DiagramViewer({ diagramId }: { diagramId: string }) {
  const { user, loading } = useAuth();
  const [diagram, setDiagram] = useState<AdminDiagramRow | null>(null);
  const [role, setRole] = useState<DiagramRole | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    // Resolution order: owner (direct path read) → Collaborator (access
    // index, then the Owner's path) → administrator (full collection-group
    // list) → public flag (flat mirror read, works without a signed-in
    // user).
    const resolve = async (): Promise<{ row: AdminDiagramRow; role: DiagramRole | null } | null> => {
      if (user) {
        const opening = await openDiagram({ uid: user.uid, email: user.email, emailVerified: user.emailVerified }, diagramId).catch(() => null);
        if (opening?.role) return { row: toViewerRow(opening.diagram.id, opening.ownerUid, opening.diagram), role: opening.role };
        if (await isAdminUser(user.uid)) {
          const all = await listAllDiagrams();
          const found = all.find((item) => item.id === diagramId);
          if (found) return { row: found, role: null };
        }
      }
      const publicRow = await findPublicDiagramById(diagramId);
      return publicRow ? { row: publicRow, role: null } : null;
    };

    resolve()
      .then((resolved) => {
        if (cancelled) return;
        const result = resolved?.row;
        if (resolved) setRole(resolved.role);
        if (result) {
          // The Viewer doesn't go through the editor store, so it applies
          // the same gate itself: a stored document with an out-of-range
          // value renders with that value's default instead of crashing.
          setDiagram({ ...result, document: normalizeDocument(result.document).document });
          setStatus('ready');
        } else {
          setStatus('not-found');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [diagramId, user, loading]);

  if (loading || status === 'loading') return <AuthLoadingScreen />;

  if (status !== 'ready' || !diagram) {
    return (
      <div className='grid h-screen place-items-center bg-background text-foreground'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-card px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
            <FileQuestion size={22} className='text-sky-600 dark:text-sky-300' />
          </div>
          <div>
            <h1 className='text-sm font-semibold'>{status === 'not-found' ? 'Diagram not found' : 'Could not load diagram'}</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-muted-foreground'>
              {status === 'not-found' ? 'No diagram matches this id, or you do not have access to it.' : 'Check your connection and try again.'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground ring-1 ring-border transition hover:bg-accent/70'>
              Back to editor
            </Link>
            {!user && (
              <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500/15 px-3 text-xs font-semibold text-sky-700 dark:text-sky-200 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25'>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <ViewerReady diagram={diagram} role={role} />;
}

/** Ready state of the viewer — owns the local playback state machine.
 *  `role` is the signed-in user's on this Diagram, when they have one
 *  (null for a Public link or an administrator). */
function ViewerReady({ diagram, role }: { diagram: AdminDiagramRow; role: DiagramRole | null }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const run = useViewerRun(diagram.document);
  const empty = diagram.document.nodes.length === 0;

  const noop = () => undefined;

  return (
    <div className='flex h-screen flex-col bg-background text-foreground'>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-3 sm:px-6 sm:py-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div className='min-w-0'>
            {/* Name only: the Viewer is open to signed-out visitors, so it
                never shows who owns the Diagram (no uid, no email). */}
            <h1 className='truncate text-base font-semibold'>{diagram.name}</h1>
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          {role === 'view' && (
            <span
              className='inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-semibold text-muted-foreground ring-1 ring-border'
              title='Shared with you — Can view: replay and export, no editing or history'
              data-testid='viewer-role'
            >
              <Eye size={13} />
              <span className='hidden sm:inline'>{ACCESS_LEVEL_LABELS.view}</span>
            </span>
          )}
          {(role === 'owner' || role === 'edit') && (
            <Button variant='toolbar' size='lg' nativeButton={false} render={<Link href={routeForRole(role, diagram.id)} />} title='Open in the editor'>
              <Pencil size={13} />
              <span className='hidden sm:inline'>Edit</span>
            </Button>
          )}
          <RunControls
            runMode={run.runMode}
            repeatEnabled={run.repeatEnabled}
            advanceDisabled={diagram.document.nodes.length === 0}
            onSelectMode={run.setRunMode}
            onAdvance={run.advanceStep}
            onToggleRepeat={run.toggleRepeat}
            onReplay={run.replay}
          />
          {/* Works signed out: the export renders the already-loaded
              document locally, it never reads Firestore. Icon-only below
              `sm`, like the run controls beside it. */}
          <Button variant='toolbar' size='lg' disabled={empty} onClick={() => setImageOpen(true)} title={empty ? 'Diagram is empty' : 'Download as PNG or SVG'} aria-label='Download image'>
            <ImageDown size={13} />
            <span className='hidden sm:inline'>Image</span>
          </Button>
          <ThemeToggle variant='toolbar' size='icon-lg' />
        </div>
      </header>

      <main className={['grid min-h-0 flex-1 gap-2 overflow-hidden', infoOpen ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <section className='relative h-full min-h-0 overflow-hidden bg-background'>
          <FlowCanvas
            document={diagram.document}
            readOnly
            infoOpen={infoOpen}
            onToggleInfo={() => setInfoOpen((open) => !open)}
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

        {infoOpen && (
          <aside className='h-full min-h-0 overflow-hidden' aria-label='Diagram info'>
            <ScrollArea className='h-full pr-1 [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-cyan-300/25'>
              <motion.div initial={{ x: 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.24, ease: 'easeOut' }} className='flex min-h-full flex-col gap-3 pb-1'>
                <div className='rounded-xl bg-card py-3 pr-3 pl-1'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400'>Read-only view</p>
                      <h2 className='mt-1 text-sm font-semibold'>{diagram.name}</h2>
                    </div>
                    <div className='shrink-0 rounded-lg bg-accent px-2 py-1 text-right ring-1 ring-border'>
                      <div className='text-xs font-semibold text-accent-foreground'>
                        {diagram.nodeCount} / {diagram.edgeCount}
                      </div>
                      <div className='text-[8px] uppercase tracking-wider text-muted-foreground'>blocks / lines</div>
                    </div>
                  </div>
                  <p className='mt-2 text-[11px] leading-relaxed text-muted-foreground'>This diagram is shared in read-only mode. Pan and zoom the canvas, replay the path with the play bar, or inspect the raw document below.</p>
                </div>

                <JsonInspector value={JSON.stringify(diagram.document, null, 2)} />
              </motion.div>
            </ScrollArea>
          </aside>
        )}
      </main>
      <ExportImageDialog document={diagram.document} name={diagram.name} open={imageOpen} onOpenChange={setImageOpen} />
    </div>
  );
}
