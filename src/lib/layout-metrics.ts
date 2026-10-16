// Layout quality, measured — the PRD's acceptance criteria for
// Auto-layout (v0.3 §4.3) turned into numbers, so the reference set in
// `seed/layout-reference/` can be checked by Vitest instead of by eye
// alone.
//
// Everything here reads the Diagram the way the canvas paints it: Lines
// are resolved against their Line style and routed by the same
// `buildEdgeGeometry` the canvas uses, then their rendered path (`d`,
// rounded corners and curves included) is sampled. Measuring an idealised
// route instead would pass a layout whose real Lines still cut through
// Blocks.

import { buildEdgeGeometry } from '@/components/edge-geometry';
import { resolveDocumentStyles } from './edge-style';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { samplePathPoints } from './image-export';
import { endpointsOfLine } from './line-geometry';
import { resolveNodeStyle } from './node-style';
import { isSceneryNode } from './node-tree';

export type MetricsDirection = 'TB' | 'LR';

interface Point {
  x: number;
  y: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LayoutMetrics {
  /** (Line, Element) pairs where the Line's rendered route passes through
   *  an Element other than its own two ends. Frames and Free lines are
   *  not obstacles — Lines are meant to cross into a Frame. */
  lineThroughElement: number;
  /** Points where two Lines' rendered routes cross. Lines running along
   *  each other (a fan-out sharing a port) or touching are not crossings. */
  crossings: number;
  /** Lines u→v between sibling Blocks where u has exactly one outgoing
   *  Line and v exactly one incoming one, pointing forward in the
   *  direction measured. */
  chainLinks: number;
  /** Of those, how many have their two Blocks off a common axis line. */
  misalignedChainLinks: number;
  /** Largest across-axis offset between the centres of a chain link. */
  maxChainDeviation: number;
  /** Pairs of Elements whose boxes overlap (ancestor/descendant pairs —
   *  a Frame and what it contains — excepted). */
  overlaps: number;
  /** Elements not wholly inside the Frame they belong to. */
  containmentViolations: number;
  /** Text, Icon and Free line Elements whose geometry changed. Only
   *  meaningful when a `before` document is given. */
  sceneryMoved: number;
  /** Human-readable detail for each counted problem, for test messages. */
  problems: string[];
}

const EPSILON = 1e-6;

function boxOf(node: FlowNode): Box {
  const { width, height } = resolveNodeStyle(node);
  return {
    left: node.position.x - width / 2,
    right: node.position.x + width / 2,
    top: node.position.y - height / 2,
    bottom: node.position.y + height / 2,
  };
}

function shrink(box: Box, by: number): Box {
  return { left: box.left + by, right: box.right - by, top: box.top + by, bottom: box.bottom - by };
}

/** Liang–Barsky: does segment a→b pass through the (open) box? */
function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  if (box.right <= box.left || box.bottom <= box.top) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < EPSILON) return q > 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, a.x - box.left)) return false;
  if (!clip(dx, box.right - a.x)) return false;
  if (!clip(-dy, a.y - box.top)) return false;
  if (!clip(dy, box.bottom - a.y)) return false;
  return t1 - t0 > EPSILON;
}

/** Proper crossing of two segments: a single point strictly inside both. */
function segmentCrossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  const lengths = Math.hypot(rx, ry) * Math.hypot(sx, sy);
  // Parallel or collinear: running alongside is not crossing.
  if (lengths < EPSILON || Math.abs(denominator) / lengths < 1e-4) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
  const tolerance = 1e-4;
  if (t <= tolerance || t >= 1 - tolerance || u <= tolerance || u >= 1 - tolerance) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function isAncestor(byId: Map<string, FlowNode>, ancestorId: string, node: FlowNode): boolean {
  const seen = new Set<string>();
  let current = node.parentId ? byId.get(node.parentId) : undefined;
  while (current && !seen.has(current.id)) {
    if (current.id === ancestorId) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function freeLineSegment(node: FlowNode): [Point, Point] {
  const { width, height } = resolveNodeStyle(node);
  const { start, end } = endpointsOfLine(node, width, height);
  return [start, end];
}

function boxesOverlap(a: Box, b: Box, tolerance = 0.5): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance;
}

/** The rendered route of every drawable Line, as a sampled polyline. */
export function renderedRoutes(doc: FlowDocumentJSON): Map<string, Point[]> {
  const resolved = resolveDocumentStyles(doc);
  const byId = new Map(resolved.nodes.map((node) => [node.id, node]));
  const routes = new Map<string, Point[]>();
  for (const edge of resolved.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to || from.id === to.id) continue;
    routes.set(edge.id, samplePathPoints(buildEdgeGeometry(edge, from, to).d));
  }
  return routes;
}

function along(point: Point, direction: MetricsDirection) {
  return direction === 'TB' ? point.y : point.x;
}

function across(point: Point, direction: MetricsDirection) {
  return direction === 'TB' ? point.x : point.y;
}

/**
 * The 1-in/1-out chain links of a Diagram: a Line u→v between two sibling
 * Blocks where u has no other outgoing Line and v no other incoming one.
 * Degrees count every Line in the Diagram, so a Block that also feeds
 * something in another Frame is not a chain link.
 */
export function chainLinks(doc: FlowDocumentJSON): FlowEdge[] {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const usable = doc.edges.filter((edge) => edge.from !== edge.to && byId.has(edge.from) && byId.has(edge.to));
  for (const edge of usable) {
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  return usable.filter((edge) => {
    const from = byId.get(edge.from)!;
    const to = byId.get(edge.to)!;
    if (isSceneryNode(from) || isSceneryNode(to)) return false;
    if ((from.parentId ?? null) !== (to.parentId ?? null)) return false;
    return outDegree.get(from.id) === 1 && inDegree.get(to.id) === 1;
  });
}

function sceneryChanged(before: FlowNode, after: FlowNode): boolean {
  return (
    before.position.x !== after.position.x ||
    before.position.y !== after.position.y ||
    before.width !== after.width ||
    before.height !== after.height ||
    before.lineStart !== after.lineStart ||
    before.lineFlip !== after.lineFlip
  );
}

/**
 * Every metric at once. `direction` decides which way "forward" and
 * "across" point for chain straightness; `before` (the Diagram as it was)
 * is needed only for scenery displacement.
 */
export function measureLayout(doc: FlowDocumentJSON, direction: MetricsDirection, before?: FlowDocumentJSON): LayoutMetrics {
  const problems: string[] = [];
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const routes = renderedRoutes(doc);
  const edgesById = new Map(doc.edges.map((edge) => [edge.id, edge]));

  // (i) Lines through Elements.
  const obstacles = doc.nodes.filter((node) => node.type !== 'group' && node.type !== 'line').map((node) => ({ node, box: shrink(boxOf(node), 1) }));
  let lineThroughElement = 0;
  for (const [edgeId, points] of routes) {
    const edge = edgesById.get(edgeId)!;
    for (const { node, box } of obstacles) {
      if (node.id === edge.from || node.id === edge.to) continue;
      for (let index = 1; index < points.length; index += 1) {
        if (segmentHitsBox(points[index - 1], points[index], box)) {
          lineThroughElement += 1;
          problems.push(`line ${edgeId} (${edge.from}→${edge.to}) passes through ${node.id}`);
          break;
        }
      }
    }
  }

  // (ii) Line–Line crossings.
  let crossings = 0;
  const entries = [...routes.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [idA, a] = entries[i];
      const [idB, b] = entries[j];
      const found: Point[] = [];
      for (let p = 1; p < a.length; p += 1) {
        for (let q = 1; q < b.length; q += 1) {
          const hit = segmentCrossing(a[p - 1], a[p], b[q - 1], b[q]);
          // A crossing that lands on a sample joint is seen by two
          // segment pairs; count the point once.
          if (hit && !found.some((other) => Math.hypot(other.x - hit.x, other.y - hit.y) < 2)) found.push(hit);
        }
      }
      if (found.length > 0) {
        crossings += found.length;
        problems.push(`lines ${idA} and ${idB} cross ${found.length}×`);
      }
    }
  }

  // (iii) Chain straightness.
  const links = chainLinks(doc).filter((edge) => along(byId.get(edge.to)!.position, direction) > along(byId.get(edge.from)!.position, direction));
  let misalignedChainLinks = 0;
  let maxChainDeviation = 0;
  for (const edge of links) {
    const deviation = Math.abs(across(byId.get(edge.to)!.position, direction) - across(byId.get(edge.from)!.position, direction));
    maxChainDeviation = Math.max(maxChainDeviation, deviation);
    if (deviation > 0.5) {
      misalignedChainLinks += 1;
      problems.push(`chain ${edge.from}→${edge.to} is ${Math.round(deviation)}px off axis`);
    }
  }

  // (iv) Overlapping Elements.
  let overlaps = 0;
  for (let i = 0; i < doc.nodes.length; i += 1) {
    for (let j = i + 1; j < doc.nodes.length; j += 1) {
      const a = doc.nodes[i];
      const b = doc.nodes[j];
      if (isAncestor(byId, a.id, b) || isAncestor(byId, b.id, a)) continue;
      let hit: boolean;
      if (a.type === 'line' && b.type === 'line') continue;
      if (a.type === 'line' || b.type === 'line') {
        const [line, other] = a.type === 'line' ? [a, b] : [b, a];
        const [start, end] = freeLineSegment(line);
        hit = segmentHitsBox(start, end, shrink(boxOf(other), 0.5));
      } else {
        hit = boxesOverlap(boxOf(a), boxOf(b));
      }
      if (hit) {
        overlaps += 1;
        problems.push(`${a.id} overlaps ${b.id}`);
      }
    }
  }

  // (v) Frame containment.
  let containmentViolations = 0;
  for (const node of doc.nodes) {
    const frame = node.parentId ? byId.get(node.parentId) : undefined;
    if (!frame || frame.type !== 'group') continue;
    const outer = boxOf(frame);
    let inner: Box;
    if (node.type === 'line') {
      const [start, end] = freeLineSegment(node);
      inner = { left: Math.min(start.x, end.x), right: Math.max(start.x, end.x), top: Math.min(start.y, end.y), bottom: Math.max(start.y, end.y) };
    } else inner = boxOf(node);
    const tolerance = 0.5;
    if (inner.left < outer.left - tolerance || inner.right > outer.right + tolerance || inner.top < outer.top - tolerance || inner.bottom > outer.bottom + tolerance) {
      containmentViolations += 1;
      problems.push(`${node.id} sticks out of its frame ${frame.id}`);
    }
  }

  // (vi) Scenery displacement.
  let sceneryMoved = 0;
  if (before) {
    const after = byId;
    for (const node of before.nodes) {
      if (!isSceneryNode(node) || node.type === 'group') continue;
      const moved = after.get(node.id);
      if (!moved || sceneryChanged(node, moved)) {
        sceneryMoved += 1;
        problems.push(`scenery ${node.id} moved`);
      }
    }
  }

  return {
    lineThroughElement,
    crossings,
    chainLinks: links.length,
    misalignedChainLinks,
    maxChainDeviation: Math.round(maxChainDeviation * 10) / 10,
    overlaps,
    containmentViolations,
    sceneryMoved,
    problems,
  };
}
