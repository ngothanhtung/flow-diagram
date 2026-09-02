import type { FlowNode, LineCorner } from './flowchart-types';

/**
 * Free line (`type: 'line'`) geometry: the two conversions between the
 * node's bounding box and the segment's two endpoints.
 *
 * A free line is placed like every other node — a `position` centre plus
 * `width`/`height` — so it inherits dragging, group membership, culling
 * and snapping without a second absolute point that every mover would
 * have to keep in sync. What makes it a *line* rather than a box is
 * `lineStart`: which corner of that box the start endpoint sits on, the
 * end endpoint being the opposite corner.
 *
 * Both directions live here because they are inverses and drifting apart
 * would show up as a line that jumps the moment you touch an endpoint:
 * `endpointsOfLine` is what the canvas paints and what the endpoint
 * handles sit on, `lineGeometryFromEndpoints` is what a finished drag (or
 * a fresh draw gesture) turns two points back into.
 */

export interface Point {
  x: number;
  y: number;
}

/** Unit offsets of each corner from the box centre. */
const CORNER_SIGNS: Record<LineCorner, Point> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
};

const OPPOSITE: Record<LineCorner, LineCorner> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

/** The corner opposite this one — where the other endpoint sits. */
export function oppositeCorner(corner: LineCorner): LineCorner {
  return OPPOSITE[corner];
}

/**
 * Where the line's start endpoint sits, resolved. Reads `lineStart`,
 * falling back to the legacy `lineFlip` boolean so a document saved
 * before the corner field renders exactly as it did.
 */
export function lineCornerOf(node: Pick<FlowNode, 'lineStart' | 'lineFlip'>): LineCorner {
  return node.lineStart ?? (node.lineFlip ? 'ne' : 'nw');
}

/** The two endpoints in node-local coords — the box centre is (0, 0). */
export function localEndpointsOfLine(node: Pick<FlowNode, 'lineStart' | 'lineFlip'>, width: number, height: number): { start: Point; end: Point } {
  const startCorner = lineCornerOf(node);
  const endCorner = OPPOSITE[startCorner];
  const half = { x: width / 2, y: height / 2 };
  return {
    start: { x: CORNER_SIGNS[startCorner].x * half.x, y: CORNER_SIGNS[startCorner].y * half.y },
    end: { x: CORNER_SIGNS[endCorner].x * half.x, y: CORNER_SIGNS[endCorner].y * half.y },
  };
}

/** The two endpoints in canvas coords. */
export function endpointsOfLine(node: Pick<FlowNode, 'lineStart' | 'lineFlip' | 'position'>, width: number, height: number): { start: Point; end: Point } {
  const local = localEndpointsOfLine(node, width, height);
  return {
    start: { x: node.position.x + local.start.x, y: node.position.y + local.start.y },
    end: { x: node.position.x + local.end.x, y: node.position.y + local.end.y },
  };
}

/**
 * The inverse: the box and start corner that draw exactly this segment,
 * with `start` keeping its identity as the start (so the arrowheads stay
 * on the ends the user put them on, even after dragging one endpoint
 * clean past the other).
 */
export function lineGeometryFromEndpoints(start: Point, end: Point): { position: Point; width: number; height: number; lineStart: LineCorner } {
  const goingRight = end.x >= start.x;
  const goingDown = end.y >= start.y;
  return {
    position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    // The start endpoint's own corner: left when the line runs right,
    // top when it runs down, and so on for the other three combinations.
    lineStart: goingRight ? (goingDown ? 'nw' : 'sw') : goingDown ? 'ne' : 'se',
  };
}
