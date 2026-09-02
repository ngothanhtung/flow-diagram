import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { nodeSizeLimits, resolveNodeStyle } from './node-style';

/**
 * Layered auto-layout — the "tidy this up" command.
 *
 * A cut-down Sugiyama: rank the nodes by how far they are from a source,
 * order each rank to reduce crossings, then space them out. It is
 * deliberately not a general graph-drawing library: the diagrams this
 * app is for are directed and shallow, and a predictable grid the user
 * can then nudge beats an optimal-but-surprising arrangement.
 *
 * Only ordinary blocks are laid out. Frames, captions, the legend,
 * lifelines and activation bars are scenery — moving them would either
 * fight the user's composition or, for a bar, break the invariant that
 * it rides its lifeline's centre line.
 */

export type LayoutDirection = 'TB' | 'LR';

export interface LayoutOptions {
  direction?: LayoutDirection;
  /** Gap between adjacent ranks (down the flow). */
  rankGap?: number;
  /** Gap between neighbours within one rank (across the flow). */
  nodeGap?: number;
  /** Top-left of the laid-out block, in canvas coordinates. */
  origin?: { x: number; y: number };
  /** Restrict the layout to these node ids — everything else stays put.
   *  Edges with an endpoint outside the set are ignored for ranking. */
  only?: Set<string>;
}

const DEFAULTS = { direction: 'TB' as LayoutDirection, rankGap: 110, nodeGap: 60, origin: { x: 240, y: 160 } };

/** Node kinds auto-layout never moves — see the module comment. */
const UNLAYOUTABLE = new Set(['group', 'text', 'icon', 'legend', 'lifeline', 'activation']);

/** The new centre position for every node the layout moved. */
export type LayoutResult = Map<string, { x: number; y: number }>;

/**
 * Rank assignment by longest path from a source, which is what makes a
 * node sit *below every one of its inputs* rather than just below the
 * first. Cycles are handled by dropping the back edges found in a DFS —
 * a cyclic flow still has to lay out, and the alternative (refusing, or
 * looping forever) is worse than one edge pointing upwards.
 */
function assignRanks(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  for (const id of ids) outgoing.set(id, []);
  const acyclic: Array<{ from: string; to: string }> = [];

  // Depth-first pass marking back edges, so the graph below is a DAG.
  const state = new Map<string, 'visiting' | 'done'>();
  const adjacency = new Map<string, string[]>();
  for (const id of ids) adjacency.set(id, []);
  for (const edge of edges) {
    if (edge.from === edge.to || !ids.has(edge.from) || !ids.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
  }
  const backEdges = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 'visiting');
    for (const next of adjacency.get(id) ?? []) {
      const seen = state.get(next);
      if (seen === 'visiting') backEdges.add(`${id} ${next}`);
      else if (seen === undefined) visit(next);
    }
    state.set(id, 'done');
  };
  for (const node of nodes) if (!state.has(node.id)) visit(node.id);

  const indegree = new Map<string, number>();
  for (const id of ids) indegree.set(id, 0);
  for (const edge of edges) {
    if (edge.from === edge.to || !ids.has(edge.from) || !ids.has(edge.to)) continue;
    if (backEdges.has(`${edge.from} ${edge.to}`)) continue;
    acyclic.push({ from: edge.from, to: edge.to });
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const rank = new Map<string, number>();
  for (const id of ids) rank.set(id, 0);
  // Kahn's algorithm in topological order: each node lands one below the
  // deepest predecessor that has already been placed.
  const queue = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0);
  const pending = new Map(indegree);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of outgoing.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(id) ?? 0) + 1));
      const left = (pending.get(next) ?? 1) - 1;
      pending.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  // Any node left with a positive in-degree sits in a cycle the back-edge
  // pass didn't fully break; park it one below its lowest ranked input
  // so it still reads as "after" something.
  for (const { from, to } of acyclic) {
    if ((pending.get(to) ?? 0) > 0) rank.set(to, Math.max(rank.get(to) ?? 0, (rank.get(from) ?? 0) + 1));
  }
  return rank;
}

/**
 * Order the nodes inside each rank so edges cross as little as possible:
 * repeatedly move each node to the average position of its neighbours in
 * the rank above (then below). Four sweeps is plenty for diagrams this
 * size and keeps the result deterministic.
 */
function orderRanks(ranks: string[][], edges: Array<{ from: string; to: string }>): string[][] {
  const ordered = ranks.map((rank) => [...rank]);
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!predecessors.has(to)) predecessors.set(to, []);
    if (!successors.has(from)) successors.set(from, []);
    predecessors.get(to)!.push(from);
    successors.get(from)!.push(to);
  }

  const indexIn = (rank: string[]) => new Map(rank.map((id, index) => [id, index]));
  const barycenter = (id: string, neighbours: Map<string, string[]>, reference: Map<string, number>, fallback: number) => {
    const list = (neighbours.get(id) ?? []).map((other) => reference.get(other)).filter((value): value is number => value !== undefined);
    return list.length === 0 ? fallback : list.reduce((total, value) => total + value, 0) / list.length;
  };

  for (let sweep = 0; sweep < 4; sweep += 1) {
    const downwards = sweep % 2 === 0;
    const order = downwards ? [...ordered.keys()] : [...ordered.keys()].reverse();
    for (const index of order) {
      const reference = downwards ? ordered[index - 1] : ordered[index + 1];
      if (!reference) continue;
      const positions = indexIn(reference);
      const neighbours = downwards ? predecessors : successors;
      const scored = ordered[index].map((id, position) => ({ id, position, score: barycenter(id, neighbours, positions, position) }));
      // Ties keep their previous order, so the layout is stable.
      scored.sort((a, b) => a.score - b.score || a.position - b.position);
      ordered[index] = scored.map((entry) => entry.id);
    }
  }
  return ordered;
}

/**
 * Lay the document out and return where each moved node should go.
 * Pure — the caller decides whether to apply it.
 */
export function layoutDocument(doc: FlowDocumentJSON, options: LayoutOptions = {}): LayoutResult {
  const { direction, rankGap, nodeGap, origin } = { ...DEFAULTS, ...options };
  const movable = doc.nodes.filter((node) => !UNLAYOUTABLE.has(node.type) && (!options.only || options.only.has(node.id)));
  const result: LayoutResult = new Map();
  if (movable.length === 0) return result;

  const ids = new Set(movable.map((node) => node.id));
  const edges = doc.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const rank = assignRanks(movable, edges);

  const byRank: string[][] = [];
  for (const node of movable) {
    const index = rank.get(node.id) ?? 0;
    (byRank[index] ??= []).push(node.id);
  }
  for (let index = 0; index < byRank.length; index += 1) byRank[index] ??= [];

  const ordered = orderRanks(
    byRank,
    edges.map((edge) => ({ from: edge.from, to: edge.to })),
  );

  const sizeOf = (id: string) => {
    const node = movable.find((candidate) => candidate.id === id)!;
    const style = resolveNodeStyle(node);
    const limits = nodeSizeLimits(node);
    return { width: style.width || limits.defaultWidth, height: style.height || limits.defaultHeight };
  };

  // Down-the-flow axis is y for TB and x for LR; the across axis is the
  // other one. Writing it once this way is what keeps the two directions
  // from drifting into two near-copies of the same code.
  const alongIsY = direction === 'TB';
  const rankExtent = ordered.map((ids2) => Math.max(0, ...ids2.map((id) => (alongIsY ? sizeOf(id).height : sizeOf(id).width))));
  const rankSpan = ordered.map((ids2) => ids2.reduce((total, id, index) => total + (alongIsY ? sizeOf(id).width : sizeOf(id).height) + (index === 0 ? 0 : nodeGap), 0));
  const widestSpan = Math.max(0, ...rankSpan);

  let along = 0;
  ordered.forEach((rankIds, rankIndex) => {
    // Centre each rank against the widest one, so the drawing reads as a
    // spine rather than being flush to one edge.
    let across = (widestSpan - rankSpan[rankIndex]) / 2;
    for (const id of rankIds) {
      const size = sizeOf(id);
      const acrossSize = alongIsY ? size.width : size.height;
      const acrossCentre = across + acrossSize / 2;
      const alongCentre = along + rankExtent[rankIndex] / 2;
      result.set(id, alongIsY ? { x: origin.x + acrossCentre, y: origin.y + alongCentre } : { x: origin.x + alongCentre, y: origin.y + acrossCentre });
      across += acrossSize + nodeGap;
    }
    along += rankExtent[rankIndex] + rankGap;
  });

  return result;
}
