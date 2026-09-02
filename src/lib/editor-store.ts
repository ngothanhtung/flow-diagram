'use client';

import { create } from 'zustand';
import { layoutDocument, type LayoutDirection } from './auto-layout';
import { convertDocumentColorTheme } from './color-theme-convert';
import { clearStyleOverrides, edgeStylesOf, resolveEdgeStyle } from './edge-style';
import { loadEditorSession } from './editor-session';
import { DEFAULT_STEP_DELAY_MS, EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from './execution-timing';
import type { ConnectionSide, DiagramSettings, DrawTool, EdgeStyleClass, FlowDocumentJSON, FlowEdge, FlowNode, LineCorner, NodePreset, NodeType } from './flowchart-types';
import type { StoredDiagram } from './firebase/diagrams';
import { GROUP_MAX_HEIGHT, GROUP_MAX_WIDTH, GROUP_MIN_SIZE, TABLE_DEFAULT_WIDTH, TABLE_MAX_WIDTH, nodeSizeLimits, resolveNodeStyle, tableCardHeight } from './node-style';
import { boundsOfNodes, childrenOf, descendantIds, findDropTarget, groupGeometryFor, nodeBounds } from './node-tree';
import { starterColumns } from '@/components/TableColumnsEditor';

/** Which edge of the selection's bounding box the nodes line up against. */
export type AlignEdge = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';

/** Snapshot of the Firestore template currently on the canvas — feeds
 *  the info panel and the Reset action. */
export interface LoadedTemplate {
  name: string;
  category: string;
  description: string;
  document: FlowDocumentJSON;
}

const DEFAULT_NODE_PAINT: Record<NodeType, { color: `#${string}`; backgroundColor: `#${string}` }> = {
  start: { color: '#bae6fd', backgroundColor: '#172554' },
  process: { color: '#c7d2fe', backgroundColor: '#1e293b' },
  decision: { color: '#fde68a', backgroundColor: '#422006' },
  output: { color: '#a7f3d0', backgroundColor: '#052e2b' },
  logo: { color: '#f4f4f5', backgroundColor: '#27272a' },
  group: { color: '#c4b5fd', backgroundColor: '#1e1b4b' },
  text: { color: '#e4e4e7', backgroundColor: '#00000000' },
  icon: { color: '#e4e4e7', backgroundColor: '#00000000' },
  line: { color: '#7dd3fc', backgroundColor: '#00000000' },
};

/**
 * Node kinds that are scenery rather than steps. A container, a caption,
 * a placed graphic or a free line flashing as its own step would
 * interrupt the run of the blocks they describe — they stay fully
 * visible for the whole replay instead.
 *
 * One list, because the two functions below both need it and they used
 * to spell it out as separate `!==` chains that could drift apart.
 */
const SCENERY_NODE_TYPES = new Set<NodeType>(['group', 'text', 'icon', 'line']);

/** True when the node is scenery — see `SCENERY_NODE_TYPES`. */
export function isSceneryNode(node: FlowNode): boolean {
  return SCENERY_NODE_TYPES.has(node.type);
}

/**
 * Nodes sharing the same resolved sort order animate together as one
 * step — order only expresses "before/after", not "one by one".
 */
export function computeOrderedGroups(nodes: FlowNode[]): FlowNode[][] {
  const resolved = nodes
    .filter((node) => !isSceneryNode(node))
    .map((node, index) => ({
      node,
      order: node.sortOrder && node.sortOrder > 0 ? node.sortOrder : index + 1,
      index,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index);
  const groups: FlowNode[][] = [];
  let lastOrder: number | null = null;
  for (const item of resolved) {
    const currentGroup = groups.at(-1);
    if (lastOrder === item.order && currentGroup) {
      currentGroup.push(item.node);
    } else {
      groups.push([item.node]);
      lastOrder = item.order;
    }
  }
  return groups;
}

export type RunTimelineStep = { type: 'node'; nodes: FlowNode[] } | { type: 'edge'; edges: FlowEdge[] };

/**
 * Blocks and lines share one replay sequence. A line's own `sortOrder`
 * (unset = auto: the later of its two connected nodes' order) sits on
 * the same number line as a node's, so the two interleave freely instead
 * of a line being pinned to one of the gaps between node steps.
 *
 * Entries sharing the same order *and* kind collapse into one step, same
 * "animate together" rule `computeOrderedGroups` uses for nodes. A node
 * and a line tied at the same order stay two separate, consecutive
 * steps — the line finishes drawing, then the block lights up — which
 * reproduces the historic node/line phase alternation for the common
 * case (an untouched line's auto order equals its target node's).
 */
export function computeRunTimeline(nodes: FlowNode[], edges: FlowEdge[]): RunTimelineStep[] {
  const eligibleNodes = nodes.filter((node) => !isSceneryNode(node));
  const nodeOrder = new Map<string, number>();
  eligibleNodes.forEach((node, index) => nodeOrder.set(node.id, node.sortOrder && node.sortOrder > 0 ? node.sortOrder : index + 1));

  interface Entry {
    kind: 'node' | 'edge';
    order: number;
    index: number;
    node?: FlowNode;
    edge?: FlowEdge;
  }
  const entries: Entry[] = [
    ...eligibleNodes.map((node, index): Entry => ({ kind: 'node', order: nodeOrder.get(node.id)!, index, node })),
    ...edges.map((edge, index): Entry => {
      // A line whose endpoint isn't a step-bearing node (e.g. attached to
      // a frame) has nothing to derive an order from — it runs last.
      const order = edge.sortOrder && edge.sortOrder > 0 ? edge.sortOrder : Math.max(nodeOrder.get(edge.from) ?? Number.POSITIVE_INFINITY, nodeOrder.get(edge.to) ?? Number.POSITIVE_INFINITY);
      return { kind: 'edge', order, index, edge };
    }),
  ];
  // Edge before node at an equal order — see the doc comment above.
  entries.sort((a, b) => a.order - b.order || (a.kind === b.kind ? a.index - b.index : a.kind === 'edge' ? -1 : 1));

  const steps: RunTimelineStep[] = [];
  let last: { order: number; kind: 'node' | 'edge' } | null = null;
  for (const entry of entries) {
    const current = steps.at(-1);
    if (last && last.order === entry.order && last.kind === entry.kind && current) {
      if (entry.kind === 'node' && current.type === 'node') current.nodes.push(entry.node!);
      else if (entry.kind === 'edge' && current.type === 'edge') current.edges.push(entry.edge!);
    } else {
      steps.push(entry.kind === 'node' ? { type: 'node', nodes: [entry.node!] } : { type: 'edge', edges: [entry.edge!] });
      last = { order: entry.order, kind: entry.kind };
    }
  }
  return steps;
}

/**
 * How long a timeline step stays the active one before the run cursor
 * advances — the max of its members' own `duration` (unset falls back
 * to the same defaults the CSS transition itself uses in
 * `FlowNodeCard`/`AnimatedEdge`, so the timer and the visible
 * fade/draw-in never fall out of sync). Max, not first, so a step with
 * several blocks/lines sharing one order never cuts off whichever one
 * takes longest.
 */
export function resolveStepDuration(step: RunTimelineStep | undefined): number {
  if (!step) return NODE_FADE_DURATION_MS;
  return step.type === 'node' ? Math.max(...step.nodes.map((node) => node.duration ?? NODE_FADE_DURATION_MS)) : Math.max(...step.edges.map((edge) => edge.duration ?? EDGE_DRAW_DURATION_MS));
}

/**
 * Extra pause after a step's `resolveStepDuration` animation finishes,
 * before the run cursor advances — same max-of-the-group rule.
 */
export function resolveStepDelay(step: RunTimelineStep | undefined): number {
  if (!step) return DEFAULT_STEP_DELAY_MS;
  return step.type === 'node' ? Math.max(...step.nodes.map((node) => node.delay ?? DEFAULT_STEP_DELAY_MS)) : Math.max(...step.edges.map((edge) => edge.delay ?? DEFAULT_STEP_DELAY_MS));
}

/**
 * Moves a batch of nodes to explicit positions, carrying each moved
 * frame's subtree by the same delta — the rule a drag already follows
 * (`onNodeMove`), applied to every layout action at once so aligning a
 * frame never leaves its members behind. A node named in `moves` keeps
 * its explicit position even if an enclosing frame also moved.
 */
function applyNodeMoves(nodes: FlowNode[], moves: Map<string, { x: number; y: number }>): FlowNode[] {
  if (moves.size === 0) return nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (const [id, position] of moves) {
    const node = byId.get(id);
    if (!node) continue;
    const dx = position.x - node.position.x;
    const dy = position.y - node.position.y;
    if (dx === 0 && dy === 0) continue;
    deltas.set(id, { dx, dy });
    if (node.type === 'group') {
      for (const descendant of descendantIds(nodes, id)) {
        if (!moves.has(descendant)) deltas.set(descendant, { dx, dy });
      }
    }
  }
  if (deltas.size === 0) return nodes;
  return nodes.map((node) => {
    const delta = deltas.get(node.id);
    return delta ? { ...node, position: { x: node.position.x + delta.dx, y: node.position.y + delta.dy } } : node;
  });
}

/** The selected nodes, in document order. */
function selectedNodesOf(nodes: FlowNode[], selectedIds: string[]): FlowNode[] {
  const wanted = new Set(selectedIds);
  return nodes.filter((node) => wanted.has(node.id));
}

interface EditorState {
  /** Guard so session hydration happens exactly once per page load. */
  hydrated: boolean;

  // Document + persistence meta
  doc: FlowDocumentJSON;
  /** Metadata + original document of the template on the canvas. */
  loadedTemplate: LoadedTemplate | null;
  currentDiagramId: string | null;
  currentDiagramName: string;
  /** Viewer visibility persisted on the diagram doc (`public` field). */
  currentDiagramPublic: boolean;
  savedSignature: string | null;
  savingDiagram: boolean;

  // Playback cursor — an index into `computeRunTimeline(doc)`.
  seed: number;
  runStep: number;

  // Selection + interaction
  /** The node the inspector edits — the last one clicked. Always also
   *  present in `selectedNodeIds` while something is selected. */
  selectedNodeId: string | null;
  /** Every node in the current selection. One entry is the ordinary case;
   *  shift-click and marquee build the rest. Layout actions (align,
   *  distribute, match size) and multi-node drags read this. */
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  draggingNodeId: string | null;
  linkingFromId: string | null;
  activeShape: DrawTool | null;
  infoOpen: boolean;

  // Lifecycle
  hydrate: (userId: string) => void;

  // Diagram meta
  renameDiagram: (name: string) => void;
  setDiagramPublic: (isPublic: boolean) => void;
  markDiagramSaved: (diagramId: string, name: string, savedDocument: FlowDocumentJSON) => void;
  loadStoredDiagram: (diagram: StoredDiagram) => void;
  loadRemoteTemplate: (template: LoadedTemplate) => void;
  resetToTemplate: () => void;
  resetCanvasState: () => void;

  // Settings (persisted inside doc.settings)
  applySettings: (patch: DiagramSettings) => void;

  /** Flips every node/group/edge's literal colours between a dark-canvas
   *  and light-canvas palette (see `color-theme-convert.ts`). The same
   *  action undoes itself, so there is no direction to pick. */
  convertColorTheme: () => void;

  // Playback
  replay: () => void;
  advanceStep: () => void;

  // Selection + interaction
  selectNode: (id: string | null) => void;
  /** Shift-click: add the node to the selection, or drop it if it's
   *  already in. The node added last becomes the inspector's subject. */
  toggleNodeSelection: (id: string) => void;
  /** Marquee: replace the whole selection at once. */
  selectNodes: (ids: string[]) => void;
  selectEdge: (id: string | null) => void;
  setDraggingNodeId: (id: string | null) => void;
  setLinkingFromId: (id: string | null) => void;
  setActiveShape: (shape: DrawTool | null) => void;
  toggleInfo: () => void;
  setSavingDiagram: (saving: boolean) => void;

  // Document mutations
  onNodeMove: (id: string, position: { x: number; y: number }) => void;
  /** Drag finished — join, leave or stay in whatever frame it landed on. */
  onNodeDrop: (id: string) => void;
  /** Release every member of a group frame, keeping the frame. */
  ungroupNode: (id: string) => void;
  /** Resize a frame so it wraps its members with even padding. */
  fitGroupToContents: (id: string) => void;
  onNodeUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void;
  onNodeDuplicate: (id: string) => string | null;
  onNodeDelete: (id: string) => void;
  onConnect: (fromId: string, toId: string, fromSide?: ConnectionSide, toSide?: ConnectionSide) => void;
  onNodeCreate: (preset: NodePreset, position: { x: number; y: number }) => string;
  /** `lineStart` is only meaningful for the `line` tool — which corner of
   *  the width×height box the drawn line starts at (`FlowNode.lineStart`). */
  onShapeCreate: (tool: DrawTool, position: { x: number; y: number }, width: number, height: number, lineStart?: LineCorner) => string;
  onEdgeDelete: (id: string) => void;
  onEdgeUpdate: (id: string, patch: Partial<Omit<FlowEdge, 'id' | 'from' | 'to'>>) => void;
  onEdgeReconnect: (id: string, endpoint: 'from' | 'to', nodeId: string, side: ConnectionSide) => void;

  // The document's named line vocabulary (`settings.edgeStyles`).
  /** Add a class, or replace the one with the same id. */
  upsertEdgeStyle: (style: EdgeStyleClass) => void;
  /** Delete a class, baking its look onto the lines that used it. */
  removeEdgeStyle: (styleId: string) => void;
  /** Point a line at a class, or detach it (`null`). */
  assignEdgeStyle: (edgeId: string, styleId: string | null) => void;

  /** Lay the diagram out in ranks. With 2+ nodes selected it tidies just
   *  those, so one messy corner can be fixed without disturbing the rest.
   *  Returns how many nodes moved. */
  autoLayout: (direction: LayoutDirection) => number;

  // Layout actions over the current multi-selection. Each is a no-op
  // below its minimum selection size, so the UI can stay mounted.
  /** Line every selected node up against the selection's own bounding box. */
  alignSelectedNodes: (edge: AlignEdge) => void;
  /** Even the *gaps* between selected nodes along one axis (needs 3+). */
  distributeSelectedNodes: (axis: 'x' | 'y') => void;
  /** Resize every selected node to match the last-clicked one. */
  matchSelectedNodeSize: (dimension: 'width' | 'height' | 'both') => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  hydrated: false,
  doc: { nodes: [], edges: [] },
  loadedTemplate: null,
  currentDiagramId: null,
  currentDiagramName: 'Untitled diagram',
  currentDiagramPublic: false,
  savedSignature: null,
  savingDiagram: false,

  seed: 0,
  runStep: 0,

  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  draggingNodeId: null,
  linkingFromId: null,
  activeShape: null,
  infoOpen: false,

  // Restores the diagram that was open before the last refresh (including
  // unsaved edits) instead of always booting into the default template.
  hydrate: (userId) => {
    if (get().hydrated) return;
    const session = loadEditorSession(userId);
    set({
      hydrated: true,
      doc: session?.doc ?? { nodes: [], edges: [] },
      currentDiagramId: session?.currentDiagramId ?? null,
      currentDiagramName: session?.currentDiagramName ?? 'Untitled diagram',
      currentDiagramPublic: session?.currentDiagramPublic ?? false,
      savedSignature: session?.savedSignature ?? null,
    });
  },

  renameDiagram: (name) => set({ currentDiagramName: name }),

  setDiagramPublic: (isPublic) => set({ currentDiagramPublic: isPublic }),

  markDiagramSaved: (diagramId, name, savedDocument) =>
    set({
      currentDiagramId: diagramId,
      currentDiagramName: name,
      savedSignature: JSON.stringify(savedDocument),
    }),

  loadStoredDiagram: (diagram) => {
    set({
      doc: diagram.document,
      currentDiagramId: diagram.id,
      currentDiagramName: diagram.name,
      currentDiagramPublic: diagram.public === true,
      savedSignature: JSON.stringify(diagram.document),
      // Snapshot so Reset restores the fetched document, not a template.
      loadedTemplate: { name: diagram.name, category: 'Saved diagram', description: '', document: diagram.document },
    });
    get().resetCanvasState();
  },

  // Template chosen from the shared Firestore library (`templates`
  // collection).
  loadRemoteTemplate: (template) => {
    const hasDiagram = get().currentDiagramId !== null;
    set({
      doc: template.document,
      ...(hasDiagram ? {} : { currentDiagramName: template.name, currentDiagramPublic: false }),
      savedSignature: null,
      loadedTemplate: template,
    });
    get().resetCanvasState();
  },

  // Reset action: restore the fetched diagram or Firestore template that
  // was originally loaded onto the canvas.
  resetToTemplate: () => {
    const loaded = get().loadedTemplate;
    if (!loaded) return;
    set({ doc: loaded.document, savedSignature: null });
    get().resetCanvasState();
  },

  resetCanvasState: () =>
    set((state) => ({
      seed: state.seed + 1,
      runStep: 0,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      draggingNodeId: null,
      linkingFromId: null,
      activeShape: null,
    })),

  applySettings: (patch) =>
    set((state) => ({
      doc: { ...state.doc, settings: { ...state.doc.settings, ...patch } },
    })),

  convertColorTheme: () => set((state) => ({ doc: convertDocumentColorTheme(state.doc) })),

  replay: () => set((state) => ({ runStep: 0, seed: state.seed + 1 })),

  // Shared by the sequential auto-timer and the manual mode's "Next"
  // button — both just move the same timeline cursor forward by one step.
  advanceStep: () => {
    const { runStep, doc } = get();
    const stepCount = computeRunTimeline(doc.nodes, doc.edges).length;
    const reachedLast = runStep >= stepCount - 1;
    set(reachedLast ? { runStep: 0 } : (state) => ({ runStep: state.runStep + 1 }));
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [], selectedEdgeId: id ? null : get().selectedEdgeId }),

  toggleNodeSelection: (id) =>
    set((state) => {
      const isSelected = state.selectedNodeIds.includes(id);
      const nextIds = isSelected ? state.selectedNodeIds.filter((selectedId) => selectedId !== id) : [...state.selectedNodeIds, id];
      return {
        selectedNodeIds: nextIds,
        // The inspector follows the last node still in the selection, so
        // shift-clicking one off hands the panel back to another member
        // rather than blanking it.
        selectedNodeId: nextIds.at(-1) ?? null,
        selectedEdgeId: nextIds.length > 0 ? null : state.selectedEdgeId,
      };
    }),

  selectNodes: (ids) => set((state) => ({ selectedNodeIds: ids, selectedNodeId: ids.at(-1) ?? null, selectedEdgeId: ids.length > 0 ? null : state.selectedEdgeId })),

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId, selectedNodeIds: id ? [] : get().selectedNodeIds }),
  setDraggingNodeId: (id) => set({ draggingNodeId: id }),
  setLinkingFromId: (id) => set({ linkingFromId: id }),
  setActiveShape: (shape) => set({ activeShape: shape }),
  toggleInfo: () => set((state) => ({ infoOpen: !state.infoOpen })),
  setSavingDiagram: (saving) => set({ savingDiagram: saving }),

  // Moving a group carries its members: positions stay absolute, so the
  // whole subtree shifts by the same delta and nothing else in the app
  // has to know the nodes were related. Dragging one node of a
  // multi-selection carries the rest of the selection the same way, so
  // what moves is what the user can see is selected.
  onNodeMove: (id, position) =>
    set((state) => {
      const moved = state.doc.nodes.find((node) => node.id === id);
      if (!moved) return {};
      const dx = position.x - moved.position.x;
      const dy = position.y - moved.position.y;
      const followers = new Set<string>();
      if (dx !== 0 || dy !== 0) {
        const roots = state.selectedNodeIds.includes(id) ? state.selectedNodeIds : [id];
        for (const rootId of roots) {
          if (rootId !== id) followers.add(rootId);
          const root = rootId === id ? moved : state.doc.nodes.find((node) => node.id === rootId);
          if (root?.type === 'group') {
            for (const descendant of descendantIds(state.doc.nodes, rootId)) followers.add(descendant);
          }
        }
        followers.delete(id);
      }
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.map((node) => {
            if (node.id === id) return { ...node, position };
            if (followers.has(node.id)) return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
            return node;
          }),
        },
      };
    }),

  // Called when a drag ends: whichever frame the node was dropped into
  // becomes its parent, and a drop outside every frame releases it.
  onNodeDrop: (id) =>
    set((state) => {
      const dropped = state.doc.nodes.find((node) => node.id === id);
      if (!dropped) return {};
      const target = findDropTarget(state.doc.nodes, id, dropped.position);
      const nextParentId = target?.id;
      if ((dropped.parentId ?? undefined) === nextParentId) return {};
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.map((node) => (node.id === id ? { ...node, parentId: nextParentId } : node)),
        },
      };
    }),

  // Releases every member of a frame without touching the frame itself,
  // so "ungroup" is undoable by simply dragging them back in.
  ungroupNode: (id) =>
    set((state) => ({
      doc: {
        ...state.doc,
        nodes: state.doc.nodes.map((node) => (node.parentId === id ? { ...node, parentId: undefined } : node)),
      },
    })),

  // Shrinks or grows a frame to wrap its direct members. A frame with no
  // members keeps whatever size the user drew.
  fitGroupToContents: (id) =>
    set((state) => {
      const geometry = groupGeometryFor(childrenOf(state.doc.nodes, id));
      if (!geometry) return {};
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.map((node) => (node.id === id ? { ...node, ...geometry } : node)),
        },
      };
    }),

  onNodeUpdate: (id, patch) =>
    set((state) => ({
      doc: {
        ...state.doc,
        nodes: state.doc.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      },
    })),

  // Duplicating a group copies what it contains — a frame on its own
  // would be an empty box, which is never what "duplicate" meant.
  onNodeDuplicate: (id) => {
    const { doc } = get();
    const source = doc.nodes.find((node) => node.id === id);
    if (!source) return null;
    const stamp = Date.now().toString(36);
    const members = source.type === 'group' ? descendantIds(doc.nodes, id) : new Set<string>();
    const nextSortOrder = Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1));
    // Ids are minted for the whole subtree first so the copies can point
    // at each other rather than back at the originals.
    const idMap = new Map<string, string>([[id, `n${doc.nodes.length + 1}-${stamp}`]]);
    let offset = 1;
    for (const memberId of members) idMap.set(memberId, `n${doc.nodes.length + 1 + offset++}-${stamp}`);

    const copies = doc.nodes
      .filter((node) => idMap.has(node.id))
      .map((node, index) => ({
        ...node,
        id: idMap.get(node.id)!,
        title: node.id === id ? `${node.title} copy` : node.title,
        sortOrder: nextSortOrder + index + 1,
        position: { x: node.position.x + 36, y: node.position.y + 36 },
        // The root copy keeps the original's parent (it lands beside it,
        // inside the same frame); members follow their copied frame.
        parentId: node.id === id ? node.parentId : idMap.get(node.parentId ?? '') ?? node.parentId,
      }));

    // Lines wholly inside the duplicated group are copied too, so a
    // duplicated subsystem keeps its internal wiring.
    const copiedEdges = doc.edges
      .filter((edge) => idMap.has(edge.from) && idMap.has(edge.to))
      .map((edge, index) => ({
        ...edge,
        id: `e${doc.edges.length + 1 + index}-${Date.now()}`,
        from: idMap.get(edge.from)!,
        to: idMap.get(edge.to)!,
      }));

    set({ doc: { ...doc, nodes: [...doc.nodes, ...copies], edges: [...doc.edges, ...copiedEdges] } });
    return idMap.get(id)!;
  },

  // Deleting a frame deletes what it holds, matching how every other
  // canvas tool treats a container. `Ungroup` first is the way to keep
  // the members.
  onNodeDelete: (id) =>
    set((state) => {
      const target = state.doc.nodes.find((node) => node.id === id);
      const doomed = new Set<string>([id]);
      if (target?.type === 'group') for (const descendant of descendantIds(state.doc.nodes, id)) doomed.add(descendant);
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.filter((node) => !doomed.has(node.id)),
          edges: state.doc.edges.filter((edge) => !doomed.has(edge.from) && !doomed.has(edge.to)),
        },
      };
    }),

  onConnect: (fromId, toId, fromSide, toSide) => {
    if (fromId === toId) return;
    const { doc } = get();
    // Dedupe the same pair of ports while still allowing parallel lines
    // between two nodes when they use different sides.
    if (doc.edges.some((edge) => edge.from === fromId && edge.to === toId && (edge.fromSide ?? 'right') === (fromSide ?? 'right') && (edge.toSide ?? 'left') === (toSide ?? 'left'))) return;
    const fromNode = doc.nodes.find((node) => node.id === fromId);
    const toNode = doc.nodes.find((node) => node.id === toId);
    // A line between two database tables is an ERD relationship, and a
    // schema diagram reads better still: no travelling objects, no halo.
    const isRelationship = Boolean(fromNode?.table && toNode?.table);
    set({
      doc: {
        ...doc,
        edges: [
          ...doc.edges,
          {
            id: `e${doc.edges.length + 1}-${Date.now()}`,
            from: fromId,
            to: toId,
            fromSide,
            toSide,
            effect: isRelationship ? 'none' : 'comet',
            direction: 'forward',
            routing: 'smooth-step',
            // Both ends start bare — an arrowhead is an explicit choice
            // in the line inspector, not something a new line inherits.
            startMarker: 'none',
            endMarker: 'none',
            animationSpeed: 1,
            effectSize: 1.5,
            // Glow is off unless a line asks for it, so a freshly drawn
            // line carries the halo explicitly rather than relying on a
            // default that dense-diagram mode would strip away.
            glowIntensity: isRelationship ? undefined : 1,
            width: 2,
          },
        ],
      },
    });
  },

  onNodeCreate: (preset, position) => {
    const { doc } = get();
    // Generate a short, readable id so the JSON inspector stays tidy.
    const id = `n${doc.nodes.length + 1}-${Date.now().toString(36)}`;
    const title = preset.label || defaultTitleFor(preset.type);
    const paint = DEFAULT_NODE_PAINT[preset.type];
    set({
      doc: {
        nodes: [
          ...doc.nodes,
          {
            id,
            type: preset.type,
            title,
            description: defaultDescriptionFor(preset),
            position,
            sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
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
            borderWidth: 2,
            shadow: 'none',
            // Plain fill by default; the sheen gradient is opt-in.
            fill: 'flat',
          },
        ],
        edges: doc.edges,
        settings: doc.settings,
      },
    });
    return id;
  },

  /**
   * Drop a free-floating shape node (Figma-style). The shape is the
   * `node.shape` field. The block starts with placeholder title, sub
   * title and icon so it reads as a real card straight away; the
   * inspector edits all three afterwards.
   */
  onShapeCreate: (tool, position, width, height, lineStart) => {
    const { doc } = get();
    const id = `n${doc.nodes.length + 1}-${Date.now().toString(36)}`;
    const paint = DEFAULT_NODE_PAINT.process;
    // The table tool draws a rounded card carrying a starter TableSpec.
    // Its height comes from the column count rather than the drag, so a
    // new table is never born with rows clipped off.
    if (tool === 'table') {
      const columns = starterColumns();
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes,
            {
              id,
              type: 'process',
              title: 'new_table',
              position,
              sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
              shape: 'rounded',
              width: Math.max(TABLE_DEFAULT_WIDTH, Math.min(TABLE_MAX_WIDTH, width)),
              height: tableCardHeight(columns.length),
              fontSize: 13,
              icon: null,
              color: paint.color,
              backgroundColor: paint.backgroundColor,
              borderColor: paint.color,
              borderWidth: 2,
              shadow: 'none',
              // Plain fill by default; the sheen gradient is opt-in.
              fill: 'flat',
              table: { columns },
            },
          ],
        },
      });
      return id;
    }
    // A group frame is drawn like a shape but is a container: no icon,
    // no description, a dashed violet outline, and the drag rectangle is
    // its real size (clamped to the frame ceiling, not the card one).
    if (tool === 'group') {
      const frameWidth = Math.max(GROUP_MIN_SIZE, Math.min(GROUP_MAX_WIDTH, width));
      const frameHeight = Math.max(GROUP_MIN_SIZE, Math.min(GROUP_MAX_HEIGHT, height));
      // Drawing a frame around existing blocks is the natural way to
      // group them, so anything free-standing whose centre falls inside
      // joins on creation. Blocks already in another frame keep it.
      const enclosed = new Set(
        doc.nodes
          .filter(
            (node) =>
              node.parentId === undefined &&
              Math.abs(node.position.x - position.x) <= frameWidth / 2 &&
              Math.abs(node.position.y - position.y) <= frameHeight / 2,
          )
          .map((node) => node.id),
      );
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes.map((node) => (enclosed.has(node.id) ? { ...node, parentId: id } : node)),
            {
              id,
              type: 'group',
              title: 'Group',
              position,
              sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
              shape: 'rounded',
              width: frameWidth,
              height: frameHeight,
              fontSize: 13,
              icon: null,
              color: '#c4b5fd',
              backgroundColor: '#1e1b4b',
              borderColor: '#c4b5fd',
              borderWidth: 2,
              borderStyle: 'dashed',
              shadow: 'none',
              // Plain fill by default; the sheen gradient is opt-in.
              fill: 'flat',
            },
          ],
        },
      });
      return id;
    }
    // Free text: words on the canvas with no box, so it carries no
    // silhouette, fill, border or icon — only typography.
    if (tool === 'text') {
      const limits = nodeSizeLimits({ type: 'text' });
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes,
            {
              id,
              type: 'text',
              title: 'Text',
              position,
              sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
              // The canvas already substitutes a sensible box for a plain
              // click, so the drawn rectangle just needs clamping.
              width: Math.max(limits.minWidth, Math.min(limits.maxWidth, width)),
              height: Math.max(limits.minHeight, Math.min(limits.maxHeight, height)),
              icon: null,
              color: DEFAULT_NODE_PAINT.text.color,
              fontSize: 16,
              fontWeight: 'medium',
              textAlign: 'left',
              borderWidth: 0,
              shadow: 'none',
            },
          ],
        },
      });
      return id;
    }
    // Free icon/logo: a single glyph or brand mark on the canvas, with no
    // card around it — the graphic counterpart to the text tool above.
    // No title (nothing renders it) and no default icon: the inspector
    // picks one afterwards, same as the logo block.
    if (tool === 'icon') {
      const limits = nodeSizeLimits({ type: 'icon' });
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes,
            {
              id,
              type: 'icon',
              title: '',
              position,
              width: Math.max(limits.minWidth, Math.min(limits.maxWidth, width)),
              height: Math.max(limits.minHeight, Math.min(limits.maxHeight, height)),
              icon: null,
              iconSize: 64,
              color: DEFAULT_NODE_PAINT.icon.color,
            },
          ],
        },
      });
      return id;
    }
    // Free line: a straight stroke placed by a width×height box, not
    // attached to any node. `lineStart` is the corner the drag actually
    // began at, so the drawn line runs the way it was dragged and its
    // start end is the end the user started from — which is the end the
    // start marker will sit on.
    if (tool === 'line') {
      const limits = nodeSizeLimits({ type: 'line' });
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes,
            {
              id,
              type: 'line',
              title: '',
              position,
              width: Math.max(limits.minWidth, Math.min(limits.maxWidth, width)),
              height: Math.max(limits.minHeight, Math.min(limits.maxHeight, height)),
              lineStart,
              icon: null,
              color: DEFAULT_NODE_PAINT.line.color,
              borderWidth: 2,
            },
          ],
        },
      });
      return id;
    }
    const shape = tool;
    // `position` is the centre of the new shape, matching the rest
    // of the editor's coordinate convention. Width/height are clamped
    // to a sensible minimum so a stray click doesn't produce a
    // 1-pixel sliver.
    const w = Math.max(40, Math.min(640, width));
    const h = Math.max(40, Math.min(480, height));
    set({
      doc: {
        nodes: [
          ...doc.nodes,
          {
            id,
            type: 'process',
            title: 'Title',
            description: 'Sub Title',
            position,
            sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
            shape,
            width: w,
            height: h,
            // Export name as the icon picker stores it — lucide-react's
            // `Settings` alias dedupes to `LucideSettings`.
            icon: 'lucide:LucideSettings',
            iconPosition: 'left',
            iconSize: 18,
            fontSize: 13,
            fontWeight: 'medium',
            blockAlign: 'left',
            textAlign: 'left',
            color: paint.color,
            backgroundColor: paint.backgroundColor,
            borderColor: paint.color,
            borderWidth: 2,
            shadow: 'none',
            // Plain fill by default; the sheen gradient is opt-in.
            fill: 'flat',
          },
        ],
        edges: doc.edges,
        settings: doc.settings,
      },
    });
    return id;
  },

  onEdgeDelete: (id) =>
    set((state) => ({
      doc: { ...state.doc, edges: state.doc.edges.filter((edge) => edge.id !== id) },
    })),

  onEdgeUpdate: (id, patch) =>
    set((state) => ({
      doc: {
        ...state.doc,
        edges: state.doc.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)),
      },
    })),

  onEdgeReconnect: (id, endpoint, nodeId, side) =>
    set((state) => ({
      doc: {
        ...state.doc,
        edges: state.doc.edges.map((edge) => (edge.id !== id ? edge : endpoint === 'from' ? { ...edge, from: nodeId, fromSide: side } : { ...edge, to: nodeId, toSide: side })),
      },
    })),

  upsertEdgeStyle: (style) =>
    set((state) => {
      const styles = edgeStylesOf(state.doc.settings);
      const existing = styles.findIndex((item) => item.id === style.id);
      const next = existing === -1 ? [...styles, style] : styles.map((item, index) => (index === existing ? style : item));
      return { doc: { ...state.doc, settings: { ...state.doc.settings, edgeStyles: next } } };
    }),

  // Deleting a class must not silently restyle the diagram: every line
  // that followed it keeps exactly the look it had, now as its own
  // fields. Only the *shared* vocabulary entry goes away.
  removeEdgeStyle: (styleId) =>
    set((state) => {
      const styles = edgeStylesOf(state.doc.settings);
      const style = styles.find((item) => item.id === styleId);
      if (!style) return {};
      return {
        doc: {
          ...state.doc,
          edges: state.doc.edges.map((edge) => (edge.styleRef !== styleId ? edge : { ...resolveEdgeStyle(edge, styles), styleRef: undefined })),
          settings: { ...state.doc.settings, edgeStyles: styles.filter((item) => item.id !== styleId) },
        },
      };
    }),

  // Assigning clears the line's own values for the fields the class
  // defines — otherwise picking a class would appear to do nothing on a
  // line that already carries an explicit colour. Detaching does the
  // reverse and bakes the class's look on, so the line doesn't jump.
  assignEdgeStyle: (edgeId, styleId) =>
    set((state) => {
      const styles = edgeStylesOf(state.doc.settings);
      return {
        doc: {
          ...state.doc,
          edges: state.doc.edges.map((edge) => {
            if (edge.id !== edgeId) return edge;
            if (styleId === null) return { ...resolveEdgeStyle(edge, styles), styleRef: undefined };
            const style = styles.find((item) => item.id === styleId);
            return { ...edge, ...clearStyleOverrides(style ?? null), styleRef: styleId };
          }),
        },
      };
    }),

  autoLayout: (direction) => {
    const { doc, selectedNodeIds } = get();
    // A selection of one is a click, not a request to tidy one node, so
    // the whole-document layout is the more useful reading of it.
    const only = selectedNodeIds.length >= 2 ? new Set(selectedNodeIds) : undefined;
    const positions = layoutDocument(doc, { direction, only });
    if (positions.size === 0) return 0;
    // Laying out inside a selection keeps the block where the user left
    // it: the layout's own origin would otherwise fling it across the
    // canvas. Shift the whole result so its centre stays put.
    let offset = { x: 0, y: 0 };
    if (only) {
      const before = boundsOfNodes(doc.nodes.filter((node) => positions.has(node.id)));
      if (before) {
        const centres = [...positions.values()];
        const afterX = (Math.min(...centres.map((point) => point.x)) + Math.max(...centres.map((point) => point.x))) / 2;
        const afterY = (Math.min(...centres.map((point) => point.y)) + Math.max(...centres.map((point) => point.y))) / 2;
        offset = { x: (before.left + before.right) / 2 - afterX, y: (before.top + before.bottom) / 2 - afterY };
      }
    }
    set({
      doc: {
        ...doc,
        nodes: doc.nodes.map((node) => {
          const position = positions.get(node.id);
          return position ? { ...node, position: { x: position.x + offset.x, y: position.y + offset.y } } : node;
        }),
      },
    });
    return positions.size;
  },

  // Align against the selection's own bounding box rather than a fixed
  // canvas edge — the reference is whatever the user actually picked, so
  // the outermost nodes stay put and everything else comes to them.
  alignSelectedNodes: (edge) =>
    set((state) => {
      const selected = selectedNodesOf(state.doc.nodes, state.selectedNodeIds);
      if (selected.length < 2) return {};
      const frame = boundsOfNodes(selected);
      if (!frame) return {};
      const moves = new Map<string, { x: number; y: number }>();
      for (const node of selected) {
        const bounds = nodeBounds(node);
        const halfWidth = (bounds.right - bounds.left) / 2;
        const halfHeight = (bounds.bottom - bounds.top) / 2;
        const position = { ...node.position };
        if (edge === 'left') position.x = frame.left + halfWidth;
        else if (edge === 'center-x') position.x = (frame.left + frame.right) / 2;
        else if (edge === 'right') position.x = frame.right - halfWidth;
        else if (edge === 'top') position.y = frame.top + halfHeight;
        else if (edge === 'center-y') position.y = (frame.top + frame.bottom) / 2;
        else position.y = frame.bottom - halfHeight;
        moves.set(node.id, position);
      }
      return { doc: { ...state.doc, nodes: applyNodeMoves(state.doc.nodes, moves) } };
    }),

  // Even *gaps*, not even centres: with mixed node sizes, equal centre
  // spacing leaves visibly uneven whitespace, which is the thing the
  // user is actually trying to fix.
  distributeSelectedNodes: (axis) =>
    set((state) => {
      const selected = selectedNodesOf(state.doc.nodes, state.selectedNodeIds);
      if (selected.length < 3) return {};
      const measured = selected
        .map((node) => {
          const bounds = nodeBounds(node);
          return {
            node,
            start: axis === 'x' ? bounds.left : bounds.top,
            size: axis === 'x' ? bounds.right - bounds.left : bounds.bottom - bounds.top,
          };
        })
        .sort((a, b) => a.start - b.start);
      const first = measured[0];
      const last = measured[measured.length - 1];
      const span = last.start + last.size - first.start;
      const occupied = measured.reduce((total, item) => total + item.size, 0);
      const gap = (span - occupied) / (measured.length - 1);
      const moves = new Map<string, { x: number; y: number }>();
      let cursor = first.start;
      for (const item of measured) {
        const centre = cursor + item.size / 2;
        moves.set(item.node.id, axis === 'x' ? { x: centre, y: item.node.position.y } : { x: item.node.position.x, y: centre });
        cursor += item.size + gap;
      }
      return { doc: { ...state.doc, nodes: applyNodeMoves(state.doc.nodes, moves) } };
    }),

  // The last-clicked node is the reference, the convention every design
  // tool uses. Each target still clamps to its own kind's limits, so
  // matching a card against a table can't push it past what it may be.
  matchSelectedNodeSize: (dimension) =>
    set((state) => {
      const selected = selectedNodesOf(state.doc.nodes, state.selectedNodeIds);
      if (selected.length < 2) return {};
      const reference = selected.find((node) => node.id === state.selectedNodeId) ?? selected[selected.length - 1];
      const referenceStyle = resolveNodeStyle(reference);
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.map((node) => {
            if (node.id === reference.id || !state.selectedNodeIds.includes(node.id)) return node;
            const limits = nodeSizeLimits(node);
            const patch: Partial<FlowNode> = {};
            if (dimension !== 'height') patch.width = Math.max(limits.minWidth, Math.min(limits.maxWidth, referenceStyle.width));
            if (dimension !== 'width') patch.height = Math.max(limits.minHeight, Math.min(limits.maxHeight, referenceStyle.height));
            return { ...node, ...patch };
          }),
        },
      };
    }),
}));

function defaultTitleFor(type: NodeType): string {
  switch (type) {
    case 'start':
      return 'Start';
    case 'process':
      return 'Process';
    case 'decision':
      return 'Decision';
    case 'output':
      return 'Output';
    case 'logo':
      return 'Logo';
    case 'group':
      return 'Group';
    case 'text':
      return 'Text';
    case 'icon':
      return 'Icon';
    case 'line':
      return 'Line';
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
