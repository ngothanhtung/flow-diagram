// Copy / paste of part of a Diagram — pure data, no React, no DOM, no store.
//
// What goes on the clipboard is a *fragment*: the selected Elements, the
// whole contents of every selected Frame, the Lines with both ends inside
// that set, and the Line styles those Lines follow. It is written as plain
// text in the shape of a Diagram JSON document plus two envelope fields:
//
//   { "kind": "x-flow-tool/fragment", "version": 1,
//     "nodes": [...], "edges": [...], "settings": { "edgeStyles": [...] } }
//
// Because the payload *is* a Diagram JSON document, the copied text also
// pastes straight into the JSON Playground, an AI chat or a text editor,
// and the paste side reads our own envelope, a full saved document and a
// bare hand-written `{ nodes, edges }` through one path.
//
// `version` exists so a later, incompatible fragment shape can be told
// apart instead of misread: a reader refuses a version newer than it knows
// (a stale tab pasting from a newer deployment) with a clear message. It
// versions the envelope only — the node and line fields inside follow
// `FlowNode`/`FlowEdge`, which only ever grow optional fields.
//
// Paste (`insertFragment`) re-ids everything, keeps the fragment's internal
// references consistent, steps the copy down-right while it would land
// exactly on existing Elements (so pasting into the same Diagram, and
// pasting again, never stacks copies), rebases Replay order after the
// target's last step, settles frame membership the way a drop does, and
// merges Line styles without duplicating or clobbering the target's own.

import { EDGE_STYLE_FIELDS, edgeStylesOf } from './edge-style';
import { validateDocument } from './document-validation';
import type { EdgeStyleClass, FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { descendantIds, findDropTarget, isSceneryNode } from './node-tree';

/** Envelope marker for fragments this app writes. */
export const FRAGMENT_KIND = 'x-flow-tool/fragment';
/** Envelope version this build writes and the newest it reads. */
export const FRAGMENT_VERSION = 1;
/** How far each successive copy is stepped down-right (data units).
 *  Same distance the inspector's Duplicate has always used. */
export const PASTE_OFFSET = 36;
/** Give up stepping after this many tries; the copy lands on the last one. */
const MAX_OFFSET_STEPS = 200;

/** Part of a Diagram, ready to be serialised or inserted. */
export interface DiagramFragment {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Only the Line styles the fragment's Lines reference. */
  edgeStyles: EdgeStyleClass[];
}

export type ParseFragmentResult = { ok: true; fragment: DiagramFragment } | { ok: false; error: string };

/**
 * The fragment for a selection, or null when none of `nodeIds` exists.
 * A selected Frame brings its whole subtree; a Line is kept only when
 * both of its ends are in the result; Line styles are trimmed to the
 * ones those Lines reference. Elements keep document order, which is
 * their paint order and the tie-break of their Replay order.
 */
export function buildFragment(doc: FlowDocumentJSON, nodeIds: readonly string[]): DiagramFragment | null {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const included = new Set<string>();
  for (const id of nodeIds) {
    const node = byId.get(id);
    if (!node) continue;
    included.add(id);
    if (node.type === 'group') for (const descendant of descendantIds(doc.nodes, id)) included.add(descendant);
  }
  if (included.size === 0) return null;
  const nodes = doc.nodes.filter((node) => included.has(node.id));
  const edges = doc.edges.filter((edge) => included.has(edge.from) && included.has(edge.to));
  const referenced = new Set(edges.map((edge) => edge.styleRef).filter((ref): ref is string => Boolean(ref)));
  const edgeStyles = edgeStylesOf(doc.settings).filter((style) => referenced.has(style.id));
  return { nodes, edges, edgeStyles };
}

/** The clipboard text for a fragment — see the envelope at the top of the file. */
export function serializeFragment(fragment: DiagramFragment): string {
  const payload = {
    kind: FRAGMENT_KIND,
    version: FRAGMENT_VERSION,
    nodes: fragment.nodes,
    edges: fragment.edges,
    ...(fragment.edgeStyles.length > 0 ? { settings: { edgeStyles: fragment.edgeStyles } } : {}),
  };
  return JSON.stringify(payload, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStyleClass(value: unknown): value is EdgeStyleClass {
  return isRecord(value) && typeof value.id === 'string' && value.id !== '' && typeof value.name === 'string';
}

/**
 * Reads pasted text as a fragment. Accepts this app's envelope, a full
 * Diagram JSON document (`settings` other than Line styles is ignored —
 * a paste adds Elements, it never changes the target's Run mode) or a
 * bare `{ nodes, edges }`, with Line styles in `settings.edgeStyles` or a
 * top-level `edgeStyles`. Anything else is an error message for a toast.
 */
export function parseFragment(text: string): ParseFragmentResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'The clipboard is empty.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'The clipboard does not hold Diagram JSON.' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'The clipboard does not hold Diagram JSON.' };
  if (parsed.kind === FRAGMENT_KIND && typeof parsed.version === 'number' && parsed.version > FRAGMENT_VERSION) {
    return { ok: false, error: 'This was copied from a newer version of X Flow Tool. Reload the page, then paste again.' };
  }
  const problem = validateDocument(parsed, { lenientEdges: true });
  if (problem) return { ok: false, error: `Not valid Diagram JSON: ${problem}` };
  const document = parsed as unknown as FlowDocumentJSON & { edgeStyles?: unknown };
  if (document.nodes.length === 0) return { ok: false, error: 'There are no Elements to paste.' };

  const rawStyles = isRecord(parsed.settings) && Array.isArray(parsed.settings.edgeStyles) ? parsed.settings.edgeStyles : Array.isArray(document.edgeStyles) ? document.edgeStyles : [];
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  return {
    ok: true,
    fragment: {
      nodes: document.nodes,
      // A Line with an end outside the fragment can't be pasted: there is
      // nothing in the target for it to attach to.
      edges: document.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
      edgeStyles: rawStyles.filter(isStyleClass),
    },
  };
}

/** Same name and same look — the only case an incoming style is reused. */
function sameStyle(a: EdgeStyleClass, b: EdgeStyleClass): boolean {
  return a.name === b.name && EDGE_STYLE_FIELDS.every((field) => a[field] === b[field]);
}

function freshStyleId(taken: Set<string>): string {
  for (let index = taken.size + 1; ; index += 1) {
    const id = `style-${index}`;
    if (!taken.has(id)) return id;
  }
}

function freshStyleName(name: string, taken: Set<string>): string {
  for (let index = 2; ; index += 1) {
    const candidate = `${name} (${index})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Adds `incoming` Line styles to `existing` without ever restyling the
 * target's own Lines:
 * - a style identical to one already there (name and every look field)
 *   is reused — the pasted Lines follow the target's copy;
 * - otherwise it is added, under a new id if its id is taken, and under a
 *   de-duplicated name ("async (2)") if its name is taken.
 * `idMap` maps every incoming id to the id the pasted Lines should use.
 */
export function mergeEdgeStyles(existing: readonly EdgeStyleClass[], incoming: readonly EdgeStyleClass[]): { styles: EdgeStyleClass[]; idMap: Map<string, string> } {
  const styles = [...existing];
  const idMap = new Map<string, string>();
  for (const style of incoming) {
    if (idMap.has(style.id)) continue;
    const match = styles.find((candidate) => sameStyle(candidate, style));
    if (match) {
      idMap.set(style.id, match.id);
      continue;
    }
    const takenIds = new Set(styles.map((item) => item.id));
    const takenNames = new Set(styles.map((item) => item.name));
    const id = takenIds.has(style.id) ? freshStyleId(takenIds) : style.id;
    const name = takenNames.has(style.name) ? freshStyleName(style.name, takenNames) : style.name;
    styles.push({ ...style, id, name });
    idMap.set(style.id, id);
  }
  return { styles, idMap };
}

export interface InsertFragmentOptions {
  /** Distance between successive copies. Defaults to `PASTE_OFFSET`. */
  offsetStep?: number;
  /** Appended to the title of each top-level copy ("Card copy"). */
  titleSuffix?: string;
  /** Unique part of minted ids. Defaults to the current time; tests pin it. */
  idStamp?: string;
}

export interface InsertFragmentResult {
  doc: FlowDocumentJSON;
  /** Ids of every inserted Element, in insertion order. */
  nodeIds: string[];
  /** Fragment node id → inserted node id. */
  idMap: Map<string, string>;
}

/** Mints `${prefix}${n}-${stamp}` ids that collide with nothing in `taken`. */
function idMinter(prefix: string, start: number, stamp: string, taken: Set<string>) {
  let counter = start;
  return () => {
    for (;;) {
      const id = `${prefix}${counter++}-${stamp}`;
      if (!taken.has(id)) {
        taken.add(id);
        return id;
      }
    }
  };
}

/**
 * The smallest multiple of `step` (0 included) at which no fragment
 * Element lands exactly on an Element already in the Diagram. Pasting
 * into another Diagram therefore keeps the copied coordinates; pasting
 * into the same one steps once past the originals; pasting again steps
 * past the previous copy too. Derived from the document alone, so it
 * needs no paste counter and stays right across undo.
 */
function pasteOffset(existing: readonly FlowNode[], fragment: readonly FlowNode[], step: number): number {
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const occupied = new Set(existing.map((node) => key(node.position.x, node.position.y)));
  for (let index = 0; index < MAX_OFFSET_STEPS; index += 1) {
    const delta = index * step;
    if (!fragment.some((node) => occupied.has(key(node.position.x + delta, node.position.y + delta)))) return delta;
  }
  return MAX_OFFSET_STEPS * step;
}

/**
 * Inserts a fragment into `doc` and returns the new document plus the
 * inserted ids. Never mutates either input.
 *
 * - Every Element and Line gets a new id; `parentId`, `from`/`to` and
 *   `styleRef` are remapped so the copy only references itself.
 * - A Line whose ends aren't both in the fragment is dropped.
 * - Positions are offset (see `pasteOffset`).
 * - Replay order keeps its relative shape but starts after the target's
 *   last step, the way a newly drawn Element goes last (`max + 1`).
 * - A top-level copy joins whatever Frame it lands in, exactly like a
 *   drop (`findDropTarget`); copied Frame members stay in their copied Frame.
 * - Line styles merge through `mergeEdgeStyles`.
 */
export function insertFragment(doc: FlowDocumentJSON, fragment: DiagramFragment, options: InsertFragmentOptions = {}): InsertFragmentResult {
  const stamp = options.idStamp ?? Date.now().toString(36);
  const step = options.offsetStep ?? PASTE_OFFSET;
  const fragmentIds = new Set(fragment.nodes.map((node) => node.id));
  const keptEdges = fragment.edges.filter((edge) => fragmentIds.has(edge.from) && fragmentIds.has(edge.to));

  const nextNodeId = idMinter('n', doc.nodes.length + 1, stamp, new Set(doc.nodes.map((node) => node.id)));
  const nextEdgeId = idMinter('e', doc.edges.length + 1, stamp, new Set(doc.edges.map((edge) => edge.id)));
  const idMap = new Map<string, string>();
  for (const node of fragment.nodes) idMap.set(node.id, nextNodeId());

  const delta = pasteOffset(doc.nodes, fragment.nodes, step);

  // Replay order: resolve each fragment Element's order the way the
  // Replay does (explicit, else its position among the steps), then shift
  // the whole set so its first step lands right after the target's last.
  const resolvedOrder = new Map<string, number>();
  let stepIndex = 0;
  for (const node of fragment.nodes) {
    const explicit = node.sortOrder && node.sortOrder > 0 ? node.sortOrder : undefined;
    if (!isSceneryNode(node)) stepIndex += 1;
    const order = explicit ?? (isSceneryNode(node) ? undefined : stepIndex);
    if (order !== undefined) resolvedOrder.set(node.id, order);
  }
  const explicitEdgeOrders = keptEdges.map((edge) => edge.sortOrder).filter((order): order is number => order !== undefined && order > 0);
  const fragmentOrders = [...resolvedOrder.values(), ...explicitEdgeOrders];
  const targetLast = Math.max(0, ...doc.nodes.map((node, index) => node.sortOrder ?? index + 1));
  const orderShift = fragmentOrders.length > 0 ? targetLast + 1 - Math.min(...fragmentOrders) : 0;

  const roots = new Set(fragment.nodes.filter((node) => !node.parentId || !fragmentIds.has(node.parentId)).map((node) => node.id));
  const copies: FlowNode[] = fragment.nodes.map((node) => {
    const order = resolvedOrder.get(node.id);
    const copy: FlowNode = {
      ...node,
      id: idMap.get(node.id)!,
      position: { x: node.position.x + delta, y: node.position.y + delta },
      parentId: roots.has(node.id) ? undefined : idMap.get(node.parentId!),
      sortOrder: order === undefined ? undefined : order + orderShift,
    };
    if (roots.has(node.id) && options.titleSuffix && node.title) copy.title = `${node.title}${options.titleSuffix}`;
    if (copy.parentId === undefined) delete copy.parentId;
    if (copy.sortOrder === undefined) delete copy.sortOrder;
    return copy;
  });

  // Frame membership for the top-level copies is decided like a drop.
  // One at a time, against the list as updated so far: a copy that just
  // joined another pasted Frame is that Frame's descendant, which
  // `findDropTarget` then refuses as a parent for it — so two overlapping
  // pasted Frames can't end up inside each other.
  const rootCopyIds = new Set([...roots].map((id) => idMap.get(id)!));
  let nodes = [...doc.nodes, ...copies];
  for (const copy of copies) {
    if (!rootCopyIds.has(copy.id)) continue;
    const target = findDropTarget(nodes, copy.id, copy.position);
    if (target) nodes = nodes.map((node) => (node.id === copy.id ? { ...node, parentId: target.id } : node));
  }

  const existingStyles = edgeStylesOf(doc.settings);
  const referenced = new Set(keptEdges.map((edge) => edge.styleRef).filter((ref): ref is string => Boolean(ref)));
  const { styles, idMap: styleIdMap } = mergeEdgeStyles(
    existingStyles,
    fragment.edgeStyles.filter((style) => referenced.has(style.id)),
  );
  const existingStyleIds = new Set(existingStyles.map((style) => style.id));

  const edgeCopies: FlowEdge[] = keptEdges.map((edge) => {
    const copy: FlowEdge = { ...edge, id: nextEdgeId(), from: idMap.get(edge.from)!, to: idMap.get(edge.to)! };
    if (edge.sortOrder !== undefined && edge.sortOrder > 0) copy.sortOrder = edge.sortOrder + orderShift;
    if (edge.styleRef) {
      // A reference the fragment didn't define can still name one of the
      // target's own styles (hand-written JSON); otherwise it would dangle.
      const ref = styleIdMap.get(edge.styleRef) ?? (existingStyleIds.has(edge.styleRef) ? edge.styleRef : undefined);
      if (ref) copy.styleRef = ref;
      else delete copy.styleRef;
    }
    return copy;
  });

  const stylesChanged = styles.length !== existingStyles.length;
  return {
    doc: {
      ...doc,
      nodes,
      edges: [...doc.edges, ...edgeCopies],
      ...(stylesChanged ? { settings: { ...doc.settings, edgeStyles: styles } } : {}),
    },
    nodeIds: copies.map((copy) => copy.id),
    idMap,
  };
}
