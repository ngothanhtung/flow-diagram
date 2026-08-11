// Types for the flowchart tool.
// Mirrors a subset of Flowgram's FlowDocumentJSON so the visual editor and
// the persisted document stay compatible with @flowgram.ai/editor.

export type NodeType = 'start' | 'process' | 'decision' | 'output' | 'logo' | 'group' | 'text';

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
export type NodeColor = 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'pink' | 'coral' | 'brown' | 'rose';

/** A CSS colour. Palette names are retained for backwards compatibility. */
export type NodePaint = NodeColor | `#${string}`;

/**
 * Icon name. `lucide:<Name>` and `tabler:<Name>` reference any icon from
 * the full Lucide / Tabler catalogs (thousands of icons, loaded on demand
 * — see `@/lib/icon-library`). The bare names below are legacy short forms
 * kept so existing documents keep resolving instantly without a network
 * fetch; they are plain Lucide icon names.
 */
export type NodeIcon = 'cog' | 'play' | 'flag' | 'bell' | 'mail' | 'database' | 'cloud' | 'code' | 'send' | 'sparkles' | `lucide:${string}` | `tabler:${string}` | `logo:${string}`;

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';
export type ExecutionState = 'normal' | 'pending' | 'active' | 'completed';
export type NodeFont = 'geist-mono' | 'be-vietnam-pro' | 'noto-sans' | 'source-sans-3' | 'roboto-slab' | 'merriweather';

export interface NodeConnectionPoints {
  input: ConnectionSide;
  output: ConnectionSide;
}

/** One column of a database table (see `TableSpec`). */
export interface TableColumn {
  id: string;
  name: string;
  /** Free text so any dialect works: 'uuid', 'varchar(255)', 'timestamptz'. */
  dataType: string;
  primaryKey?: boolean;
  foreignKey?: boolean;
  unique?: boolean;
  index?: boolean;
  /** Columns are NOT NULL unless this says otherwise. */
  nullable?: boolean;
  defaultValue?: string;
  note?: string;
}

/**
 * Turns a node into a database table: the card renders a header plus one
 * row per column instead of the icon + title layout. Everything else
 * about the node (shape, colours, ports, dragging) stays the same, so an
 * ERD and a flow diagram can share one document.
 */
export interface TableSpec {
  columns: TableColumn[];
  /** Optional schema shown next to the table name ('public.users'). */
  schema?: string;
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
  iconPosition?: 'top' | 'left' | 'right';
  /** Flex placement of the whole icon + text cluster inside the card. */
  blockAlign?: 'left' | 'center' | 'right';
  /** Self-hosted font with full Vietnamese glyph coverage. */
  fontFamily?: NodeFont;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  portSize?: number;
  /** Editable input/output handle positions. */
  connectionPoints?: NodeConnectionPoints;
  /** Present on database tables — renders the card as an ERD table. */
  table?: TableSpec;
  /**
   * Id of the group frame (`type: 'group'`) this node sits inside.
   * Membership is stored on the child, never as a list on the parent, so
   * there is exactly one place to keep in sync. Positions stay absolute
   * whatever the nesting is — moving a group moves its members by the
   * same delta, so every other part of the app (edges, ports, export)
   * keeps reading `position` without knowing groups exist.
   */
  parentId?: string;
}

/**
 * What the canvas draw tool is armed with. Every shape can be drawn, plus
 * `'table'`, which produces a database-table node (a `rounded` card
 * carrying a `TableSpec`) rather than a new silhouette, `'logo'`, which
 * drops a dedicated logo block whose selected brand mark is rendered
 * large and centred, `'group'`, which draws a container frame other
 * blocks can be dropped into, and `'text'`, which drops a free-standing
 * piece of text with no box around it.
 */
export type DrawTool = NodeShape | 'table' | 'logo' | 'group' | 'text';

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

export type EdgeEffect =
  /** No animation at all — a plain static connector. ERD relationships
   *  default to this, since a schema diagram reads better still. */
  | 'none'
  | 'flow'
  | 'dash'
  | 'pulse'
  | 'glow'
  | 'comet'
  | 'dots'
  | 'wave'
  | 'scanner'
  | 'traffic'
  | 'bidirectional'
  | 'laser'
  | 'meteor'
  | 'spark'
  | 'marching'
  | 'binary'
  | 'heartbeat'
  | 'rail'
  | 'fade'
  | 'convoy'
  | 'chase'
  | 'charging'
  | 'morse'
  | 'ants'
  | 'blink';

export type EdgeMarker =
  | 'none'
  | 'arrow'
  | 'open-arrow'
  | 'triangle'
  | 'circle'
  | 'diamond'
  | 'tee'
  | 'cross'
  | 'circle-cross'
  | 'arrow-both'
  | 'arrow-bar'
  | 'bar'
  // Crow's foot (IE) cardinality, for ERD relationships.
  | 'crow-one'
  | 'crow-many'
  | 'crow-one-many'
  | 'crow-zero-one'
  | 'crow-zero-many';

/**
 * Real silhouettes that can ride a connector instead of the plain dash
 * segment a travelling effect normally draws (see `edge-object-shapes`).
 */
export type EdgeObjectShape = 'arrow' | 'chevron' | 'plane' | 'bolt' | 'envelope' | 'box' | 'coin' | 'dot' | 'ring' | 'square' | 'diamond' | 'star';

export type EdgeDirection = 'forward' | 'reverse' | 'both';
export type EdgeRouting = 'straight' | 'smooth-step' | 'orthogonal' | 'curved';
/** Where the label pill sits along the line. */
export type EdgeLabelPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';
/** Silhouette drawn behind the label text. */
export type EdgeLabelShape = 'pill' | 'hexagon' | 'rectangle';
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
  /** Free position along the drawn path, 0 = start … 1 = end. Set by
   *  dragging the label; overrides `labelPosition` while present. */
  labelOffset?: number;
  /** Label styling. All optional — unset falls back to the dark pill
   *  the editor has always drawn (see `resolveEdgeLabelStyle`). */
  labelShape?: EdgeLabelShape;
  labelColor?: `#${string}`;
  labelBackground?: `#${string}`;
  labelFontSize?: number;
  labelFontFamily?: NodeFont;
  effect?: EdgeEffect;
  /** Animation direction without changing the logical source/target. */
  direction?: EdgeDirection;
  /** Geometry of the connector path. Unset = "smooth-step", the default
   *  every diagram draws with. */
  routing?: EdgeRouting;
  /** User-positioned intermediate points for orthogonal/smooth routes. */
  bendPoints?: FlowPoint[];
  /** Independently configurable symbols at both ends of the line. */
  startMarker?: EdgeMarker;
  endMarker?: EdgeMarker;
  /** ERD relationship: which column each end refers to. Only used for
   *  the line's label and for emitting foreign keys on SQL export —
   *  the line itself still attaches to the table's edge like any
   *  other connector. */
  fromColumn?: string;
  toColumn?: string;
  color?: `#${string}`;
  /** Foreground colour for the animated objects travelling the line.
   *  Undefined falls back to `color` so the objects inherit the line
   *  colour by default. */
  effectColor?: `#${string}`;
  width?: number;
  /** Scale multiplier for animated packets/pulses, independent of line width. */
  effectSize?: number;
  /** Number of objects travelling the line at once (1–8) for the
   *  travelling-object effects (pulse, comet, dots, laser…). Unset =
   *  automatic: spacing-based, so longer lines carry more objects.
   *  Pattern effects (flow, dash, wave…) tile the line and ignore it. */
  effectCount?: number;
  /** Renders the travelling objects as a real silhouette (arrow,
   *  envelope, coin…) riding the route instead of the effect's plain
   *  dash segment. Unset keeps the classic dash objects. Only the
   *  travelling-object effects honour it. */
  effectShape?: EdgeObjectShape;
  /** Mark density for the pattern effects (flow, dash, wave…), 0.5×–2×.
   *  Higher = more, smaller marks per length; 1 (default) keeps the
   *  classic pattern. Travelling-object effects ignore it (use
   *  `effectCount` there instead). */
  effectDensity?: number;
  /** Neon glow strength around the moving objects, 0–3×. Unset means no
   *  halo at all — the editor sets `1` on newly drawn lines, so a glow
   *  is always an explicit choice rather than an inherited default. */
  glowIntensity?: number;
  /** Halo colour. Unset is white (the classic neon look); `'auto'`
   *  follows the travelling object's own colour; a hex value pins it. */
  glowColor?: `#${string}` | 'auto';
  /** Animation phase offset as a fraction of one cycle (0–1). Lines
   *  sharing an effect run in lockstep by default; offsetting phases
   *  makes parallel connectors read more organically. */
  phaseOffset?: number;
  /** Animation speed multiplier, from 0.25× to 3×. */
  animationSpeed?: number;
}

/** How the play bar walks through the diagram. */
export type RunMode = 'sequential' | 'concurrent' | 'manual';

/** Editor settings persisted with the diagram. */
export interface DiagramSettings {
  /** Execution mode for the play bar. Defaults to "sequential". */
  runMode?: RunMode;
  /** Whether the sequential run automatically replays. */
  repeatEnabled?: boolean;
}

export interface FlowDocumentJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Editor settings saved together with the diagram. */
  settings?: DiagramSettings;
}
