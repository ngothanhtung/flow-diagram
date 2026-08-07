// Styling for the label chip drawn on a line. Kept beside the edge types
// (rather than inside AnimatedEdge) so the canvas, the viewer and the
// inspector preview all size and colour a label identically.

import type { EdgeLabelShape, FlowEdge, NodeFont } from './flowchart-types';

/**
 * Ink and chip fill always travel together: every preset is a dark ink
 * already paired with the light fill it reads best on, so the inspector
 * needs one picker rather than two palettes a user can mismatch.
 * `labelColor` / `labelBackground` stay separate fields on the edge, so a
 * document written before these presets existed still renders its own
 * pair — the inspector just reports it as "Custom".
 */
export interface EdgeLabelPreset {
  label: string;
  color: `#${string}`;
  background: `#${string}`;
}

export const EDGE_LABEL_PRESETS: ReadonlyArray<EdgeLabelPreset> = [
  { label: 'Ink', color: '#18181b', background: '#f4f4f5' },
  { label: 'Sky', color: '#0c4a6e', background: '#e0f2fe' },
  { label: 'Cyan', color: '#164e63', background: '#cffafe' },
  { label: 'Indigo', color: '#312e81', background: '#e0e7ff' },
  { label: 'Violet', color: '#4c1d95', background: '#ede9fe' },
  { label: 'Pink', color: '#831843', background: '#fce7f3' },
  { label: 'Red', color: '#7f1d1d', background: '#fee2e2' },
  { label: 'Amber', color: '#78350f', background: '#fef3c7' },
  { label: 'Emerald', color: '#064e3b', background: '#d1fae5' },
];

/** The preset a label currently matches, or null when it carries a pair
 *  no preset covers (hand-edited JSON, or a pre-preset document). */
export function findEdgeLabelPreset(color: string, background: string): EdgeLabelPreset | null {
  return EDGE_LABEL_PRESETS.find((preset) => preset.color.toLowerCase() === color.toLowerCase() && preset.background.toLowerCase() === background.toLowerCase()) ?? null;
}

export const EDGE_LABEL_SHAPES: ReadonlyArray<{ value: EdgeLabelShape; label: string }> = [
  { value: 'pill', label: 'Pill' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'rectangle', label: 'Rectangle' },
];

export const EDGE_LABEL_FONT_SIZE_MIN = 8;
export const EDGE_LABEL_FONT_SIZE_MAX = 24;

export interface ResolvedEdgeLabelStyle {
  shape: EdgeLabelShape;
  color: `#${string}`;
  background: `#${string}`;
  fontSize: number;
  fontFamily: NodeFont;
}

/** Defaults reproduce the dark-mode pill the editor drew before these
 *  fields existed: light chip, dark ink. */
export function resolveEdgeLabelStyle(edge: FlowEdge): ResolvedEdgeLabelStyle {
  return {
    shape: edge.labelShape ?? 'pill',
    color: edge.labelColor ?? '#18181b',
    background: edge.labelBackground ?? '#f4f4f5',
    fontSize: Math.max(EDGE_LABEL_FONT_SIZE_MIN, Math.min(EDGE_LABEL_FONT_SIZE_MAX, edge.labelFontSize ?? 11)),
    fontFamily: edge.labelFontFamily ?? 'geist-mono',
  };
}

/** Chip box for a label, centred on the origin. Hexagons get extra
 *  width so their slanted ends don't cut into the text. */
export function edgeLabelBox(text: string, style: ResolvedEdgeLabelStyle): { width: number; height: number; path: string } {
  const height = Math.round(style.fontSize * 1.45 + 10);
  const padding = style.shape === 'hexagon' ? 34 : 22;
  const width = Math.round(Math.max(height + 12, Math.min(260, text.length * style.fontSize * 0.66 + padding)));
  const hw = width / 2;
  const hh = height / 2;
  if (style.shape === 'hexagon') {
    const cut = Math.min(14, width / 4);
    return {
      width,
      height,
      path: `M ${-hw} 0 L ${-hw + cut} ${-hh} L ${hw - cut} ${-hh} L ${hw} 0 L ${hw - cut} ${hh} L ${-hw + cut} ${hh} Z`,
    };
  }
  const radius = style.shape === 'pill' ? hh : 3;
  return {
    width,
    height,
    path: `M ${-hw + radius} ${-hh}
           L ${hw - radius} ${-hh}
           Q ${hw} ${-hh} ${hw} ${-hh + radius}
           L ${hw} ${hh - radius}
           Q ${hw} ${hh} ${hw - radius} ${hh}
           L ${-hw + radius} ${hh}
           Q ${-hw} ${hh} ${-hw} ${hh - radius}
           L ${-hw} ${-hh + radius}
           Q ${-hw} ${-hh} ${-hw + radius} ${-hh} Z`,
  };
}
