'use client';

import { create } from 'zustand';
import { loadEditorSession } from './editor-session';
import type { ConnectionSide, DiagramSettings, DrawTool, FlowDocumentJSON, FlowEdge, FlowNode, NodePreset, NodeType } from './flowchart-types';
import type { StoredDiagram } from './firebase/diagrams';
import { TABLE_DEFAULT_WIDTH, TABLE_MAX_WIDTH, tableCardHeight } from './node-style';
import { starterColumns } from '@/components/TableColumnsEditor';

export type RunPhase = 'node' | 'line';

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
};

/**
 * Nodes sharing the same resolved sort order animate together as one
 * step — order only expresses "before/after", not "one by one".
 * Shared by the store (advanceStep) and the view (execution states).
 */
export function computeOrderedGroups(nodes: FlowNode[]): FlowNode[][] {
  const resolved = nodes
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

  // Playback cursor
  seed: number;
  runStep: number;
  runPhase: RunPhase;

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
  runPhase: 'node',

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
      runPhase: 'node',
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

  replay: () => set((state) => ({ runStep: 0, runPhase: 'node', seed: state.seed + 1 })),

  // Shared by the sequential auto-timer and the manual mode's "Next"
  // button — both just move the same node/line cursor forward by one tick.
  advanceStep: () => {
    const { runStep, runPhase, doc } = get();
    const groupCount = computeOrderedGroups(doc.nodes).length;
    const reachedLastNode = runStep >= groupCount - 1 && runPhase === 'node';
    if (reachedLastNode) {
      set({ runStep: 0, runPhase: 'node' });
      return;
    }
    if (runPhase === 'node') {
      set({ runPhase: 'line' });
    } else {
      set((state) => ({ runStep: state.runStep + 1, runPhase: 'node' }));
    }
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),
  setDraggingNodeId: (id) => set({ draggingNodeId: id }),
  setLinkingFromId: (id) => set({ linkingFromId: id }),
  setActiveShape: (shape) => set({ activeShape: shape }),
  toggleInfo: () => set((state) => ({ infoOpen: !state.infoOpen })),
  setSavingDiagram: (saving) => set({ savingDiagram: saving }),

  onNodeMove: (id, position) =>
    set((state) => ({
      doc: {
        ...state.doc,
        nodes: state.doc.nodes.map((node) => (node.id === id ? { ...node, position } : node)),
      },
    })),

  onNodeUpdate: (id, patch) =>
    set((state) => ({
      doc: {
        ...state.doc,
        nodes: state.doc.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      },
    })),

  onNodeDuplicate: (id) => {
    const { doc } = get();
    const source = doc.nodes.find((node) => node.id === id);
    if (!source) return null;
    const duplicateId = `n${doc.nodes.length + 1}-${Date.now().toString(36)}`;
    set({
      doc: {
        ...doc,
        nodes: [
          ...doc.nodes,
          {
            ...source,
            id: duplicateId,
            title: `${source.title} copy`,
            sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
            position: {
              x: source.position.x + 36,
              y: source.position.y + 36,
            },
          },
        ],
      },
    });
    return duplicateId;
  },

  onNodeDelete: (id) =>
    set((state) => ({
      doc: {
        ...state.doc,
        nodes: state.doc.nodes.filter((node) => node.id !== id),
        edges: state.doc.edges.filter((edge) => edge.from !== id && edge.to !== id),
      },
    })),

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
            shadow: 'soft',
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
    const paint = tool === 'logo' ? DEFAULT_NODE_PAINT.logo : DEFAULT_NODE_PAINT.process;
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
              shadow: 'soft',
              table: { columns },
            },
          ],
        },
      });
      return id;
    }
    // The logo tool drops a dedicated brand-mark block. It starts with no
    // selected logo so the user picks one in the inspector; the block is
    // sized from the drag rectangle but clamped to logo-friendly bounds.
    if (tool === 'logo') {
      const w = Math.max(120, Math.min(320, width));
      const h = Math.max(120, Math.min(240, height));
      set({
        doc: {
          ...doc,
          nodes: [
            ...doc.nodes,
            {
              id,
              type: 'logo',
              title: 'Logo',
              description: 'Brand / service',
              position,
              sortOrder: Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1)) + 1,
              shape: 'rounded',
              width: w,
              height: h,
              icon: null,
              iconSize: 64,
              fontSize: 12,
              fontWeight: 'medium',
              textAlign: 'center',
              blockAlign: 'center',
              color: paint.color,
              backgroundColor: paint.backgroundColor,
              borderColor: paint.color,
              borderWidth: 1.5,
              shadow: 'soft',
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
            shadow: 'soft',
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
