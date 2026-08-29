'use client';

import { create } from 'zustand';
import { convertDocumentColorTheme } from './color-theme-convert';
import { loadEditorSession } from './editor-session';
import { DEFAULT_STEP_DELAY_MS, EDGE_DRAW_DURATION_MS, NODE_FADE_DURATION_MS } from './execution-timing';
import type { ConnectionSide, DiagramSettings, DrawTool, FlowDocumentJSON, FlowEdge, FlowNode, NodePreset, NodeType } from './flowchart-types';
import type { StoredDiagram } from './firebase/diagrams';
import { GROUP_MAX_HEIGHT, GROUP_MAX_WIDTH, GROUP_MIN_SIZE, TABLE_DEFAULT_WIDTH, TABLE_MAX_WIDTH, nodeSizeLimits, tableCardHeight } from './node-style';
import { childrenOf, descendantIds, findDropTarget, groupGeometryFor } from './node-tree';
import { starterColumns } from '@/components/TableColumnsEditor';

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
};

/**
 * Nodes sharing the same resolved sort order animate together as one
 * step — order only expresses "before/after", not "one by one". Frames,
 * text objects and free icon/logo objects are scenery, not steps: a
 * container, a caption or a placed graphic flashing as its own step
 * would interrupt the run of the blocks it describes, so they're
 * filtered out and stay fully visible for the whole replay.
 */
export function computeOrderedGroups(nodes: FlowNode[]): FlowNode[][] {
  const resolved = nodes
    .filter((node) => node.type !== 'group' && node.type !== 'text' && node.type !== 'icon')
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
  const eligibleNodes = nodes.filter((node) => node.type !== 'group' && node.type !== 'text' && node.type !== 'icon');
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
  selectedNodeId: string | null;
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
  onShapeCreate: (tool: DrawTool, position: { x: number; y: number }, width: number, height: number) => string;
  onEdgeDelete: (id: string) => void;
  onEdgeUpdate: (id: string, patch: Partial<Omit<FlowEdge, 'id' | 'from' | 'to'>>) => void;
  onEdgeReconnect: (id: string, endpoint: 'from' | 'to', nodeId: string, side: ConnectionSide) => void;
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

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),
  setDraggingNodeId: (id) => set({ draggingNodeId: id }),
  setLinkingFromId: (id) => set({ linkingFromId: id }),
  setActiveShape: (shape) => set({ activeShape: shape }),
  toggleInfo: () => set((state) => ({ infoOpen: !state.infoOpen })),
  setSavingDiagram: (saving) => set({ savingDiagram: saving }),

  // Moving a group carries its members: positions stay absolute, so the
  // whole subtree shifts by the same delta and nothing else in the app
  // has to know the nodes were related.
  onNodeMove: (id, position) =>
    set((state) => {
      const moved = state.doc.nodes.find((node) => node.id === id);
      if (!moved) return {};
      const dx = position.x - moved.position.x;
      const dy = position.y - moved.position.y;
      const followers = moved.type === 'group' && (dx !== 0 || dy !== 0) ? descendantIds(state.doc.nodes, id) : null;
      return {
        doc: {
          ...state.doc,
          nodes: state.doc.nodes.map((node) => {
            if (node.id === id) return { ...node, position };
            if (followers?.has(node.id)) return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
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
    // A line between two database tables is an ERD relationship, and a
    // schema diagram reads better still: no travelling objects, no halo.
    const isRelationship = Boolean(doc.nodes.find((node) => node.id === fromId)?.table && doc.nodes.find((node) => node.id === toId)?.table);
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
            borderWidth: 1.5,
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
  onShapeCreate: (tool, position, width, height) => {
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
              borderWidth: 1.5,
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
              borderWidth: 1.5,
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
            borderWidth: 1.5,
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
