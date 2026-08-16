// Flips a diagram's own literal colours between a dark-canvas palette and
// a light-canvas one — the "Convert dark ↔ light" File menu action.
//
// The transform is `L' = 1 - L` in HSL, keeping hue and saturation. That
// makes it its own inverse: running it twice on the same document
// restores the original colours (mod rounding), so one action covers
// both directions and there is no separate "which way" state to track or
// persist. Palette-name colours (`NodeColor` keywords, resolved through
// `node-style.ts`'s `COLORS`) are left alone — only literal `#hex`
// values are diagram-authored colours to invert.

import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.slice(1);
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

function rgbaToHex(r: number, g: number, b: number, a: number): `#${string}` {
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  const alphaHex = a < 255 ? toHex(a) : '';
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}` as `#${string}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case rn:
      h = ((gn - bn) / d) % 6;
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Flips one colour's lightness. Non-hex input (a palette name, `'auto'`) is returned unchanged. */
export function invertLightness(value: string): string {
  if (!HEX_RE.test(value)) return value;
  const [r, g, b, a] = hexToRgba(value);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h, s, 1 - l);
  return rgbaToHex(nr, ng, nb, a);
}

function isHex(value: string | undefined): value is `#${string}` {
  return typeof value === 'string' && value.startsWith('#');
}

function convertNodeColors(node: FlowNode): FlowNode {
  const next: FlowNode = { ...node };
  if (isHex(node.color)) next.color = invertLightness(node.color) as `#${string}`;
  if (isHex(node.backgroundColor)) next.backgroundColor = invertLightness(node.backgroundColor) as `#${string}`;
  if (isHex(node.borderColor)) next.borderColor = invertLightness(node.borderColor) as `#${string}`;
  if (isHex(node.effectColor)) next.effectColor = invertLightness(node.effectColor) as `#${string}`;
  return next;
}

function convertEdgeColors(edge: FlowEdge): FlowEdge {
  const next: FlowEdge = { ...edge };
  if (isHex(edge.color)) next.color = invertLightness(edge.color) as `#${string}`;
  if (isHex(edge.effectColor)) next.effectColor = invertLightness(edge.effectColor) as `#${string}`;
  if (isHex(edge.labelColor)) next.labelColor = invertLightness(edge.labelColor) as `#${string}`;
  if (isHex(edge.labelBackground)) next.labelBackground = invertLightness(edge.labelBackground) as `#${string}`;
  if (isHex(edge.glowColor)) next.glowColor = invertLightness(edge.glowColor) as `#${string}`;
  return next;
}

/** Flips every literal colour on every node (block, group, text, table) and
 *  edge in the document. Structural fields (shape, routing, sizes…) and
 *  palette-name colours are untouched. */
export function convertDocumentColorTheme(doc: FlowDocumentJSON): FlowDocumentJSON {
  return {
    ...doc,
    nodes: doc.nodes.map(convertNodeColors),
    edges: doc.edges.map(convertEdgeColors),
  };
}
