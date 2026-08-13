'use client';

import { motion } from 'framer-motion';
import { Boxes, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthLoadingScreen } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { FlowCanvas } from '@/components/FlowCanvas';
import { JsonInspector } from '@/components/JsonInspector';
import { RunControls } from '@/components/editor/PlaybackControls';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useViewerRun } from '@/components/viewer/use-viewer-run';
import { findPublicDiagramById, listAllDiagrams, loadDiagram, toViewerRow, type AdminDiagramRow } from '@/lib/firebase/diagrams';
import { isAdminUser } from '@/lib/firebase/roles';

/**
 * Read-only viewer for a single diagram (`/diagrams/{id}/view`).
 * Access policy: the diagram opens when it is flagged `public` (no
 * login required — that's what makes it a share link), when the
 * viewer owns it, or when the viewer is an administrator — anything
 * else resolves to "not found". Every editing tool is hidden; only
 * pan, zoom, fit, the info panel and the read-only play bar
 * (mode / repeat / replay) remain.
 */
export function DiagramViewer({ diagramId }: { diagramId: string }) {
  const { user, loading } = useAuth();
  const [diagram, setDiagram] = useState<AdminDiagramRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    // Resolution order: owner (direct path read) → administrator
    // (full collection-group list) → public flag (flat mirror read,
    // works without a signed-in user).
    const resolve = async (): Promise<AdminDiagramRow | null> => {
      if (user) {
        const own = await loadDiagram(user.uid, diagramId).catch(() => null);
        if (own) return toViewerRow(own.id, user.uid, own);
        if (await isAdminUser(user.uid)) {
          const all = await listAllDiagrams();
          const found = all.find((item) => item.id === diagramId);
          if (found) return found;
        }
      }
      return findPublicDiagramById(diagramId);
    };

    resolve()
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setDiagram(result);
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
      <div className='grid h-screen place-items-center bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
        <div className='flex max-w-sm flex-col items-center gap-4 rounded-xl bg-zinc-900/70 px-8 py-10 text-center'>
          <div className='grid size-12 place-items-center rounded-full bg-sky-500/15 ring-1 ring-sky-400/40'>
            <FileQuestion size={22} className='text-sky-300' />
          </div>
          <div>
            <h1 className='text-sm font-semibold'>{status === 'not-found' ? 'Diagram not found' : 'Could not load diagram'}</h1>
            <p className='mt-1.5 text-xs leading-relaxed text-zinc-500'>
              {status === 'not-found' ? 'No diagram matches this id, or you do not have access to it.' : 'Check your connection and try again.'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 px-3 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10'>
              Back to editor
            </Link>
            {!user && (
              <Link href='/' className='inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500/15 px-3 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40 transition hover:bg-sky-500/25'>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <ViewerReady diagram={diagram} />;
}

/** Ready state of the viewer — owns the local playback state machine. */
function ViewerReady({ diagram }: { diagram: AdminDiagramRow }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const run = useViewerRun(diagram.document);

  const noop = () => undefined;

  return (
    <div className='flex h-screen flex-col bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100'>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/5 px-3 py-3 sm:px-6 sm:py-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40'>
            <Boxes size={18} className='text-sky-300' />
          </div>
          <div className='min-w-0'>
            <h1 className='truncate text-base font-semibold'>{diagram.name}</h1>
            <p className='hidden truncate font-mono text-[10px] text-zinc-500 sm:block'>
              {diagram.id} · owner {diagram.ownerUid.slice(0, 10)}
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          <RunControls
            runMode={run.runMode}
            repeatEnabled={run.repeatEnabled}
            advanceDisabled={diagram.document.nodes.length === 0}
            onSelectMode={run.setRunMode}
            onAdvance={run.advanceStep}
            onToggleRepeat={run.toggleRepeat}
            onReplay={run.replay}
          />
        </div>
      </header>

      <main className={['grid min-h-0 flex-1 gap-2 overflow-hidden', infoOpen ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'].join(' ')}>
        <section className='relative h-full min-h-0 overflow-hidden bg-zinc-950'>
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
                <div className='rounded-xl bg-zinc-900/70 py-3 pr-3 pl-1'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400'>Read-only view</p>
                      <h2 className='mt-1 text-sm font-semibold'>{diagram.name}</h2>
                    </div>
                    <div className='shrink-0 rounded-lg bg-white/5 px-2 py-1 text-right ring-1 ring-white/10'>
                      <div className='text-xs font-semibold text-zinc-200'>
                        {diagram.nodeCount} / {diagram.edgeCount}
                      </div>
                      <div className='text-[8px] uppercase tracking-wider text-zinc-500'>blocks / lines</div>
                    </div>
                  </div>
                  <p className='mt-2 text-[11px] leading-relaxed text-zinc-400'>This diagram is shared in read-only mode. Pan and zoom the canvas, replay the path with the play bar, or inspect the raw document below.</p>
                </div>

                <JsonInspector value={JSON.stringify(diagram.document, null, 2)} />
              </motion.div>
            </ScrollArea>
          </aside>
        )}
      </main>
    </div>
  );
}
