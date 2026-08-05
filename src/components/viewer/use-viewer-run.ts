'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeOrderedGroups, type RunPhase } from '@/lib/editor-store';
import { EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from '@/lib/execution-timing';
import type { ExecutionState, FlowDocumentJSON, RunMode } from '@/lib/flowchart-types';

const NODE_PHASE_MS = NODE_FADE_DURATION_MS;
const LINE_PHASE_MS = EDGE_DRAW_DURATION_MS;
const REPEAT_PAUSE_MS = 800;

export interface ViewerRun {
  runMode: RunMode;
  repeatEnabled: boolean;
  nodeExecutionStates: Record<string, ExecutionState> | undefined;
  edgeExecutionStates: Record<string, ExecutionState> | undefined;
  runningEdgeIds: string[] | null;
  setRunMode: (mode: RunMode) => void;
  toggleRepeat: () => void;
  replay: () => void;
  advanceStep: () => void;
}

/**
 * Local playback state machine for the read-only viewer. Mirrors the
 * editor's sequential / concurrent / manual timing (editor-store cursor
 * + page auto-timer) but keeps everything in component state — mode and
 * repeat are initialised from the saved diagram settings and never
 * written back, since the viewer must not mutate the document.
 */
export function useViewerRun(document: FlowDocumentJSON): ViewerRun {
  const [runMode, setRunModeState] = useState<RunMode>(document.settings?.runMode ?? 'sequential');
  const [repeatEnabled, setRepeatEnabled] = useState(document.settings?.repeatEnabled ?? false);
  const [seed, setSeed] = useState(0);
  const [cursor, setCursor] = useState<{ step: number; phase: RunPhase }>({ step: 0, phase: 'node' });

  const orderedGroups = useMemo(() => computeOrderedGroups(document.nodes), [document.nodes]);
  const groupIndexByNodeId = useMemo(() => new Map(orderedGroups.flatMap((group, groupIndex) => group.map((node) => [node.id, groupIndex] as const))), [orderedGroups]);

  const nodeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') return undefined;
    return Object.fromEntries(
      orderedGroups.flatMap((group, groupIndex) =>
        group.map((node) => [node.id, groupIndex < cursor.step || (groupIndex === cursor.step && cursor.phase === 'line') ? 'completed' : groupIndex === cursor.step && cursor.phase === 'node' ? 'active' : 'pending']),
      ),
    ) as Record<string, ExecutionState>;
  }, [orderedGroups, runMode, cursor]);

  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(document.edges.map((edge) => [edge.id, 'active'])) as Record<string, ExecutionState>;
    }
    return Object.fromEntries(
      document.edges.map((edge) => {
        const fromOrder = groupIndexByNodeId.get(edge.from) ?? Number.MAX_SAFE_INTEGER;
        const toOrder = groupIndexByNodeId.get(edge.to) ?? Number.MAX_SAFE_INTEGER;
        const edgeStep = Math.max(fromOrder, toOrder);
        const reachedCurrentNode = cursor.step > 0 && edgeStep === cursor.step;
        const drawingNextLine = cursor.phase === 'line' && edgeStep === cursor.step + 1;
        const state: ExecutionState = edgeStep < cursor.step ? 'completed' : reachedCurrentNode || drawingNextLine ? 'active' : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [document.edges, groupIndexByNodeId, runMode, cursor]);

  const runningEdgeIds = useMemo(() => (runMode === 'concurrent' ? null : document.edges.filter((edge) => edgeExecutionStates?.[edge.id] === 'active').map((edge) => edge.id)), [document.edges, edgeExecutionStates, runMode]);

  const replay = useCallback(() => {
    setCursor({ step: 0, phase: 'node' });
    setSeed((value) => value + 1);
  }, []);

  const setRunMode = useCallback(
    (mode: RunMode) => {
      setRunModeState(mode);
      replay();
    },
    [replay],
  );

  const toggleRepeat = useCallback(() => {
    setRepeatEnabled((value) => !value);
  }, []);

  // Same node/line cursor advance as editor-store.advanceStep.
  const advanceStep = useCallback(() => {
    setCursor(({ step, phase }) => {
      const reachedLastNode = step >= orderedGroups.length - 1 && phase === 'node';
      if (reachedLastNode) return { step: 0, phase: 'node' };
      if (phase === 'node') return { step, phase: 'line' };
      return { step: step + 1, phase: 'node' };
    });
  }, [orderedGroups.length]);

  // Sequential auto-timer, identical to the editor page's effect.
  useEffect(() => {
    if (runMode !== 'sequential' || orderedGroups.length === 0) return;

    const reachedLastNode = cursor.step >= orderedGroups.length - 1 && cursor.phase === 'node';
    if (reachedLastNode && !repeatEnabled) return;

    const timer = window.setTimeout(advanceStep, reachedLastNode ? NODE_PHASE_MS + REPEAT_PAUSE_MS : cursor.phase === 'line' ? LINE_PHASE_MS : NODE_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [advanceStep, cursor, orderedGroups.length, repeatEnabled, runMode, seed]);

  return {
    runMode,
    repeatEnabled,
    nodeExecutionStates,
    edgeExecutionStates,
    runningEdgeIds,
    setRunMode,
    toggleRepeat,
    replay,
    advanceStep,
  };
}
