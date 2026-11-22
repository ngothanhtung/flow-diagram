// What one Lesson step shows: which Elements are visible, how each one
// looks, and the Diagram with that step's overrides applied. Pure data, no
// React; the editor and the viewer both render from this.

import type { EdgeEffect, FlowDocumentJSON, FlowEdge, FlowNode, NodeEffect } from '../flowchart-types';
import { nodeBounds, type NodeBounds } from '../node-tree';
import type { ElementLook, ElementOverride, LessonContent } from './lesson-types';

export interface StepView {
  /** The Diagram with this step's title/label/effect overrides. Keeps every Element. */
  document: FlowDocumentJSON;
  /** A look for every node and edge id. */
  looks: Record<string, ElementLook>;
  visibleIds: ReadonlySet<string>;
  /** Visible Elements whose `from` is this step (never on the first step). */
  enteringIds: ReadonlySet<string>;
  /** Editor mode only, for Elements that are not shown. */
  hints: Record<string, string>;
}

export const LOOK_TRANSITION = 'opacity 350ms ease';

const MUTED_OPACITY = 0.4;

export function lookStyle(look: ElementLook): { opacity: number; pointerEvents?: 'none' } {
  switch (look) {
    case 'muted': return { opacity: MUTED_OPACITY };
    case 'ghost': return { opacity: 0.18 };
    case 'gone': return { opacity: 0, pointerEvents: 'none' };
    default: return { opacity: 1 };
  }
}

export function resolveStepView(
  diagram: FlowDocumentJSON,
  content: LessonContent,
  stepId: string,
  mode: 'editor' | 'viewer',
): StepView {
  const order = new Map(content.steps.map((s, i) => [s.id, i]));
  const found = order.get(stepId);
  const index = found ?? 0;
  const step = content.steps[index];
  const overrides: Record<string, ElementOverride> = step?.overrides ?? {};
  const currentId = step?.id;

  // Why an Element is outside its own presence range, if it is.
  const presenceGap = (id: string): { from?: number; until?: number } | null => {
    const p = content.presence[id];
    const from = p?.from !== undefined ? order.get(p.from) : undefined;
    const until = p?.until !== undefined ? order.get(p.until) : undefined;
    if (from !== undefined && index < from) return { from };
    if (until !== undefined && index >= until) return { until };
    return null;
  };
  const ownVisible = (id: string): boolean => overrides[id]?.visible ?? presenceGap(id) === null;

  const nodeById = new Map<string, FlowNode>(diagram.nodes.map((n) => [n.id, n]));
  const nodeVisible = new Map<string, boolean>();
  const resolveNode = (node: FlowNode): boolean => {
    const cached = nodeVisible.get(node.id);
    if (cached !== undefined) return cached;
    let visible = true;
    const seen = new Set<string>();
    for (let cur: FlowNode | undefined = node; cur && !seen.has(cur.id); cur = cur.parentId ? nodeById.get(cur.parentId) : undefined) {
      seen.add(cur.id);
      if (!ownVisible(cur.id)) { visible = false; break; }
    }
    nodeVisible.set(node.id, visible);
    return visible;
  };
  for (const node of diagram.nodes) resolveNode(node);

  const visibleIds = new Set<string>();
  for (const node of diagram.nodes) if (nodeVisible.get(node.id)) visibleIds.add(node.id);
  for (const edge of diagram.edges) {
    if (ownVisible(edge.id) && visibleIds.has(edge.from) && visibleIds.has(edge.to)) visibleIds.add(edge.id);
  }

  const allIds = [...diagram.nodes.map((n) => n.id), ...diagram.edges.map((e) => e.id)];

  const enteringIds = new Set<string>();
  if (index > 0 && currentId !== undefined) {
    for (const id of allIds) {
      if (visibleIds.has(id) && content.presence[id]?.from === currentId) enteringIds.add(id);
    }
  }

  const emphasised = new Set<string>(enteringIds);
  for (const id of allIds) if (visibleIds.has(id) && overrides[id]?.emphasis) emphasised.add(id);

  const hiddenLook: ElementLook = mode === 'editor' ? 'ghost' : 'gone';
  const looks: Record<string, ElementLook> = {};
  for (const id of allIds) {
    if (!visibleIds.has(id)) looks[id] = hiddenLook;
    else if (emphasised.size === 0) looks[id] = 'normal';
    else looks[id] = emphasised.has(id) ? 'emphasis' : 'muted';
  }

  if (mode === 'editor') hidePiledGhosts(diagram, visibleIds, looks, (id) => {
    const gap = overrides[id]?.visible === undefined ? presenceGap(id) : null;
    if (gap?.from !== undefined) return gap.from - index;
    if (gap?.until !== undefined) return index - gap.until + 1;
    return 0;
  });

  const hints: Record<string, string> = {};
  if (mode === 'editor') {
    for (const id of allIds) {
      if (visibleIds.has(id) || looks[id] === 'gone') continue;
      const gap = overrides[id]?.visible === undefined ? presenceGap(id) : null;
      if (gap?.from !== undefined) hints[id] = `From lesson step ${gap.from + 1}`;
      else if (gap?.until !== undefined) hints[id] = `Until lesson step ${gap.until + 1}`;
      else hints[id] = 'Hidden in this lesson step';
    }
  }

  const document: FlowDocumentJSON = {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const o = overrides[node.id];
      if (!o || (o.title === undefined && o.effect === undefined)) return node;
      return {
        ...node,
        ...(o.title !== undefined ? { title: o.title } : {}),
        ...(o.effect !== undefined ? { effect: o.effect as NodeEffect } : {}),
      };
    }),
    edges: diagram.edges.map((edge): FlowEdge => {
      const o = overrides[edge.id];
      if (!o || (o.label === undefined && o.effect === undefined)) return edge;
      return {
        ...edge,
        ...(o.label !== undefined ? { label: o.label } : {}),
        ...(o.effect !== undefined ? { effect: o.effect as EdgeEffect } : {}),
      };
    }),
  };

  return { document, looks, visibleIds, enteringIds, hints };
}

const intersects = (a: NodeBounds, b: NodeBounds) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The editor draws hidden Elements as faint ghosts so the author can see
 * them — but a ghost on top of a shown block, or of another ghost, only
 * blurs both (a block that changes across steps is often several Elements
 * in one place). Such a ghost becomes 'gone' instead: among overlapping
 * ghosts the one whose step is nearest the current one is kept. A node
 * never clashes with its own group or members (a child sits inside its
 * group by design); the members of a gone group, and edges to a gone
 * node, go with it.
 */
function hidePiledGhosts(
  diagram: FlowDocumentJSON,
  visibleIds: ReadonlySet<string>,
  looks: Record<string, ElementLook>,
  stepDistance: (id: string) => number,
): void {
  const parentOf = new Map(diagram.nodes.map((node) => [node.id, node.parentId]));
  const ancestorsOf = (id: string): Set<string> => {
    const found = new Set<string>();
    for (let cur = parentOf.get(id); cur !== undefined && !found.has(cur); cur = parentOf.get(cur)) found.add(cur);
    return found;
  };
  const ancestors = new Map(diagram.nodes.map((node) => [node.id, ancestorsOf(node.id)]));
  const related = (a: string, b: string) => ancestors.get(a)?.has(b) || ancestors.get(b)?.has(a);

  const drawn = diagram.nodes.filter((node) => visibleIds.has(node.id)).map((node) => ({ id: node.id, box: nodeBounds(node) }));
  const hidden = diagram.nodes
    .filter((node) => !visibleIds.has(node.id))
    .map((node, order) => ({ node, order, distance: stepDistance(node.id) }))
    .sort((a, b) => a.distance - b.distance || a.order - b.order);
  for (const { node } of hidden) {
    const box = nodeBounds(node);
    if (drawn.some((other) => !related(other.id, node.id) && intersects(other.box, box))) looks[node.id] = 'gone';
    else drawn.push({ id: node.id, box });
  }
  for (const node of diagram.nodes) {
    if (looks[node.id] === 'ghost' && [...(ancestors.get(node.id) ?? [])].some((id) => looks[id] === 'gone')) looks[node.id] = 'gone';
  }
  for (const edge of diagram.edges) {
    if (!visibleIds.has(edge.id) && (looks[edge.from] === 'gone' || looks[edge.to] === 'gone')) looks[edge.id] = 'gone';
  }
}

/** Ids whose look keeps them out of the step (ghost or gone). */
export function hiddenElementIds(looks: Record<string, ElementLook>): Set<string> {
  return new Set(Object.keys(looks).filter((id) => looks[id] === 'ghost' || looks[id] === 'gone'));
}

/** The Diagram as the step shows it: visible Elements only, muted nodes faded. */
export function stepExportDocument(view: StepView): FlowDocumentJSON {
  const { document, visibleIds, looks } = view;
  return {
    ...document,
    nodes: document.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => (looks[n.id] === 'muted' ? { ...n, opacity: (n.opacity ?? 1) * MUTED_OPACITY } : n)),
    edges: document.edges.filter((e) => visibleIds.has(e.id)),
  };
}
