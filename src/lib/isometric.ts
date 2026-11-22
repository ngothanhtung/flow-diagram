// The isometric scene: a Diagram drawn as if its canvas were a floor seen
// from above at the isometric angle. Every block becomes a box with depth
// (its top face lifted, the two faces toward the viewer showing), connectors
// and free lines lie on the floor, group frames are flat tiles, and labels
// stand upright over their block so they stay readable. Pure geometry — no
// React, no DOM — shared by the on-screen view and the image export.

import { buildEdgeGeometry } from '@/components/edge-geometry';
import { edgeStylesOf, resolveEdgeStyle } from './edge-style';
import type { ExecutionState, FlowDocumentJSON, FlowNode } from './flowchart-types';
import { endpointsOfLine } from './line-geometry';
import { NODE_FONT_FAMILIES, NODE_FONT_WEIGHTS } from './node-fonts';
import { resolveNodeStyle } from './node-style';

export interface IsoPoint {
  x: number;
  y: number;
}

/** How tall a block stands, in canvas pixels. */
export const ISO_BLOCK_DEPTH = 24;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const MARGIN = 48;
/** How faint something the run hasn't reached yet is — the flat canvas's own value. */
const PENDING_OPACITY = 0.38;

/** A floor point (canvas x, y) at height z, on screen: x runs down-right, y down-left, z straight up. */
export function isoProject(point: { x: number; y: number }, z = 0): IsoPoint {
  return { x: (point.x - point.y) * COS30, y: (point.x + point.y) * SIN30 - z };
}

interface Typography {
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
}

export interface IsoBox extends Typography {
  id: string;
  /** Top face, lifted by the depth: far-left, far-right, near, near-left corners. */
  top: IsoPoint[];
  /** The face along the block's right edge, then the one along its bottom edge — the two facing the viewer. */
  right: IsoPoint[];
  front: IsoPoint[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Where the label stands: over the top face's centre. */
  label: IsoPoint;
  title: string;
  subtitle: string;
  opacity: number;
  active: boolean;
}

export interface IsoTile {
  id: string;
  points: IsoPoint[];
  fill: string;
  stroke: string;
  opacity: number;
  title: string;
  /** The title's spot: the frame's far corner, where its title bar is on the canvas. */
  label: IsoPoint;
  color: string;
}

export interface IsoLine {
  id: string;
  points: IsoPoint[];
  color: string;
  width: number;
  dashed: boolean;
  arrow: boolean;
  opacity: number;
  label: string;
  /** Where the line's label sits: its midpoint on the floor. */
  labelAt: IsoPoint;
}

export interface IsoLabel extends Typography {
  id: string;
  text: string;
  at: IsoPoint;
  opacity: number;
}

export interface IsometricScene {
  tiles: IsoTile[];
  lines: IsoLine[];
  boxes: IsoBox[];
  labels: IsoLabel[];
  bounds: { x: number; y: number; width: number; height: number };
}

export interface IsometricRun {
  nodeStates?: Record<string, ExecutionState>;
  edgeStates?: Record<string, ExecutionState>;
}

function typography(node: FlowNode): Typography {
  const style = resolveNodeStyle(node);
  return { color: style.foreground, fontSize: style.fontSize, fontFamily: NODE_FONT_FAMILIES[style.fontFamily], fontWeight: NODE_FONT_WEIGHTS[style.fontWeight] };
}

const stateOpacity = (state: ExecutionState | undefined) => (state === 'pending' ? PENDING_OPACITY : 1);

export function isometricScene(document: FlowDocumentJSON, run: IsometricRun = {}): IsometricScene {
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  const styles = edgeStylesOf(document.settings);
  const tiles: IsoTile[] = [];
  const lines: IsoLine[] = [];
  const boxes: IsoBox[] = [];
  const order = new Map<string, number>();
  const labels: IsoLabel[] = [];

  for (const node of document.nodes) {
    const style = resolveNodeStyle(node);
    const { x, y } = node.position;
    const l = x - style.width / 2;
    const r = x + style.width / 2;
    const t = y - style.height / 2;
    const b = y + style.height / 2;
    const opacity = style.opacity * stateOpacity(run.nodeStates?.[node.id]);

    if (node.type === 'group') {
      tiles.push({
        id: node.id,
        points: [isoProject({ x: l, y: t }), isoProject({ x: r, y: t }), isoProject({ x: r, y: b }), isoProject({ x: l, y: b })],
        fill: style.background,
        stroke: style.borderColor,
        opacity,
        title: node.title ?? '',
        label: isoProject({ x: l + 16, y: t + 16 }),
        color: style.foreground,
      });
      continue;
    }
    if (node.type === 'text') {
      if (node.title?.trim()) labels.push({ id: node.id, text: node.title, at: isoProject({ x, y }), opacity, ...typography(node) });
      continue;
    }
    if (node.type === 'line') {
      const { start, end } = endpointsOfLine(node, style.width, style.height);
      lines.push({ id: node.id, points: [isoProject(start), isoProject(end)], color: style.foreground, width: Math.max(1, style.borderWidth), dashed: style.borderStyle !== 'solid', arrow: (node.endMarker ?? 'none') !== 'none', opacity, label: '', labelAt: isoProject({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }) });
      continue;
    }
    // A free icon/logo object has no box and its glyph isn't drawn here yet.
    if (node.type === 'icon') continue;

    const depth = ISO_BLOCK_DEPTH;
    const up = (px: number, py: number) => isoProject({ x: px, y: py }, depth);
    const floor = (px: number, py: number) => isoProject({ x: px, y: py });
    order.set(node.id, x + y);
    boxes.push({
      id: node.id,
      top: [up(l, t), up(r, t), up(r, b), up(l, b)],
      right: [up(r, t), up(r, b), floor(r, b), floor(r, t)],
      front: [up(l, b), up(r, b), floor(r, b), floor(l, b)],
      fill: style.background,
      stroke: style.borderColor,
      strokeWidth: Math.max(1, style.borderWidth),
      label: up(x, y),
      title: node.title ?? '',
      subtitle: node.description?.trim() ?? '',
      opacity,
      active: run.nodeStates?.[node.id] === 'active',
      ...typography(node),
    });
  }

  for (const edge of document.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    const painted = resolveEdgeStyle(edge, styles);
    const geometry = buildEdgeGeometry(painted, from, to);
    const route = geometry.points?.length ? geometry.points : [geometry.start, geometry.mid, geometry.end];
    lines.push({
      id: edge.id,
      points: route.map((point) => isoProject(point)),
      color: painted.color ?? resolveNodeStyle(from).foreground,
      width: painted.width ?? 2.5,
      dashed: (painted.lineStyle ?? 'solid') !== 'solid',
      arrow: (painted.endMarker ?? 'arrow') !== 'none',
      opacity: stateOpacity(run.edgeStates?.[edge.id]),
      label: edge.label?.trim() ?? '',
      labelAt: isoProject(geometry.mid),
    });
  }

  // Far boxes first, so a nearer one is painted over it.
  boxes.sort((a, b) => order.get(a.id)! - order.get(b.id)! || (a.id < b.id ? -1 : 1));

  const points = [...tiles.flatMap((tile) => tile.points), ...lines.flatMap((line) => line.points), ...boxes.flatMap((box) => [...box.top, ...box.right, ...box.front]), ...labels.map((label) => label.at)];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  // Labels stand above their spot: leave room for two lines of text.
  const minY = ys.length ? Math.min(...ys) - 48 : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  return {
    tiles,
    lines,
    boxes,
    labels,
    // Whole pixels, so the exported picture has a clean size.
    bounds: { x: Math.floor(minX - MARGIN), y: Math.floor(minY - MARGIN), width: Math.ceil(maxX - minX + MARGIN * 2) + 1, height: Math.ceil(maxY - minY + MARGIN * 2) + 1 },
  };
}
