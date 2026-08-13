'use client';

// Replay simulation shared by every editor surface (diagram editor,
// template editor). It derives the per-node / per-edge execution states
// from the store's run cursor and drives the sequential timer, so the
// two editors can never drift apart on how a run looks.

import { useEffect, useMemo } from 'react';
import { computeOrderedGroups, useEditorStore } from './editor-store';
import { EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from './execution-timing';
import type { ExecutionState, FlowDocumentJSON, RunMode } from './flowchart-types';

const NODE_PHASE_MS = NODE_FADE_DURATION_MS;
const LINE_PHASE_MS = EDGE_DRAW_DURATION_MS;
const REPEAT_PAUSE_MS = 800;

export interface ExecutionPlayback {
  runMode: RunMode;
  repeatEnabled: boolean;
  /** Node ids currently lit up. */
  active: string[];
  orderedGroups: ReturnType<typeof computeOrderedGroups>;
  nodeExecutionStates: Record<string, ExecutionState> | undefined;
  edgeExecutionStates: Record<string, ExecutionState>;
  /** Edge ids whose effect should animate; null means "all of them". */
  runningEdgeIds: string[] | null;
}

export function useExecutionPlayback(doc: FlowDocumentJSON): ExecutionPlayback {
  const seed = useEditorStore((state) => state.seed);
  const runStep = useEditorStore((state) => state.runStep);
  const runPhase = useEditorStore((state) => state.runPhase);
  const advanceStep = useEditorStore((state) => state.advanceStep);

  const runMode = doc.settings?.runMode ?? 'sequential';
  const repeatEnabled = doc.settings?.repeatEnabled ?? false;

  const orderedGroups = useMemo(() => computeOrderedGroups(doc.nodes), [doc.nodes]);
  const groupIndexByNodeId = useMemo(() => new Map(orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex] as const))), [orderedGroups]);
  // Concurrent mode lights up every *step*, not every node — group frames
  // and text objects are scenery, already filtered out of orderedGroups by
  // computeOrderedGroups, so read the active set from there rather than
  // doc.nodes directly. Mapping doc.nodes here previously gave every frame
  // and text object a permanent, blinking "active" halo in concurrent mode.
  // Static has no run cursor at all — nothing is ever "currently executing".
  const active = useMemo(
    () =>
      runMode === 'static'
        ? []
        : runMode === 'concurrent'
          ? orderedGroups.flatMap((group) => group.map((node) => node.id))
          : runPhase === 'node' && orderedGroups[runStep]
            ? orderedGroups[runStep].map((node) => node.id)
            : [],
    [orderedGroups, runMode, runPhase, runStep],
  );
  const nodeExecutionStates = useMemo(() => {
    // Both fall back to 'normal' for every node (see FlowCanvas's
    // `nodeExecutionStates?.[node.id] ?? 'normal'`) — concurrent because
    // everything really is running, static because nothing is.
    if (runMode === 'concurrent' || runMode === 'static') return undefined;
    return Object.fromEntries(
      orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex < runStep || (groupIndex === runStep && runPhase === 'line') ? 'completed' : groupIndex === runStep && runPhase === 'node' ? 'active' : 'pending'])),
    ) as Record<string, ExecutionState>;
  }, [orderedGroups, runMode, runPhase, runStep]);
  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(doc.edges.map((edge) => [edge.id, 'active'])) as Record<string, ExecutionState>;
    }
    // Static keeps every edge at plain 'normal' — full opacity, no
    // pending fade, no 'active' draw-in — the animation itself is
    // stopped separately, by `runningEdgeIds` being `[]` below.
    if (runMode === 'static') {
      return Object.fromEntries(doc.edges.map((edge) => [edge.id, 'normal'])) as Record<string, ExecutionState>;
    }
    return Object.fromEntries(
      doc.edges.map((edge) => {
        const fromOrder = groupIndexByNodeId.get(edge.from) ?? Number.MAX_SAFE_INTEGER;
        const toOrder = groupIndexByNodeId.get(edge.to) ?? Number.MAX_SAFE_INTEGER;
        const edgeStep = Math.max(fromOrder, toOrder);
        const reachedCurrentNode = runStep > 0 && edgeStep === runStep;
        const drawingNextLine = runPhase === 'line' && edgeStep === runStep + 1;
        const state: ExecutionState = edgeStep < runStep ? 'completed' : reachedCurrentNode || drawingNextLine ? 'active' : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [doc.edges, groupIndexByNodeId, runMode, runPhase, runStep]);
  // null means "every edge animates" (concurrent); an array means "only
  // these ids do" — static passes an empty array, which pauses all of
  // them, the same mechanism sequential/manual use to pause everything
  // but the current step.
  const runningEdgeIds = useMemo(
    () => (runMode === 'concurrent' ? null : runMode === 'static' ? [] : doc.edges.filter((edge) => edgeExecutionStates[edge.id] === 'active').map((edge) => edge.id)),
    [doc.edges, edgeExecutionStates, runMode],
  );

  // Sequential mode auto-advances on a timer; manual mode reuses the same
  // `advanceStep` from its Next button, so the two can't fall out of sync.
  useEffect(() => {
    if (runMode !== 'sequential' || orderedGroups.length === 0) return;

    const reachedLastNode = runStep >= orderedGroups.length - 1 && runPhase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(advanceStep, reachedLastNode ? NODE_PHASE_MS + REPEAT_PAUSE_MS : runPhase === 'line' ? LINE_PHASE_MS : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [orderedGroups.length, repeatEnabled, runMode, runPhase, runStep, seed, advanceStep]);

  return { runMode, repeatEnabled, active, orderedGroups, nodeExecutionStates, edgeExecutionStates, runningEdgeIds };
}
