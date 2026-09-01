// Types for the flowchart tool.
// Mirrors a subset of Flowgram's FlowDocumentJSON so the visual editor and
// the persisted document stay compatible with @flowgram.ai/editor.

/**
 * `'logo'` is a legacy value only — the dedicated logo block was removed
 * once the free-standing `'icon'` object (pick either a Lucide/Tabler
 * icon or a brand logo, positioned independently of any card) covered
 * the same need without a second node kind. It stays in the union purely
 * so a diagram saved before the removal keeps resolving a default shape
 * and rendering — see `DEFAULT_BY_TYPE` in `node-style.ts`. Nothing
 * creates one any more.
 */
export type NodeType = 'start' | 'process' | 'decision' | 'output' | 'logo' | 'group' | 'text' | 'icon' | 'legend' | 'lifeline' | 'activation';

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

/**
 * Animation applied to a node. Off (`'none'`) unless the user picks one —
 * a block, frame or text object is completely static by default, exactly
 * like a line with `effect: 'none'`.
 *
 * Two families, and the knobs below apply to one each:
 *  - motion (`float`…`blink`) animates the node itself;
 *  - decoration (`glow`…`sheen`) paints an extra layer around or over it.
 */
export type NodeEffect =
  | 'none'
  // Motion — the node moves.
  | 'float'
  | 'breathe'
  | 'shake'
  | 'wobble'
  | 'bounce'
  | 'blink'
  // Decoration — an extra layer is painted.
  | 'glow'
  | 'pulse'
  | 'ripple'
  | 'trace'
  | 'sheen';

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

/** One row of a legend: a sample plus what it means. */
export interface LegendItem {
  id: string;
  /** `swatch` is a filled chip (a node colour role); `line` is a short
   *  rule with an arrow head (an edge style). */
  kind: 'swatch' | 'line';
  label: string;
  /** Unset on a row following a class — see `styleRef`. */
  color?: `#${string}`;
  /** Line samples only. Superseded by `lineStyle`; kept so rows written
   *  before that field render unchanged. */
  dashed?: boolean;
  /** Line samples only — the stroke pattern of the line it stands for. */
  lineStyle?: EdgeLineStyle;
  /**
   * Id of the `EdgeStyleClass` this row describes. A row generated from
   * the diagram carries only this, so it keeps naming the class
   * correctly as the class is edited; anything the row sets itself
   * (label, colour, stroke) overrides the class, exactly as it does on a
   * line.
   */
  styleRef?: string;
}

/**
 * Turns a node into the legend every reference diagram carries: rows of
 * sample + label naming the colour and line vocabulary the diagram uses.
 * It paints no card of its own, like text and free icon objects.
 */
export interface LegendSpec {
  items: LegendItem[];
  /** Laid out in a row (the usual footer legend) or stacked. */
  orientation?: 'horizontal' | 'vertical';
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
  /** How long (ms) this block stays highlighted as the active replay step
   *  before advancing. Unset = `NODE_FADE_DURATION_MS`. */
  duration?: number;
  /** Extra pause (ms) after `duration` finishes, before the run cursor
   *  advances. Unset = `DEFAULT_STEP_DELAY_MS`. */
  delay?: number;
  shape?: NodeShape;
  /** Foreground colour for text, icon, outline, ports and outgoing edges. */
  color?: NodePaint;
  /** Body fill colour. */
  backgroundColor?: `#${string}`;
  borderColor?: NodePaint;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  /**
   * How the body is painted: `'flat'` is the plain `backgroundColor`,
   * `'sheen'` lays a soft top-to-bottom gradient over it. Unset means
   * `'sheen'`, so documents written before this field keep their look.
   */
  fill?: 'flat' | 'sheen';
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
  /** Animation. Unset = `'none'`: nothing moves and nothing is painted. */
  effect?: NodeEffect;
  /** Halo / ring colour for the decoration effects. Unset follows `color`. */
  effectColor?: `#${string}`;
  /** Animation rate multiplier, 0.25–3. Unset = 1. */
  effectSpeed?: number;
  /** Strength of the effect, 0.25–3. Unset = 1. */
  effectIntensity?: number;
  /** Present on database tables — renders the card as an ERD table. */
  table?: TableSpec;
  /** Present on `type: 'legend'` nodes — the rows it lists. */
  legend?: LegendSpec;
  /**
   * Group frames only. `'panel'` (unset) is the ordinary container with
   * a full-width title bar; `'fragment'` is the sequence diagram's
   * alt/opt/loop band, which swaps that bar for a small corner tab and
   * draws a solid hairline instead of a wash. Same "a lane is a group"
   * precedent — only the look differs, so it isn't a new node kind.
   */
  frameStyle?: 'panel' | 'fragment';
  /**
   * `type: 'activation'` only — the lifeline this bar sits on. Its x is
   * slaved to that lifeline's centre line, so only its y and height are
   * really free.
   *
   * Deliberately *not* `parentId`: that field means "member of a group
   * frame", and `onNodeDrop` clears it whenever the node isn't inside
   * one. A bar would lose its lifeline the first time it was dragged.
   */
  lifelineId?: string;
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
 * carrying a `TableSpec`) rather than a new silhouette, `'group'`, which
 * draws a container frame other blocks can be dropped into, `'text'`,
 * which drops a free-standing piece of text with no box around it, and
 * `'icon'`, which drops a free-standing icon or brand logo with no box or
 * card around it either — the graphic counterpart to `'text'`,
 * positioned and resized independently of any block. There is no
 * `'logo'` draw tool any more — `'icon'` covers the same need with the
 * user choosing icon vs. logo at pick time rather than a separate tool.
 *
 * `'lane'` is not a node kind of its own: it draws a `group` frame
 * pre-styled as a swimlane (numbered header, dashed hairline, barely
 * there wash), because a lane *is* a container — only its look and its
 * "add the next one" affordance differ. `'fragment'` follows the same
 * precedent for the sequence diagram's alt/opt/loop band: a `group`
 * with `frameStyle: 'fragment'`, which swaps the full-width title bar
 * for a corner tab.
 *
 * `'lifeline'` *is* its own node kind — a header card plus the long
 * dashed line below it is not a container and not a card.
 */
export type DrawTool = NodeShape | 'table' | 'group' | 'text' | 'icon' | 'lane' | 'legend' | 'lifeline' | 'fragment';

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
  | 'pulse'
  | 'glow'
  | 'comet'
  | 'dots'
  | 'scanner'
  | 'bidirectional'
  | 'laser'
  | 'meteor'
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

export type EdgeDirection = 'forward' | 'reverse' | 'both';
/**
 * `'message'` is the sequence diagram's route and the only one that
 * isn't derived purely from its two endpoints: it runs dead horizontal
 * at the edge's own `messageY`, between the two lifelines' centre lines,
 * because in a sequence diagram *when* a message happens is the whole
 * point and a lifeline spans the entire height of the drawing.
 */
export type EdgeRouting = 'straight' | 'smooth-step' | 'orthogonal' | 'curved' | 'message';
/**
 * Stroke pattern of the line itself, independent of the animated effect
 * layer riding on top of it. Unset = `'solid'`, which is how every line
 * drawn before this field existed rendered.
 *
 * This is what makes "dashed means async" a vocabulary a reader can
 * actually rely on: a dash that stays put whether or not the diagram is
 * playing, unlike an effect's moving marks.
 */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
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
  /**
   * `routing: 'message'` only — the canvas y the message runs at, in
   * absolute canvas coordinates, set by dragging the line up and down.
   * Unset falls back to a point derived from the two lifelines, so a
   * hand-written document still renders something sensible.
   */
  messageY?: number;
  /**
   * `routing: 'message'` only — a message a lifeline sends to itself
   * renders as a loop out and back rather than a zero-length line; this
   * is how tall that loop is. Unset = `SELF_MESSAGE_DROP`.
   */
  selfMessageDrop?: number;
  /** Independently configurable symbols at both ends of the line. */
  startMarker?: EdgeMarker;
  endMarker?: EdgeMarker;
  /** ERD relationship: which column each end refers to. Only used for
   *  the line's label and for emitting foreign keys on SQL export —
   *  the line itself still attaches to the table's edge like any
   *  other connector. */
  fromColumn?: string;
  toColumn?: string;
  /** Explicit position in the replay timeline, sharing the same number
   *  line as a node's `sortOrder` — see `computeRunTimeline`. Unset =
   *  auto: the later of its two connected nodes' resolved order. */
  sortOrder?: number;
  /** How long (ms) this line takes to draw as the active replay step
   *  before advancing. Unset = `EDGE_DRAW_DURATION_MS`. */
  duration?: number;
  /** Extra pause (ms) after `duration` finishes, before the run cursor
   *  advances. Unset = `DEFAULT_STEP_DELAY_MS`. */
  delay?: number;
  color?: `#${string}`;
  /** Foreground colour for the animated objects travelling the line.
   *  Undefined falls back to `color` so the objects inherit the line
   *  colour by default. */
  effectColor?: `#${string}`;
  width?: number;
  /** Stroke pattern of the line itself. Unset = solid. */
  lineStyle?: EdgeLineStyle;
  /**
   * Id of the named style class in `DiagramSettings.edgeStyles` this
   * line follows. The class supplies every field it defines that the
   * line doesn't set itself — see `resolveEdgeStyle`. Pointing at a
   * class that no longer exists is harmless: the line just falls back
   * to its own fields.
   */
  styleRef?: string;
  /** Scale multiplier for animated packets/pulses, independent of line width. */
  effectSize?: number;
  /** Number of objects travelling the line at once (1–8) for the
   *  travelling-object effects (pulse, comet, dots, laser…). Unset =
   *  automatic: spacing-based, so longer lines carry more objects.
   *  Pattern effects (flow, dash, wave…) tile the line and ignore it. */
  effectCount?: number;
  /** Renders the travelling objects as a picked `NodeIcon` (`lucide:Home`,
   *  `tabler:IconHome`…) riding the route instead of the effect's plain
   *  dash segment. Unset keeps the classic dash objects. Only the
   *  travelling-object effects honour it. Always renders at a fixed 16px
   *  — there is no size knob for this. */
  effectShape?: NodeIcon;
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
  /** Animation speed multiplier, from 0.25× to 3×. */
  animationSpeed?: number;
}

/**
 * How the play bar walks through the diagram. `static` is the odd one
 * out: there is no run cursor at all, every node and edge always reads
 * as `'normal'`, and every animation — the replay highlight, each edge's
 * own travelling effect, each node's own motion/decoration effect — is
 * frozen. It's for a diagram meant to be read as a plain reference
 * chart, not walked through.
 */
export type RunMode = 'sequential' | 'concurrent' | 'manual' | 'static';

/**
 * The line properties a named style class can carry — exactly the fields
 * that make up a diagram's line vocabulary, and nothing else. Written as
 * a `Pick` of `FlowEdge` on purpose: a class and the line it styles can
 * never drift apart in type, and `resolveEdgeStyle` can merge one onto
 * the other field for field.
 *
 * Deliberately excluded: anything about *this particular* line — its
 * endpoints, label text, bend points, replay order. A class says what
 * kind of relationship a line represents, not where it goes.
 */
export type EdgeStyleProps = Pick<
  FlowEdge,
  'color' | 'width' | 'lineStyle' | 'startMarker' | 'endMarker' | 'routing' | 'direction' | 'effect' | 'effectColor' | 'effectSize' | 'effectCount' | 'effectDensity' | 'effectShape' | 'animationSpeed' | 'glowIntensity' | 'glowColor'
>;

/**
 * A named line style — "primary flow", "async event", "policy" — stored
 * once per document and referenced by `FlowEdge.styleRef`. What keeps a
 * large diagram legible is not pretty colours but a small vocabulary of
 * line kinds used consistently; a class is that vocabulary made editable
 * in one place.
 */
export interface EdgeStyleClass extends EdgeStyleProps {
  /** Stable key referenced by `FlowEdge.styleRef`. */
  id: string;
  /** What this kind of line means — also the legend row's label. */
  name: string;
}

/** Editor settings persisted with the diagram. */
export interface DiagramSettings {
  /** Execution mode for the play bar. Defaults to "sequential". */
  runMode?: RunMode;
  /** Whether the sequential run automatically replays. */
  repeatEnabled?: boolean;
  /** The document's named line vocabulary. Unset = no classes defined;
   *  every line carries its own styling, as before this existed. */
  edgeStyles?: EdgeStyleClass[];
}

export interface FlowDocumentJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Editor settings saved together with the diagram. */
  settings?: DiagramSettings;
}
