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
  const active = useMemo(
    () => (runMode === 'concurrent' ? doc.nodes.map((node) => node.id) : runPhase === 'node' && orderedGroups[runStep] ? orderedGroups[runStep].map((node) => node.id) : []),
    [doc.nodes, orderedGroups, runMode, runPhase, runStep],
  );
  const nodeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') return undefined;
    return Object.fromEntries(
      orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex < runStep || (groupIndex === runStep && runPhase === 'line') ? 'completed' : groupIndex === runStep && runPhase === 'node' ? 'active' : 'pending'])),
    ) as Record<string, ExecutionState>;
  }, [orderedGroups, runMode, runPhase, runStep]);
  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(doc.edges.map((edge) => [edge.id, 'active'])) as Record<string, ExecutionState>;
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
  const runningEdgeIds = useMemo(
    () => (runMode === 'concurrent' ? null : doc.edges.filter((edge) => edgeExecutionStates[edge.id] === 'active').map((edge) => edge.id)),
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
