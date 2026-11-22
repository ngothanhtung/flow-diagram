'use client';

import { Box, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FlowCanvas } from '@/components/FlowCanvas';
import { IsometricStage } from '@/components/present/IsometricStage';
import { useViewerRun } from '@/components/viewer/use-viewer-run';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { presentKeyAction, presentTarget } from '@/lib/present';

/** How long the mouse must rest before the controls and the cursor fade away. */
const IDLE_MS = 2500;

const noop = () => undefined;

/**
 * Present mode: the Diagram alone, full screen, stepped by hand through its
 * run timeline — → / Space / PageDown next, ← / PageUp back, Home / End,
 * Esc to leave. Never wraps past the last step, so a presenter can't fall
 * back to the start by pressing once too often. Reads the document only: it
 * keeps its own run state and writes nothing back, in the editor as in the
 * viewer.
 */
export function PresentMode({ document, name, onExit }: { document: FlowDocumentJSON; name: string; onExit: () => void }) {
  const run = useViewerRun(document, { runMode: 'manual' });
  const rootRef = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);
  const [isometric, setIsometric] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const { step, stepCount, goToStep } = run;

  // Full screen while presenting; leaving it (the browser's own Esc, F11) ends Present mode.
  useEffect(() => {
    const root = rootRef.current;
    let entered = false;
    const onChange = () => {
      if (window.document.fullscreenElement) entered = true;
      else if (entered) onExit();
    };
    window.document.addEventListener('fullscreenchange', onChange);
    // Refused (no user gesture, an iframe, Safari on iPhone): still present, just inside the window.
    root?.requestFullscreen?.().catch(() => undefined);
    return () => {
      window.document.removeEventListener('fullscreenchange', onChange);
      if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => undefined);
    };
  }, [onExit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        setIsometric((on) => !on);
        return;
      }
      const action = presentKeyAction(event.key);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'exit') onExit();
      else goToStep(presentTarget(action, step, stepCount));
    };
    // Capture: the editor's own shortcuts (Delete, arrows nudging a selection…) never see these keys.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [goToStep, onExit, step, stepCount]);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };

  const atStart = step <= 0;
  const atEnd = stepCount === 0 || step >= stepCount - 1;
  const control = 'grid size-9 place-items-center rounded-full text-foreground transition hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      ref={rootRef}
      role='dialog'
      aria-modal='true'
      aria-label={`Presenting ${name}`}
      onMouseMove={wake}
      className={`fixed inset-0 z-[100] bg-background text-foreground ${idle ? 'cursor-none' : ''}`}
    >
      <IsometricStage enabled={isometric}>
      <FlowCanvas
        document={document}
        readOnly
        hideViewControls
        runningEdgeIds={run.runningEdgeIds}
        nodeExecutionStates={run.nodeExecutionStates}
        edgeExecutionStates={run.edgeExecutionStates}
        infoOpen={false}
        onToggleInfo={noop}
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
      </IsometricStage>

      {/* Fades out while the mouse rests, so the room sees only the Diagram. */}
      <div
        className={`absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-popover/90 p-1 pl-4 shadow-[0_14px_40px_rgba(0,0,0,.28)] ring-1 ring-border backdrop-blur-xl transition-opacity duration-500 ${idle ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        <span className='max-w-56 truncate text-xs font-medium text-muted-foreground'>{name}</span>
        <span className='mx-2 h-4 w-px bg-border' aria-hidden='true' />
        <button type='button' className={control} disabled={atStart} aria-label='Previous step' title='Previous step (←)' onClick={() => goToStep(presentTarget('back', step, stepCount))}>
          <ChevronLeft size={18} />
        </button>
        <span className='min-w-20 text-center text-xs font-semibold tabular-nums' aria-live='polite'>
          {stepCount === 0 ? 'No run steps' : <>Step {step + 1} / {stepCount}</>}
        </span>
        <button type='button' className={control} disabled={atEnd} aria-label='Next step' title='Next step (→ or Space)' onClick={() => goToStep(presentTarget('next', step, stepCount))}>
          <ChevronRight size={18} />
        </button>
        <button type='button' className={control} disabled={atStart} aria-label='Back to the first step' title='Back to the first step (Home)' onClick={() => goToStep(0)}>
          <RotateCcw size={15} />
        </button>
        <button type='button' className={`${control} ${isometric ? 'bg-accent text-sky-500' : ''}`} aria-label='Isometric view' aria-pressed={isometric} title='Isometric view (I)' onClick={() => setIsometric((on) => !on)}>
          <Box size={15} />
        </button>
        <span className='mx-1 h-4 w-px bg-border' aria-hidden='true' />
        <button type='button' className={control} aria-label='Exit presentation' title='Exit (Esc)' onClick={onExit}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
