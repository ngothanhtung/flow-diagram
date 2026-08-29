'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeRunTimeline, resolveStepDelay, resolveStepDuration } from '@/lib/editor-store';
import type { ExecutionState, FlowDocumentJSON, RunMode } from '@/lib/flowchart-types';

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
 * + page auto-timer, and the same unified block/line timeline — see
 * `computeRunTimeline`) but keeps everything in component state — mode
 * and repeat are initialised from the saved diagram settings and never
 * written back, since the viewer must not mutate the document.
 */
export function useViewerRun(document: FlowDocumentJSON): ViewerRun {
  const [runMode, setRunModeState] = useState<RunMode>(document.settings?.runMode ?? 'sequential');
  const [repeatEnabled, setRepeatEnabled] = useState(document.settings?.repeatEnabled ?? false);
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);

  const timeline = useMemo(() => computeRunTimeline(document.nodes, document.edges), [document.nodes, document.edges]);
  const nodeStepIndex = useMemo(() => new Map(timeline.flatMap((entry, index) => (entry.type === 'node' ? entry.nodes.map((node) => [node.id, index] as const) : []))), [timeline]);
  const edgeStepIndex = useMemo(() => new Map(timeline.flatMap((entry, index) => (entry.type === 'edge' ? entry.edges.map((edge) => [edge.id, index] as const) : []))), [timeline]);

  const nodeExecutionStates = useMemo(() => {
    // Both fall back to 'normal' for every node — concurrent because
    // everything really is running, static because nothing is.
    if (runMode === 'concurrent' || runMode === 'static') return undefined;
    return Object.fromEntries([...nodeStepIndex].map(([id, index]) => [id, index < step ? 'completed' : index === step ? 'active' : 'pending'])) as Record<string, ExecutionState>;
  }, [nodeStepIndex, runMode, step]);

  const edgeExecutionStates = useMemo(() => {
    if (runMode === 'concurrent') {
      return Object.fromEntries(document.edges.map((edge) => [edge.id, 'active'])) as Record<string, ExecutionState>;
    }
    // Static keeps every edge at plain 'normal' — the animation itself is
    // stopped separately, by `runningEdgeIds` being `[]` below.
    if (runMode === 'static') {
      return Object.fromEntries(document.edges.map((edge) => [edge.id, 'normal'])) as Record<string, ExecutionState>;
    }
    return Object.fromEntries(
      document.edges.map((edge) => {
        const index = edgeStepIndex.get(edge.id) ?? -1;
        const state: ExecutionState = index < 0 ? 'pending' : index < step ? 'completed' : index === step ? 'active' : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [document.edges, edgeStepIndex, runMode, step]);

  const runningEdgeIds = useMemo(
    () => (runMode === 'concurrent' ? null : runMode === 'static' ? [] : document.edges.filter((edge) => edgeExecutionStates?.[edge.id] === 'active').map((edge) => edge.id)),
    [document.edges, edgeExecutionStates, runMode],
  );

  const replay = useCallback(() => {
    setStep(0);
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

  // Same timeline cursor advance as editor-store.advanceStep.
  const advanceStep = useCallback(() => {
    setStep((current) => (current >= timeline.length - 1 ? 0 : current + 1));
  }, [timeline.length]);

  // Sequential auto-timer, identical to the editor page's effect.
  useEffect(() => {
    if (runMode !== 'sequential' || timeline.length === 0) return;

    const reachedLast = step >= timeline.length - 1;
    if (reachedLast && !repeatEnabled) return;

    const wait = resolveStepDuration(timeline[step]) + resolveStepDelay(timeline[step]) + (reachedLast ? REPEAT_PAUSE_MS : 0);
    const timer = window.setTimeout(advanceStep, wait);
    return () => window.clearTimeout(timer);
  }, [advanceStep, repeatEnabled, runMode, seed, step, timeline]);

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
