'use client';

// Replay simulation shared by every editor surface (diagram editor,
// template editor). It derives the per-node / per-edge execution states
// from the store's run cursor and drives the sequential timer, so the
// two editors can never drift apart on how a run looks.

import { useEffect, useMemo } from 'react';
import { computeRunTimeline, resolveStepDelay, resolveStepDuration, useEditorStore } from './editor-store';
import type { ExecutionState, FlowDocumentJSON, FlowNode, RunMode } from './flowchart-types';

const REPEAT_PAUSE_MS = 800;

export interface ExecutionPlayback {
  runMode: RunMode;
  repeatEnabled: boolean;
  /** Node ids currently lit up. */
  active: string[];
  /** Node-only steps, in run order — the block half of the timeline. */
  orderedGroups: FlowNode[][];
  nodeExecutionStates: Record<string, ExecutionState> | undefined;
  edgeExecutionStates: Record<string, ExecutionState>;
  /** Edge ids whose effect should animate; null means "all of them". */
  runningEdgeIds: string[] | null;
}

export function useExecutionPlayback(doc: FlowDocumentJSON): ExecutionPlayback {
  const seed = useEditorStore((state) => state.seed);
  const runStep = useEditorStore((state) => state.runStep);
  const advanceStep = useEditorStore((state) => state.advanceStep);

  const runMode = doc.settings?.runMode ?? 'sequential';
  const repeatEnabled = doc.settings?.repeatEnabled ?? false;

  const timeline = useMemo(() => computeRunTimeline(doc.nodes, doc.edges), [doc.nodes, doc.edges]);
  const orderedGroups = useMemo(() => timeline.filter((step) => step.type === 'node').map((step) => step.nodes), [timeline]);
  const nodeStepIndex = useMemo(() => new Map(timeline.flatMap((step, index) => (step.type === 'node' ? step.nodes.map((node) => [node.id, index] as const) : []))), [timeline]);
  const edgeStepIndex = useMemo(() => new Map(timeline.flatMap((step, index) => (step.type === 'edge' ? step.edges.map((edge) => [edge.id, index] as const) : []))), [timeline]);

  // Concurrent mode lights up every step's nodes, not every node — group
  // frames and text objects are scenery, already filtered out of the
  // timeline, so reading the active set from it avoids the bug where
  // mapping doc.nodes directly gave every frame and text object a
  // permanent, blinking "active" halo in concurrent mode.
  // Static has no run cursor at all — nothing is ever "currently executing".
  const active = useMemo(() => {
    if (runMode === 'static') return [];
    if (runMode === 'concurrent') return orderedGroups.flat().map((node) => node.id);
    const current = timeline[runStep];
    return current?.type === 'node' ? current.nodes.map((node) => node.id) : [];
  }, [orderedGroups, runMode, runStep, timeline]);

  const nodeExecutionStates = useMemo(() => {
    // Both fall back to 'normal' for every node (see FlowCanvas's
    // `nodeExecutionStates?.[node.id] ?? 'normal'`) — concurrent because
    // everything really is running, static because nothing is.
    if (runMode === 'concurrent' || runMode === 'static') return undefined;
    return Object.fromEntries([...nodeStepIndex].map(([id, index]) => [id, index < runStep ? 'completed' : index === runStep ? 'active' : 'pending'])) as Record<string, ExecutionState>;
  }, [nodeStepIndex, runMode, runStep]);

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
        const index = edgeStepIndex.get(edge.id) ?? -1;
        const state: ExecutionState = index < 0 ? 'pending' : index < runStep ? 'completed' : index === runStep ? 'active' : 'pending';
        return [edge.id, state];
      }),
    ) as Record<string, ExecutionState>;
  }, [doc.edges, edgeStepIndex, runMode, runStep]);
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
    if (runMode !== 'sequential' || timeline.length === 0) return;

    const reachedLast = runStep >= timeline.length - 1;
    if (reachedLast && !repeatEnabled) return;

    const wait = resolveStepDuration(timeline[runStep]) + resolveStepDelay(timeline[runStep]) + (reachedLast ? REPEAT_PAUSE_MS : 0);
    const timer = window.setTimeout(advanceStep, wait);
    return () => window.clearTimeout(timer);
  }, [advanceStep, repeatEnabled, runMode, runStep, seed, timeline]);

  return { runMode, repeatEnabled, active, orderedGroups, nodeExecutionStates, edgeExecutionStates, runningEdgeIds };
}
