// Styling for the label chip drawn on a line. Kept beside the edge types
// (rather than inside AnimatedEdge) so the canvas, the viewer and the
// inspector preview all size and colour a label identically.

import type { EdgeLabelShape, FlowEdge, NodeFont } from './flowchart-types';

/** Dark ink, meant to sit on one of the light backgrounds below. */
export const EDGE_LABEL_COLORS: ReadonlyArray<{ value: `#${string}`; label: string }> = [
  { value: '#18181b', label: 'Ink' },
  { value: '#0c4a6e', label: 'Sky' },
  { value: '#164e63', label: 'Cyan' },
  { value: '#312e81', label: 'Indigo' },
  { value: '#4c1d95', label: 'Violet' },
  { value: '#831843', label: 'Pink' },
  { value: '#7f1d1d', label: 'Red' },
  { value: '#78350f', label: 'Amber' },
  { value: '#064e3b', label: 'Emerald' },
];

/** Light chip fills, meant to carry one of the dark inks above. */
export const EDGE_LABEL_BACKGROUNDS: ReadonlyArray<{ value: `#${string}`; label: string }> = [
  { value: '#f4f4f5', label: 'Zinc' },
  { value: '#ffffff', label: 'White' },
  { value: '#e0f2fe', label: 'Sky' },
  { value: '#cffafe', label: 'Cyan' },
  { value: '#e0e7ff', label: 'Indigo' },
  { value: '#ede9fe', label: 'Violet' },
  { value: '#fce7f3', label: 'Pink' },
  { value: '#fef3c7', label: 'Amber' },
  { value: '#d1fae5', label: 'Emerald' },
];

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
