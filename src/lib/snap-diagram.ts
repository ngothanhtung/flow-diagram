// Snaps a whole Diagram onto the editor's grid, keeping its arrangement: each
// box's top-left goes to the nearest grid point and its size up to whole
// cells, so all four edges sit on grid lines. A group grows outward to the
// grid and to hold its (already snapped) members; a free line snaps its two
// ends; a Line's bend points go to the half grid, where box centres fall.
// Nothing else changes. Used to tidy Lessons a person has already edited
// (the converted ones are laid out on the grid from the start).

import type { FlowDocumentJSON, FlowNode } from './flowchart-types';
import { nodeSizeLimits, resolveNodeStyle } from './node-style';

export const SNAP_GRID = 40;

/** Rounds to a multiple of `step`; `+ 0` turns -0 into 0 so stored numbers stay clean. */
const toStep = (value: number, step: number, round: (n: number) => number = Math.round) => round(value / step) * step + 0;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Whole cells, clamped to what the node kind allows (a ceiling off the grid keeps the old size rather than shrink it). */
function cells(length: number, min: number, max: number, grid: number): number {
  const up = Math.max(Math.ceil(length / grid) * grid, Math.ceil(min / grid) * grid);
  if (up <= max) return up;
  const down = Math.floor(max / grid) * grid;
  return down >= length ? down : length;
}

export function snapDiagramToGrid(document: FlowDocumentJSON, grid = SNAP_GRID): FlowDocumentJSON {
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  const depthOf = (node: FlowNode): number => {
    let depth = 0;
    const seen = new Set<string>();
    for (let cur = node.parentId; cur && byId.has(cur) && !seen.has(cur); cur = byId.get(cur)!.parentId) {
      seen.add(cur);
      depth += 1;
    }
    return depth;
  };
  // Members before their groups, so a group can grow around where they land.
  const order = [...document.nodes].sort((a, b) => depthOf(b) - depthOf(a));
  const boxes = new Map<string, Box>();
  const snapped = new Map<string, FlowNode>();

  for (const node of order) {
    const { width, height } = resolveNodeStyle(node);
    const limits = nodeSizeLimits(node);
    const left = node.position.x - width / 2;
    const top = node.position.y - height / 2;
    let box: Box;
    if (node.type === 'line') {
      // A segment: its two ends are the box's corners.
      box = { left: toStep(left, grid), top: toStep(top, grid), right: toStep(left + width, grid), bottom: toStep(top + height, grid) };
    } else if (node.type === 'group') {
      box = { left: toStep(left, grid, Math.floor), top: toStep(top, grid, Math.floor), right: toStep(left + width, grid, Math.ceil), bottom: toStep(top + height, grid, Math.ceil) };
      for (const member of document.nodes) {
        const inner = member.parentId === node.id ? boxes.get(member.id) : undefined;
        if (!inner) continue;
        box = { left: Math.min(box.left, inner.left), top: Math.min(box.top, inner.top), right: Math.max(box.right, inner.right), bottom: Math.max(box.bottom, inner.bottom) };
      }
      box.right = box.left + cells(box.right - box.left, limits.minWidth, limits.maxWidth, grid);
      box.bottom = box.top + cells(box.bottom - box.top, limits.minHeight, limits.maxHeight, grid);
    } else {
      const snappedLeft = toStep(left, grid);
      const snappedTop = toStep(top, grid);
      box = { left: snappedLeft, top: snappedTop, right: snappedLeft + cells(width, limits.minWidth, limits.maxWidth, grid), bottom: snappedTop + cells(height, limits.minHeight, limits.maxHeight, grid) };
    }
    boxes.set(node.id, box);
    const next = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    const nextWidth = box.right - box.left;
    const nextHeight = box.bottom - box.top;
    const same = next.x === node.position.x && next.y === node.position.y && nextWidth === node.width && nextHeight === node.height;
    snapped.set(node.id, same ? node : { ...node, position: next, width: nextWidth, height: nextHeight });
  }

  const half = grid / 2;
  return {
    ...document,
    nodes: document.nodes.map((node) => snapped.get(node.id) ?? node),
    edges: document.edges.map((edge) =>
      edge.bendPoints?.length ? { ...edge, bendPoints: edge.bendPoints.map((point) => ({ x: toStep(point.x, half), y: toStep(point.y, half) })) } : edge,
    ),
  };
}
