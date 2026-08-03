'use client';

import { useCallback } from 'react';
import type {
  FlowDocumentJSON,
  FlowEdge,
  FlowNode,
  ConnectionSide,
  NodePreset,
  NodeType,
} from './flowchart-types';

const DEFAULT_NODE_PAINT: Record<
  NodeType,
  { color: `#${string}`; backgroundColor: `#${string}` }
> = {
  start: { color: '#bae6fd', backgroundColor: '#172554' },
  process: { color: '#c7d2fe', backgroundColor: '#1e293b' },
  decision: { color: '#fde68a', backgroundColor: '#422006' },
  output: { color: '#a7f3d0', backgroundColor: '#052e2b' },
};

/**
 * Centralised editor handlers. Returning memoised callbacks from a
 * single hook keeps the canvas and inspector from re-rendering on
 * unrelated state changes.
 */
export function useEditor(
  doc: FlowDocumentJSON,
  setDoc: (next: FlowDocumentJSON) => void,
) {
  const onNodeMove = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setDoc({
        ...doc,
        nodes: doc.nodes.map((n) =>
          n.id === id ? { ...n, position } : n,
        ),
      });
    },
    [doc, setDoc],
  );

  const onNodeUpdate = useCallback(
    (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => {
      setDoc({
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      });
    },
    [doc, setDoc],
  );

  const onNodeDuplicate = useCallback(
    (id: string) => {
      const source = doc.nodes.find((node) => node.id === id);
      if (!source) return null;
      const duplicateId = `n${doc.nodes.length + 1}-${Date.now().toString(36)}`;
      setDoc({
        ...doc,
        nodes: [
          ...doc.nodes,
          {
            ...source,
            id: duplicateId,
            title: `${source.title} copy`,
            sortOrder:
              Math.max(
                0,
                ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1),
              ) + 1,
            position: {
              x: source.position.x + 36,
              y: source.position.y + 36,
            },
          },
        ],
      });
      return duplicateId;
    },
    [doc, setDoc],
  );

  const onNodeDelete = useCallback(
    (id: string) => {
      setDoc({
        nodes: doc.nodes.filter((n) => n.id !== id),
        edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
      });
    },
    [doc, setDoc],
  );

  const onConnect = useCallback(
    (
      fromId: string,
      toId: string,
      fromSide?: ConnectionSide,
      toSide?: ConnectionSide,
    ) => {
      if (fromId === toId) return;
      // Dedupe the same pair of ports while still allowing parallel lines
      // between two nodes when they use different sides.
      if (
        doc.edges.some(
          (e) =>
            e.from === fromId &&
            e.to === toId &&
            (e.fromSide ?? 'right') === (fromSide ?? 'right') &&
            (e.toSide ?? 'left') === (toSide ?? 'left'),
        )
      ) return;
      setDoc({
        ...doc,
        edges: [
          ...doc.edges,
          {
            id: `e${doc.edges.length + 1}-${Date.now()}`,
            from: fromId,
            to: toId,
            fromSide,
            toSide,
            effect: 'flow',
            direction: 'forward',
            routing: 'orthogonal',
            startMarker: 'none',
            endMarker: 'open-arrow',
            animationSpeed: 1,
            effectSize: 1,
            width: 2,
          },
        ],
      });
    },
    [doc, setDoc],
  );

  const onNodeCreate = useCallback(
    (preset: NodePreset, position: { x: number; y: number }) => {
      // Generate a short, readable id so the JSON inspector stays tidy.
      const id = `n${doc.nodes.length + 1}-${Date.now().toString(36)}`;
      const title = preset.label || defaultTitleFor(preset.type);
      const paint = DEFAULT_NODE_PAINT[preset.type];
      setDoc({
        nodes: [
          ...doc.nodes,
          {
            id,
            type: preset.type,
            title,
            description: defaultDescriptionFor(preset),
            position,
            sortOrder:
              Math.max(
                0,
                ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1),
              ) + 1,
            shape: preset.shape ?? 'rounded',
            icon: preset.icon,
            width: preset.width ?? 190,
            height: preset.height ?? 86,
            iconPosition: 'left',
            iconSize: 22,
            fontSize: 14,
            fontWeight: 'semibold',
            textAlign: 'left',
            color: paint.color,
            backgroundColor: paint.backgroundColor,
            borderColor: paint.color,
            borderWidth: 1.5,
            shadow: 'soft',
          },
        ],
        edges: doc.edges,
      });
      return id;
    },
    [doc, setDoc],
  );

  const onEdgeDelete = useCallback(
    (id: string) => {
      setDoc({ ...doc, edges: doc.edges.filter((e) => e.id !== id) });
    },
    [doc, setDoc],
  );

  const onEdgeUpdate = useCallback(
    (id: string, patch: Partial<Omit<FlowEdge, 'id' | 'from' | 'to'>>) => {
      setDoc({
        ...doc,
        edges: doc.edges.map((edge) =>
          edge.id === id ? { ...edge, ...patch } : edge,
        ),
      });
    },
    [doc, setDoc],
  );

  const onEdgeReconnect = useCallback(
    (
      id: string,
      endpoint: 'from' | 'to',
      nodeId: string,
      side: ConnectionSide,
    ) => {
      setDoc({
        ...doc,
        edges: doc.edges.map((edge) =>
          edge.id !== id
            ? edge
            : endpoint === 'from'
              ? { ...edge, from: nodeId, fromSide: side }
              : { ...edge, to: nodeId, toSide: side },
        ),
      });
    },
    [doc, setDoc],
  );

  return {
    onNodeMove,
    onNodeUpdate,
    onNodeDelete,
    onNodeDuplicate,
    onConnect,
    onNodeCreate,
    onEdgeDelete,
    onEdgeUpdate,
    onEdgeReconnect,
  };
}

function defaultTitleFor(type: NodeType): string {
  switch (type) {
    case 'start': return 'Start';
    case 'process': return 'Process';
    case 'decision': return 'Decision';
    case 'output': return 'Output';
  }
}

function defaultDescriptionFor(preset: NodePreset): string {
  const descriptions: Record<string, string> = {
    start: 'Entry point · trigger',
    process: 'Application process',
    decision: 'Condition · branch',
    output: 'Result · destination',
    database: 'Data source · persistence',
    server: 'Runtime · compute',
    cloud: 'Managed cloud service',
    queue: 'Events · asynchronous flow',
    component: 'Module · component',
    document: 'Artifact · document',
  };
  return descriptions[preset.id] ?? 'Diagram component';
}
