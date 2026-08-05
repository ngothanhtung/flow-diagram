// Types for the flowchart tool.
// Mirrors a subset of Flowgram's FlowDocumentJSON so the visual editor and
// the persisted document stay compatible with @flowgram.ai/editor.

export type NodeType = 'start' | 'process' | 'decision' | 'output';

/** Visual shape of the node's body. Optional — defaults are derived
 *  from `type` so older documents render unchanged. */
export type NodeShape =
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'rounded'
  | 'pill'
  | 'hexagon'
  | 'diamond'
  | 'parallelogram'
  | 'document'
  | 'database'
  | 'server'
  | 'cloud'
  | 'queue'
  | 'component'
  | 'predefined-process'
  | 'folder'
  | 'note'
  | 'triangle'
  | 'triangle-down'
  | 'chevron'
  | 'internal-storage'
  | 'multi-document'
  | 'manual-input'
  | 'delay'
  | 'trapezoid'
  | 'circle-x'
  | 'circle-plus'
  | 'off-page'
  | 'pentagon'
  | 'octagon'
  | 'cross'
  | 'arrow-left'
  | 'arrow-right'
  | 'star'
  | 'speech-bubble';

/** Background hue. Optional — defaults are derived from `type`. */
export type NodeColor = 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';

/** A CSS colour. Palette names are retained for backwards compatibility. */
export type NodePaint = NodeColor | `#${string}`;

/**
 * Icon name. `lucide:<Name>` and `tabler:<Name>` reference any icon from
 * the full Lucide / Tabler catalogs (thousands of icons, loaded on demand
 * — see `@/lib/icon-library`). The bare names below are legacy short forms
 * kept so existing documents keep resolving instantly without a network
 * fetch; they are plain Lucide icon names.
 */
export type NodeIcon = 'cog' | 'play' | 'flag' | 'bell' | 'mail' | 'database' | 'cloud' | 'code' | 'send' | 'sparkles' | `lucide:${string}` | `tabler:${string}`;

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';
export type ExecutionState = 'normal' | 'pending' | 'active' | 'completed';
export type NodeFont = 'geist-mono' | 'be-vietnam-pro' | 'noto-sans' | 'source-sans-3' | 'roboto-slab' | 'merriweather';

export interface NodeConnectionPoints {
  input: ConnectionSide;
  output: ConnectionSide;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  /** Position is the center of the node, in canvas coordinates. */
  position: { x: number; y: number };
  /** Optional geometry overrides. Defaults to 112 × 112 at 0°. */
  width?: number;
  height?: number;
  rotation?: number;
  /** Execution sequence. Undefined/0 falls back to document order. */
  sortOrder?: number;
  shape?: NodeShape;
  /** Foreground colour for text, icon, outline, ports and outgoing edges. */
  color?: NodePaint;
  /** Body fill colour. */
  backgroundColor?: `#${string}`;
  borderColor?: NodePaint;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  shadow?: 'none' | 'soft' | 'glow';
  /** Explicit null hides the icon; undefined uses the type default. */
  icon?: NodeIcon | null;
  iconSize?: number;
  iconPosition?: 'top' | 'left';
  /** Self-hosted font with full Vietnamese glyph coverage. */
  fontFamily?: NodeFont;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  portSize?: number;
  /** Editable input/output handle positions. */
  connectionPoints?: NodeConnectionPoints;
}

/** A reusable semantic block from the left-hand model palette. */
export interface NodePreset {
  id: string;
  label: string;
  type: NodeType;
  shape?: NodeShape;
  icon?: NodeIcon;
  width?: number;
  height?: number;
}

export type EdgeEffect = 'flow' | 'dash' | 'pulse' | 'glow' | 'comet' | 'dots' | 'wave' | 'scanner' | 'traffic' | 'bidirectional' | 'laser' | 'meteor' | 'spark' | 'marching' | 'binary' | 'heartbeat' | 'rail' | 'fade';

export type EdgeMarker = 'none' | 'arrow' | 'open-arrow' | 'triangle' | 'circle' | 'diamond' | 'tee' | 'cross' | 'circle-cross' | 'arrow-both' | 'arrow-bar' | 'bar';

export type EdgeDirection = 'forward' | 'reverse' | 'both';
export type EdgeRouting = 'straight' | 'smooth-step' | 'orthogonal' | 'curved';
/** Where the label pill sits along the line. */
export type EdgeLabelPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';
export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** Exact ports selected when the connection was drawn. */
  fromSide?: ConnectionSide;
  toSide?: ConnectionSide;
  /** Optional label for decision branches (e.g. "yes", "no"). */
  label?: string;
  /** Placement of the label along the line. Defaults to "center". */
  labelPosition?: EdgeLabelPosition;
  effect?: EdgeEffect;
  /** Animation direction without changing the logical source/target. */
  direction?: EdgeDirection;
  /** Geometry of the connector path. */
  routing?: EdgeRouting;
  /** User-positioned intermediate points for orthogonal/smooth routes. */
  bendPoints?: FlowPoint[];
  /** Independently configurable symbols at both ends of the line. */
  startMarker?: EdgeMarker;
  endMarker?: EdgeMarker;
  color?: `#${string}`;
  /** Foreground colour for the animated objects travelling the line.
   *  Undefined falls back to `color` so the objects inherit the line
   *  colour by default. */
  effectColor?: `#${string}`;
  width?: number;
  /** Scale multiplier for animated packets/pulses, independent of line width. */
  effectSize?: number;
  /** Animation speed multiplier, from 0.25× to 3×. */
  animationSpeed?: number;
}

export interface FlowDocumentJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
}
