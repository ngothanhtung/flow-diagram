// What one Lesson step shows: which Elements are visible, how each one
// looks, and the Diagram with that step's overrides applied. Pure data, no
// React; the editor and the viewer both render from this.

import type { EdgeEffect, FlowDocumentJSON, FlowEdge, FlowNode, NodeEffect } from '../flowchart-types';
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

  const hints: Record<string, string> = {};
  if (mode === 'editor') {
    for (const id of allIds) {
      if (visibleIds.has(id)) continue;
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
