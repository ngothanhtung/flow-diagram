// Shared geometry for edge rendering. Centralised so the static
// "ghost" preview during link-drawing and the live animated edge
// use the same curve — when a new edge snaps in, there's no jump.

import { SHAPES, type ShapeSpec } from '@/lib/node-style';
import { resolveNodeStyle } from '@/lib/node-style';
import type { ConnectionSide, FlowEdge, FlowNode, NodeShape } from '@/lib/flowchart-types';

/**
 * Half-width of the shape's bounding box. Kept as an alias for
 * `NODE_BOUNDING_RADIUS` so existing imports (`NODE_RADIUS` in
 * FlowNodeCard) continue to work after the per-shape refactor.
 */
export const NODE_RADIUS = 56;
export const NODE_BOUNDING_RADIUS = NODE_RADIUS;

/**
 * Where the in-port sits on a given shape, expressed as an offset
 * from the node's center, in data coords. This is the same point
 * FlowNodeCard uses to position the visible port dot.
 */
export function portAnchor(shape: NodeShape, side: ConnectionSide): { x: number; y: number } {
  const spec: ShapeSpec = SHAPES[shape];
  return spec.anchors[side];
}

/** Resolve a node's scaled and rotated anchor vector. */
export function nodePortAnchor(node: FlowNode, side: ConnectionSide): { x: number; y: number } {
  const style = resolveNodeStyle(node);
  const base = style.shapeSpec.anchors[side];
  const scaledX = base.x * (style.width / (NODE_RADIUS * 2));
  const scaledY = base.y * (style.height / (NODE_RADIUS * 2));
  const radians = (style.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: scaledX * cos - scaledY * sin,
    y: scaledX * sin + scaledY * cos,
  };
}

/**
 * Which sides two nodes face each other on, when the edge itself doesn't
 * say. A fixed right→left pair — what this used to be — is right for a
 * left-to-right diagram and wrong for every other arrangement: in a
 * top-to-bottom flow it makes each line leave the source's right edge,
 * double back around the source, and come in the target's left, which
 * reads as tangled no matter how well the nodes are placed. Choosing the
 * dominant axis between the two centres instead means the line leaves
 * towards where it is going.
 */
function facingSides(from: FlowNode, to: FlowNode): { fromSide: ConnectionSide; toSide: ConnectionSide } {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { fromSide: 'right', toSide: 'left' } : { fromSide: 'left', toSide: 'right' };
  }
  return dy >= 0 ? { fromSide: 'bottom', toSide: 'top' } : { fromSide: 'top', toSide: 'bottom' };
}

/** Build the route for an existing edge from its selected node ports. */
export function buildEdgeGeometry(edge: FlowEdge, from: FlowNode, to: FlowNode) {
  const facing = facingSides(from, to);
  const fromSide = edge.fromSide ?? from.connectionPoints?.output ?? facing.fromSide;
  const toSide = edge.toSide ?? to.connectionPoints?.input ?? facing.toSide;
  const fromAnchor = nodePortAnchor(from, fromSide);
  const toAnchor = nodePortAnchor(to, toSide);
  const bendPoints = edge.bendPoints?.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  switch (edge.routing ?? 'smooth-step') {
    case 'straight':
      return buildStraightPath(from.position, fromAnchor, to.position, toAnchor);
    case 'smooth-step':
      if (bendPoints?.length) {
        return buildCustomPolylinePath(from.position, fromAnchor, to.position, toAnchor, bendPoints, true);
      }
      return buildSmoothStepPath(from.position, fromAnchor, to.position, toAnchor, fromSide, toSide);
    case 'orthogonal':
      if (bendPoints?.length) {
        return buildCustomPolylinePath(from.position, fromAnchor, to.position, toAnchor, bendPoints, false);
      }
      return buildOrthogonalPath(from.position, fromAnchor, to.position, toAnchor, fromSide, toSide);
    case 'curved':
      return buildPath(from.position, fromAnchor, to.position, toAnchor);
  }
}

/**
 * Compute an SVG path between two node centers that:
 *  - starts at the FROM node's out-port and ends at the TO node's
 *    in-port, so the line always lands exactly on the silhouette
 *    regardless of which shape the endpoint is using
 *  - uses a gentle cubic curve so multiple edges fanning out from a
 *    decision node read as branches rather than overlapping lines
 */
export function buildPath(
  fromCenter: { x: number; y: number },
  fromAnchor: { x: number; y: number },
  toCenter: { x: number; y: number },
  toAnchor: { x: number; y: number },
): {
  d: string;
  mid: { x: number; y: number };
  midTangent: Point;
  start: { x: number; y: number };
  end: { x: number; y: number };
  startAngle: number;
  angle: number;
  length: number;
  points: Point[] | undefined;
} {
  // Absolute positions of the two endpoints on their respective shapes.
  const startX = fromCenter.x + fromAnchor.x;
  const startY = fromCenter.y + fromAnchor.y;
  const endX = toCenter.x + toAnchor.x;
  const endY = toCenter.y + toAnchor.y;
  const distance = Math.hypot(endX - startX, endY - startY);
  const strength = Math.max(42, Math.min(150, distance * 0.42));
  const fromLength = Math.max(1, Math.hypot(fromAnchor.x, fromAnchor.y));
  const toLength = Math.max(1, Math.hypot(toAnchor.x, toAnchor.y));
  const cp1x = startX + (fromAnchor.x / fromLength) * strength;
  const cp1y = startY + (fromAnchor.y / fromLength) * strength;
  // The second control point sits outside the destination on its
  // selected side, making the curve enter the port perpendicularly.
  const cp2x = endX + (toAnchor.x / toLength) * strength;
  const cp2y = endY + (toAnchor.y / toLength) * strength;

  const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  // The point/tangent at half arc length of the curve, used to anchor
  // edge labels on the path itself rather than the endpoint chord.
  const midTangent = cubicTangentAt(0.5);
  const mid = cubicPointAt(0.5);
  // Rounding keeps the SVG transform byte-identical during server and
  // client rendering (engines can otherwise differ at ~1e-15).
  const angle = Math.round(Math.atan2(endY - cp2y, endX - cp2x) * (180 / Math.PI) * 1000) / 1000;

  const startAngle = Math.round(Math.atan2(startY - cp1y, startX - cp1x) * (180 / Math.PI) * 1000) / 1000;

  return {
    d,
    mid,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    startAngle,
    angle,
    length: approximateCubicLength({ x: startX, y: startY }, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, { x: endX, y: endY }),
    midTangent,
    points: undefined as Point[] | undefined,
  };

  function cubicPointAt(t: number): Point {
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * startX + 3 * inverse ** 2 * t * cp1x + 3 * inverse * t ** 2 * cp2x + t ** 3 * endX,
      y: inverse ** 3 * startY + 3 * inverse ** 2 * t * cp1y + 3 * inverse * t ** 2 * cp2y + t ** 3 * endY,
    };
  }

  function cubicTangentAt(t: number): Point {
    const inverse = 1 - t;
    const dx = 3 * inverse ** 2 * (cp1x - startX) + 6 * inverse * t * (cp2x - cp1x) + 3 * t ** 2 * (endX - cp2x);
    const dy = 3 * inverse ** 2 * (cp1y - startY) + 6 * inverse * t * (cp2y - cp1y) + 3 * t ** 2 * (endY - cp2y);
    const magnitude = Math.hypot(dx, dy) || 1;
    return { x: dx / magnitude, y: dy / magnitude };
  }
}

/** Architectural connector with right-angle segments. */
export function buildOrthogonalPath(fromCenter: { x: number; y: number }, fromAnchor: { x: number; y: number }, toCenter: { x: number; y: number }, toAnchor: { x: number; y: number }, fromSide: ConnectionSide, toSide: ConnectionSide) {
  const points = orthogonalPoints(fromCenter, fromAnchor, toCenter, toAnchor, fromSide, toSide);
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return connectorGeometry(d, points[0], points.at(-1)!, fromAnchor, toAnchor, polylineLength(points), points);
}

/** Right-angle routing whose corners are rounded with quadratic curves. */
export function buildSmoothStepPath(fromCenter: { x: number; y: number }, fromAnchor: { x: number; y: number }, toCenter: { x: number; y: number }, toAnchor: { x: number; y: number }, fromSide: ConnectionSide, toSide: ConnectionSide) {
  const points = orthogonalPoints(fromCenter, fromAnchor, toCenter, toAnchor, fromSide, toSide);
  const d = roundedPolyline(points, 18);
  return connectorGeometry(d, points[0], points.at(-1)!, fromAnchor, toAnchor, polylineLength(points), points);
}

/**
 * Label anchoring must follow the drawn path, not the endpoint chord —
 * on bent routes those diverge. Sample a point at `ratio` of the path
 * length plus the segment direction there, for any routing style:
 * polylines (orthogonal / smooth-step / custom bends) walk their
 * points, straight and curved fall back to their endpoint geometry.
 */
export function pointAlongEdgeGeometry(
  geometry: {
    start: Point;
    end: Point;
    midTangent?: Point;
    points?: Point[];
  },
  ratio: number,
): { point: Point; direction: Point } {
  const { start, end, points } = geometry;
  const clamped = Math.max(0, Math.min(1, ratio));
  if (points && points.length >= 2) {
    const total = polylineLength(points);
    const target = total * clamped;
    let travelled = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (travelled + segment >= target || index === points.length - 1) {
        const local = segment <= 0.001 ? 0 : (target - travelled) / segment;
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const magnitude = Math.hypot(dx, dy) || 1;
        return {
          point: {
            x: previous.x + dx * Math.max(0, Math.min(1, local)),
            y: previous.y + dy * Math.max(0, Math.min(1, local)),
          },
          direction: { x: dx / magnitude, y: dy / magnitude },
        };
      }
      travelled += segment;
    }
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const direction = geometry.midTangent ?? { x: dx / magnitude, y: dy / magnitude };
  return {
    point: {
      x: start.x + dx * clamped,
      y: start.y + dy * clamped,
    },
    direction,
  };
}

/** A persisted route whose intermediate points can be dragged on the canvas. */
function buildCustomPolylinePath(fromCenter: Point, fromAnchor: Point, toCenter: Point, toAnchor: Point, bendPoints: Point[], rounded: boolean) {
  const start = {
    x: fromCenter.x + fromAnchor.x,
    y: fromCenter.y + fromAnchor.y,
  };
  const end = {
    x: toCenter.x + toAnchor.x,
    y: toCenter.y + toAnchor.y,
  };
  const points = [start, ...bendPoints, end];
  const d = rounded ? roundedPolyline(points, 18) : points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const next = points[1];
  const previous = points.at(-2)!;
  return {
    d,
    mid: polylineMidpoint(points),
    midTangent: polylineTangentAt(points, 0.5),
    start,
    end,
    startAngle: toDegrees(Math.atan2(start.y - next.y, start.x - next.x)),
    angle: toDegrees(Math.atan2(end.y - previous.y, end.x - previous.x)),
    length: polylineLength(points),
    points,
  };
}

/** Direct point-to-point connector. */
export function buildStraightPath(fromCenter: { x: number; y: number }, fromAnchor: { x: number; y: number }, toCenter: { x: number; y: number }, toAnchor: { x: number; y: number }) {
  const start = {
    x: fromCenter.x + fromAnchor.x,
    y: fromCenter.y + fromAnchor.y,
  };
  const end = {
    x: toCenter.x + toAnchor.x,
    y: toCenter.y + toAnchor.y,
  };
  const angle = toDegrees(Math.atan2(end.y - start.y, end.x - start.x));
  return {
    d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    midTangent: (() => {
      const magnitude = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      return { x: (end.x - start.x) / magnitude, y: (end.y - start.y) / magnitude };
    })(),
    start,
    end,
    startAngle: toDegrees((angle * Math.PI) / 180 + Math.PI),
    angle,
    length: Math.hypot(end.x - start.x, end.y - start.y),
    points: undefined as Point[] | undefined,
  };
}

type Point = { x: number; y: number };

/** Outward-facing unit normal for a port side, e.g. 'right' leaves the node heading +x. */
function sideNormal(side: ConnectionSide): Point {
  switch (side) {
    case 'right':
      return { x: 1, y: 0 };
    case 'left':
      return { x: -1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
  }
}

/** Drop consecutive points that coincide, so zero-length segments don't reach the renderer. */
function dedupeConsecutive(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.01) {
      result.push(point);
    }
  }
  return result;
}

/**
 * Right-angle route between two ports that respects BOTH endpoints'
 * facing direction, not just the source's. Each port gets a short
 * straight lead-out/lead-in along its own normal, and those leads are
 * joined with a corner (or lane) chosen from the combination of the
 * two directions — so a line into a bottom-facing port always arrives
 * travelling vertically, never doglegs sideways into the node.
 */
function orthogonalPoints(fromCenter: Point, fromAnchor: Point, toCenter: Point, toAnchor: Point, fromSide: ConnectionSide, toSide: ConnectionSide): Point[] {
  const start = { x: fromCenter.x + fromAnchor.x, y: fromCenter.y + fromAnchor.y };
  const end = { x: toCenter.x + toAnchor.x, y: toCenter.y + toAnchor.y };

  const LEAD = 28;
  const fromN = sideNormal(fromSide);
  const toN = sideNormal(toSide);
  const p1 = { x: start.x + fromN.x * LEAD, y: start.y + fromN.y * LEAD };
  const p2 = { x: end.x + toN.x * LEAD, y: end.y + toN.y * LEAD };

  const fromHorizontal = fromN.x !== 0;
  const toHorizontal = toN.x !== 0;
  const sameDirection = fromN.x === toN.x && fromN.y === toN.y;

  let mid: Point[];
  if (fromHorizontal && toHorizontal) {
    if (sameDirection) {
      const laneX = fromN.x > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x);
      mid = [
        { x: laneX, y: p1.y },
        { x: laneX, y: p2.y },
      ];
    } else if (Math.abs(p1.y - p2.y) < 0.01) {
      mid = [];
    } else {
      const laneX = (p1.x + p2.x) / 2;
      mid = [
        { x: laneX, y: p1.y },
        { x: laneX, y: p2.y },
      ];
    }
  } else if (!fromHorizontal && !toHorizontal) {
    if (sameDirection) {
      const laneY = fromN.y > 0 ? Math.max(p1.y, p2.y) : Math.min(p1.y, p2.y);
      mid = [
        { x: p1.x, y: laneY },
        { x: p2.x, y: laneY },
      ];
    } else if (Math.abs(p1.x - p2.x) < 0.01) {
      mid = [];
    } else {
      const laneY = (p1.y + p2.y) / 2;
      mid = [
        { x: p1.x, y: laneY },
        { x: p2.x, y: laneY },
      ];
    }
  } else if (fromHorizontal && !toHorizontal) {
    mid = [{ x: p2.x, y: p1.y }];
  } else {
    mid = [{ x: p1.x, y: p2.y }];
  }

  return dedupeConsecutive([start, p1, ...mid, p2, end]);
}

function roundedPolyline(points: Point[], radius: number): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const beforeLength = Math.hypot(previous.x - current.x, previous.y - current.y);
    const afterLength = Math.hypot(next.x - current.x, next.y - current.y);
    if (beforeLength < 0.001 || afterLength < 0.001) continue;
    const beforeRatio = Math.min(radius, beforeLength / 2) / beforeLength;
    const afterRatio = Math.min(radius, afterLength / 2) / afterLength;
    const before = {
      x: current.x + (previous.x - current.x) * beforeRatio,
      y: current.y + (previous.y - current.y) * beforeRatio,
    };
    const after = {
      x: current.x + (next.x - current.x) * afterRatio,
      y: current.y + (next.y - current.y) * afterRatio,
    };
    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const end = points.at(-1)!;
  return `${d} L ${end.x} ${end.y}`;
}

function connectorGeometry(d: string, start: Point, end: Point, fromAnchor: Point, toAnchor: Point, length: number, points?: Point[]) {
  return {
    d,
    mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    midTangent: points ? polylineTangentAt(points, 0.5) : undefined,
    start,
    end,
    startAngle: toDegrees(Math.atan2(-fromAnchor.y, -fromAnchor.x)),
    angle: toDegrees(Math.atan2(-toAnchor.y, -toAnchor.x)),
    length,
    points,
  };
}

/** Unit direction of the segment at `ratio` of a polyline's length. */
function polylineTangentAt(points: Point[], ratio: number): Point {
  const total = polylineLength(points);
  const target = total * Math.max(0, Math.min(1, ratio));
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (travelled + segment >= target || index === points.length - 1) {
      const magnitude = segment || 1;
      return { x: (point.x - previous.x) / magnitude, y: (point.y - previous.y) / magnitude };
    }
    travelled += segment;
  }
  return { x: 1, y: 0 };
}

function polylineMidpoint(points: Point[]): Point {
  const total = polylineLength(points);
  if (total <= 0.001) return points[0];
  const target = total / 2;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (travelled + segment >= target) {
      const ratio = segment <= 0.001 ? 0 : (target - travelled) / segment;
      return {
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
      };
    }
    travelled += segment;
  }
  return points.at(-1)!;
}

function polylineLength(points: Point[]): number {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function approximateCubicLength(start: Point, controlA: Point, controlB: Point, end: Point): number {
  const segments = 16;
  let length = 0;
  let previous = start;
  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const inverse = 1 - t;
    const point = {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y,
    };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function toDegrees(radians: number): number {
  return Math.round(radians * (180 / Math.PI) * 1000) / 1000;
}
