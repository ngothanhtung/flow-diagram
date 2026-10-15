// Image export — the pure half: what goes into the picture, how big the
// picture is, and what the file is called. No React and no DOM here, so all
// of it is unit-tested; the rendering half (an off-screen static render of
// the Diagram, flattened to self-contained SVG and rasterised for PNG) lives
// in `components/export/`.
//
// Bounds are computed from the document rather than read back from the DOM
// on purpose: the canvas culls off-screen Elements in performance mode, so
// nothing the user currently sees can be trusted to describe the whole
// Diagram — the data can.

import { buildFragment } from './clipboard-fragment';
import { edgeLabelBox, resolveEdgeLabelStyle } from './edge-label-style';
import { resolveDocumentStyles } from './edge-style';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { endpointsOfLine } from './line-geometry';
import { resolveNodeStyle } from './node-style';
import { buildEdgeGeometry, edgeLabelAnchor } from '@/components/edge-geometry';

export type ImageFormat = 'png' | 'svg';
export type ImageBackground = 'theme' | 'transparent';

/** Empty space around the content, in Diagram units (= CSS px at 1×).
 *  Wide enough for a Block's depth shadow (offset 10 + blur 18) to land
 *  inside the picture rather than be cut at its edge. */
export const EXPORT_MARGIN = 32;
/** PNG pixel density: the PNG is exactly this many times the content box. */
export const PNG_PIXEL_RATIO = 2;
/** How far a line-end marker can reach from the point it sits on. The
 *  longest symbol in `edge-marker.tsx` (`arrow-both`, the crow's feet with
 *  a ring) runs 22.5 units back along the line and 7 across it. */
export const MARKER_EXTENT = 24;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function grow(extent: Extent, x: number, y: number, pad = 0) {
  extent.minX = Math.min(extent.minX, x - pad);
  extent.minY = Math.min(extent.minY, y - pad);
  extent.maxX = Math.max(extent.maxX, x + pad);
  extent.maxY = Math.max(extent.maxY, y + pad);
}

/**
 * The part of a Diagram an export covers. `null` (or an empty selection)
 * is the whole Diagram; otherwise it is the selected Elements, the whole
 * contents of every selected Frame and the Lines with both ends inside —
 * the same set copy/paste takes, so "what I selected" means one thing.
 * Settings travel with it so Line styles still resolve.
 */
export function exportScope(doc: FlowDocumentJSON, selectedNodeIds: readonly string[] | null): FlowDocumentJSON {
  if (!selectedNodeIds || selectedNodeIds.length === 0) return doc;
  const fragment = buildFragment(doc, selectedNodeIds);
  if (!fragment) return { nodes: [], edges: [], settings: doc.settings };
  return { nodes: fragment.nodes, edges: fragment.edges, settings: doc.settings };
}

/** Every coordinate pair a path visits, with curves sampled so a bulge
 *  between control points is counted where it is actually drawn. The
 *  edge builders only emit absolute M/L/H/V/Q/C/Z. */
export function samplePathPoints(d: string): Array<{ x: number; y: number }> {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  let index = 0;
  let command = '';
  let current = { x: 0, y: 0 };
  const read = () => Number(tokens[index++]);
  const SAMPLES = 24;
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (command === 'Z') continue;
    if (command === 'M' || command === 'L') {
      current = { x: read(), y: read() };
      points.push(current);
    } else if (command === 'H') {
      current = { x: read(), y: current.y };
      points.push(current);
    } else if (command === 'V') {
      current = { x: current.x, y: read() };
      points.push(current);
    } else if (command === 'Q') {
      const c = { x: read(), y: read() };
      const end = { x: read(), y: read() };
      for (let step = 1; step <= SAMPLES; step += 1) {
        const t = step / SAMPLES;
        const u = 1 - t;
        points.push({ x: u * u * current.x + 2 * u * t * c.x + t * t * end.x, y: u * u * current.y + 2 * u * t * c.y + t * t * end.y });
      }
      current = end;
    } else if (command === 'C') {
      const c1 = { x: read(), y: read() };
      const c2 = { x: read(), y: read() };
      const end = { x: read(), y: read() };
      for (let step = 1; step <= SAMPLES; step += 1) {
        const t = step / SAMPLES;
        const u = 1 - t;
        points.push({
          x: u ** 3 * current.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x,
          y: u ** 3 * current.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y,
        });
      }
      current = end;
    } else {
      // Unknown command: skip a token so a malformed path can't loop forever.
      index += 1;
    }
  }
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function addNode(extent: Extent, node: FlowNode) {
  const style = resolveNodeStyle(node);
  if (node.type === 'line') {
    const { start, end } = endpointsOfLine(node, style.width, style.height);
    const pad = Math.max(1, style.borderWidth) / 2;
    grow(extent, start.x, start.y, node.startMarker && node.startMarker !== 'none' ? MARKER_EXTENT : pad);
    grow(extent, end.x, end.y, node.endMarker && node.endMarker !== 'none' ? MARKER_EXTENT : pad);
    return;
  }
  // A rotated Element's box corners, so a tilted card is never clipped.
  const radians = (style.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pad = style.borderWidth / 2;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const lx = (dx * style.width) / 2;
    const ly = (dy * style.height) / 2;
    grow(extent, node.position.x + lx * cos - ly * sin, node.position.y + lx * sin + ly * cos, pad);
  }
}

function addEdge(extent: Extent, edge: FlowEdge, from: FlowNode, to: FlowNode) {
  const geometry = buildEdgeGeometry(edge, from, to);
  const lineWidth = Math.max(1, Math.min(6, edge.width ?? 2.5));
  for (const point of samplePathPoints(geometry.d)) grow(extent, point.x, point.y, lineWidth / 2);
  if (edge.startMarker && edge.startMarker !== 'none') grow(extent, geometry.start.x, geometry.start.y, MARKER_EXTENT);
  if (edge.endMarker && edge.endMarker !== 'none') grow(extent, geometry.end.x, geometry.end.y, MARKER_EXTENT);
  if (edge.label) {
    const box = edgeLabelBox(edge.label, resolveEdgeLabelStyle(edge));
    const anchor = edgeLabelAnchor(edge, geometry, box.width);
    grow(extent, anchor.x - box.width / 2, anchor.y - box.height / 2);
    grow(extent, anchor.x + box.width / 2, anchor.y + box.height / 2);
  }
}

/**
 * The picture's box in Diagram coordinates: every Element (rotation
 * included), every Line's drawn route, its end markers and its label,
 * plus `margin` all round. Null when there is nothing to draw. Line
 * styles are resolved first, since a style can set a Line's width,
 * routing and markers.
 */
export function contentBounds(rawDoc: FlowDocumentJSON, margin = EXPORT_MARGIN): Box | null {
  if (rawDoc.nodes.length === 0) return null;
  const doc = resolveDocumentStyles(rawDoc);
  const extent: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  for (const node of doc.nodes) addNode(extent, node);
  for (const edge of doc.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from && to) addEdge(extent, edge, from, to);
  }
  if (!Number.isFinite(extent.minX)) return null;
  // Whole units keep the PNG's pixel size an exact multiple of the box.
  const x = Math.floor(extent.minX - margin);
  const y = Math.floor(extent.minY - margin);
  return { x, y, width: Math.ceil(extent.maxX + margin) - x, height: Math.ceil(extent.maxY + margin) - y };
}

/** Pixel size of the exported file for a content box. */
export function exportPixelSize(box: Box, format: ImageFormat): { width: number; height: number } {
  const ratio = format === 'png' ? PNG_PIXEL_RATIO : 1;
  return { width: box.width * ratio, height: box.height * ratio };
}

/**
 * Download name for an image: the Diagram's name with characters no file
 * system accepts removed (letters of any script are kept — a Vietnamese
 * name stays readable), whitespace collapsed, capped in length, falling
 * back to "diagram". `-selection` marks a partial export.
 */
export function imageFilename(name: string, format: ImageFormat, selectionOnly = false): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 100)
    .trim();
  return `${cleaned || 'diagram'}${selectionOnly ? '-selection' : ''}.${format}`;
}
