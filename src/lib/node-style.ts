// Visual style for nodes — single source of truth shared by the
// canvas, the inspector, and the palette. The tables are exhaustive
// over `NodeShape`, `NodeColor`, and `NodeIcon` so the TS compiler
// catches missing entries.

import {
  Bell,
  CircleDashed,
  CheckCircle2,
  Cog,
  Database,
  Cloud,
  Code,
  Flag,
  GitBranch,
  Image,
  Mail,
  Play,
  Send,
  Sparkles,
  User,
  Webhook,
  Workflow,
  Rocket,
  Zap,
  Shield,
  RefreshCcw,
  Boxes,
  Puzzle,
  CircleCheck,
  CircleX,
  MessageCircle,
  Type,
  type LucideIcon,
} from 'lucide-react';
import {
  IconBell,
  IconBox,
  IconCircleCheck,
  IconCircleX,
  IconCloud,
  IconCode,
  IconDatabase,
  IconFlag,
  IconMail,
  IconMessageCircle,
  IconPlayerPlay,
  IconPuzzle,
  IconRefresh,
  IconRobot,
  IconRoute,
  IconSend,
  IconSettings,
  IconShield,
  IconSparkles,
  IconWorld,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import type { ConnectionSide, FlowNode, NodeColor, NodeIcon, NodeShape, NodeType } from './flowchart-types';

export type { NodeColor, NodeIcon, NodeShape } from './flowchart-types';

// --- Shapes ---------------------------------------------------------------

export interface ShapeSpec {
  /** Path data for the silhouette, drawn around (0,0) within a
   *  NODE_BOUNDING_RADIUS × NODE_BOUNDING_RADIUS box. */
  d: string;
  /** Anchor on each side, in shape-local coords (relative to center). */
  anchors: Record<ConnectionSide, { x: number; y: number }>;
  /** Display label for the inspector button. */
  label: string;
}

/** Half-width of the shape's bounding box. Edges' bounding-radius
 *  logic and the active-path halo both use this. */
export const NODE_BOUNDING_RADIUS = 56;

// --- Database tables ------------------------------------------------------
// One place owns the table card's geometry so the renderer, the size the
// editor writes on create/add-column, and the size ceiling all agree.

/** Height of a table card's name header, in px. */
export const TABLE_HEADER_HEIGHT = 34;
/** Height of one column row, in px. */
export const TABLE_ROW_HEIGHT = 24;
/** Padding below the last row. */
export const TABLE_BODY_PADDING = 8;
export const TABLE_DEFAULT_WIDTH = 236;
export const TABLE_MAX_WIDTH = 420;
export const TABLE_MAX_HEIGHT = 900;

/** Exact height a table card needs for `columnCount` rows. */
export function tableCardHeight(columnCount: number) {
  return Math.min(TABLE_MAX_HEIGHT, TABLE_HEADER_HEIGHT + Math.max(1, columnCount) * TABLE_ROW_HEIGHT + TABLE_BODY_PADDING);
}

// --- Group frames ---------------------------------------------------------
// A group is a container other blocks are dropped into, so its ceiling is
// the whole canvas rather than a card's, and its title sits in a bar the
// user can grab (the body itself stays click-through — see FlowNodeCard).

/** Height of a group frame's title bar, in px. */
export const GROUP_HEADER_HEIGHT = 30;
/** Breathing room a frame keeps around its members when fitted. */
export const GROUP_PADDING = 28;
export const GROUP_DEFAULT_WIDTH = 360;
export const GROUP_DEFAULT_HEIGHT = 260;
export const GROUP_MIN_SIZE = 120;
export const GROUP_MAX_WIDTH = 4000;
export const GROUP_MAX_HEIGHT = 4000;

// --- Free text ------------------------------------------------------------
// A text object is just words on the canvas: no silhouette, no fill, no
// ports. It needs a much smaller floor than a card (a two-word label is
// tiny) and a wider ceiling (a paragraph is not).

export const TEXT_MIN_SIZE = 24;
export const TEXT_DEFAULT_WIDTH = 220;
export const TEXT_DEFAULT_HEIGHT = 48;
export const TEXT_MAX_WIDTH = 1600;
export const TEXT_MAX_HEIGHT = 1200;
/** Inset between the text and its box, so a selected label isn't cramped. */
export const TEXT_PADDING = 6;

export interface NodeSizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * The one place that decides how large a node may be. `resolveNodeStyle`,
 * the drag-resize handles and the inspector's number fields all read it,
 * so a frame, a table, a text object and an ordinary card can't end up
 * with three different opinions about their own ceiling.
 */
export function nodeSizeLimits(node: Pick<FlowNode, 'type' | 'table'>): NodeSizeLimits {
  if (node.type === 'group') {
    return { minWidth: GROUP_MIN_SIZE, minHeight: GROUP_MIN_SIZE, maxWidth: GROUP_MAX_WIDTH, maxHeight: GROUP_MAX_HEIGHT, defaultWidth: GROUP_DEFAULT_WIDTH, defaultHeight: GROUP_DEFAULT_HEIGHT };
  }
  if (node.type === 'text') {
    return { minWidth: TEXT_MIN_SIZE, minHeight: TEXT_MIN_SIZE, maxWidth: TEXT_MAX_WIDTH, maxHeight: TEXT_MAX_HEIGHT, defaultWidth: TEXT_DEFAULT_WIDTH, defaultHeight: TEXT_DEFAULT_HEIGHT };
  }
  if (node.table) {
    return { minWidth: 72, minHeight: 72, maxWidth: TABLE_MAX_WIDTH, maxHeight: TABLE_MAX_HEIGHT, defaultWidth: TABLE_DEFAULT_WIDTH, defaultHeight: 112 };
  }
  return { minWidth: 72, minHeight: 72, maxWidth: 320, maxHeight: 240, defaultWidth: 112, defaultHeight: 112 };
}

const R = NODE_BOUNDING_RADIUS;
// Slight inset so the rounded square doesn't visually clip the inner
// padding of the foreignObject.
const CORNER = 16;
const HEX = R; // hex height = full bbox
// Diamond: square rotated 45°. Anchor the in/out ports on the left/right
// corners of the diamond so edges enter the silhouette cleanly.
const D = R;
const BOX_ANCHORS = {
  top: { x: 0, y: -R },
  right: { x: R, y: 0 },
  bottom: { x: 0, y: R },
  left: { x: -R, y: 0 },
} satisfies ShapeSpec['anchors'];

export const SHAPES: Record<NodeShape, ShapeSpec> = {
  // Plain circle — port at the cardinal points.
  circle: {
    d: `M ${R} 0 A ${R} ${R} 0 1 1 -${R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Circle',
  },
  // Ellipse — same path data as the circle when width === height.
  // Renderers (FlowNodeCard, draw preview) branch on the shape
  // name and draw a true <ellipse> so the silhouette respects the
  // node's actual width/height ratio.
  ellipse: {
    d: `M ${R} 0 A ${R} ${R} 0 1 1 -${R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Ellipse',
  },
  rectangle: {
    d: `M ${-R} ${-R} L ${R} ${-R} L ${R} ${R} L ${-R} ${R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Rectangle',
  },
  // Rounded square — square with the corners pulled in. Slight vertical
  // bias on the port to avoid the rounded corner.
  rounded: {
    d: `M ${-R + CORNER} ${-R}
        L ${R - CORNER} ${-R}
        Q ${R} ${-R} ${R} ${-R + CORNER}
        L ${R} ${R - CORNER}
        Q ${R} ${R} ${R - CORNER} ${R}
        L ${-R + CORNER} ${R}
        Q ${-R} ${R} ${-R} ${R - CORNER}
        L ${-R} ${-R + CORNER}
        Q ${-R} ${-R} ${-R + CORNER} ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Rounded',
  },
  pill: {
    d: `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Pill',
  },
  // Pointy-top hexagon.
  hexagon: {
    d: `M 0 ${-HEX}
        L ${(HEX * Math.sqrt(3)) / 2} ${-HEX / 2}
        L ${(HEX * Math.sqrt(3)) / 2} ${HEX / 2}
        L 0 ${HEX}
        L ${-(HEX * Math.sqrt(3)) / 2} ${HEX / 2}
        L ${-(HEX * Math.sqrt(3)) / 2} ${-HEX / 2} Z`,
    anchors: {
      top: { x: 0, y: -HEX },
      right: { x: (HEX * Math.sqrt(3)) / 2, y: 0 },
      bottom: { x: 0, y: HEX },
      left: { x: -(HEX * Math.sqrt(3)) / 2, y: 0 },
    },
    label: 'Hexagon',
  },
  // Diamond — a square rotated 45° around its center.
  diamond: {
    d: `M 0 ${-D} L ${D} 0 L 0 ${D} L ${-D} 0 Z`,
    anchors: {
      top: { x: 0, y: -D },
      right: { x: D, y: 0 },
      bottom: { x: 0, y: D },
      left: { x: -D, y: 0 },
    },
    label: 'Diamond',
  },
  parallelogram: {
    d: `M ${-R + 18} ${-R} L ${R} ${-R} L ${R - 18} ${R} L ${-R} ${R} Z`,
    anchors: {
      top: { x: 9, y: -R },
      right: { x: R - 9, y: 0 },
      bottom: { x: -9, y: R },
      left: { x: -R + 9, y: 0 },
    },
    label: 'Parallelogram',
  },
  document: {
    d: `M ${-R} ${-R} L ${R} ${-R} L ${R} ${R - 12}
        C ${R / 2} ${R - 28}, ${-R / 2} ${R + 4}, ${-R} ${R - 12} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R - 12 },
      left: { x: -R, y: 0 },
    },
    label: 'Document',
  },
  // Infrastructure / UML silhouettes. Detail strokes are rendered by
  // FlowNodeCard; these paths remain the single source of truth for hit
  // testing, selection halos and connection anchors.
  database: {
    d: `M ${-R} -34
        C ${-R} -49, ${R} -49, ${R} -34
        L ${R} 34
        C ${R} 49, ${-R} 49, ${-R} 34 Z`,
    anchors: {
      top: { x: 0, y: -45 },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: 45 },
      left: { x: -R, y: 0 },
    },
    label: 'Database',
  },
  server: {
    d: `M ${-R + 8} ${-R}
        L ${R - 8} ${-R} Q ${R} ${-R} ${R} ${-R + 8}
        L ${R} ${R - 8} Q ${R} ${R} ${R - 8} ${R}
        L ${-R + 8} ${R} Q ${-R} ${R} ${-R} ${R - 8}
        L ${-R} ${-R + 8} Q ${-R} ${-R} ${-R + 8} ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Server',
  },
  cloud: {
    d: `M -38 36
        C -51 36, -58 23, -53 11
        C -49 3, -42 -1, -34 -1
        C -34 -22, -17 -39, 5 -39
        C 23 -39, 38 -28, 42 -12
        C 52 -9, 57 0, 57 13
        C 57 27, 49 36, 37 36 Z`,
    anchors: {
      top: { x: 5, y: -39 },
      right: { x: 57, y: 13 },
      bottom: { x: 0, y: 36 },
      left: { x: -55, y: 16 },
    },
    label: 'Cloud',
  },
  queue: {
    d: `M ${-R + 10} ${-R} H ${R} V ${R - 10}
        H ${R - 10} V ${R} H ${-R} V ${-R + 10}
        H ${-R + 10} Z`,
    anchors: {
      top: { x: 5, y: -R },
      right: { x: R, y: -5 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 5 },
    },
    label: 'Message Queue',
  },
  component: {
    d: `M ${-R + 10} ${-R} H ${R} V ${R} H ${-R + 10}
        V 26 H ${-R} V 8 H ${-R + 10}
        V -8 H ${-R} V -26 H ${-R + 10} Z`,
    anchors: {
      top: { x: 5, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 5, y: R },
      left: { x: -R, y: 17 },
    },
    label: 'UML Component',
  },
  'predefined-process': {
    d: `M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`,
    anchors: BOX_ANCHORS,
    label: 'Predefined Process',
  },
  folder: {
    d: `M ${-R} -36 H -18 L -8 -52 H 23 L 31 -36 H ${R} V ${R} H ${-R} Z`,
    anchors: {
      top: { x: 8, y: -52 },
      right: { x: R, y: 10 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 10 },
    },
    label: 'Folder',
  },
  note: {
    d: `M ${-R} ${-R} H 23 L ${R} -23 V ${R} H ${-R} Z`,
    anchors: BOX_ANCHORS,
    label: 'File / Note',
  },
  triangle: {
    d: `M 0 ${-R} L ${R} ${R} H ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: 28, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -28, y: 0 },
    },
    label: 'Triangle',
  },
  'triangle-down': {
    d: `M ${-R} ${-R} H ${R} L 0 ${R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: 28, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -28, y: 0 },
    },
    label: 'Triangle Down',
  },
  chevron: {
    d: `M ${-R} ${-R} H 20 L ${R} 0 L 20 ${R} H ${-R} L -20 0 Z`,
    anchors: BOX_ANCHORS,
    label: 'Chevron',
  },
  'internal-storage': {
    d: `M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`,
    anchors: BOX_ANCHORS,
    label: 'Internal Storage',
  },
  'multi-document': {
    d: `M ${-R} -44 H 44 V 42 C 22 29, -22 55, ${-R} 42 Z`,
    anchors: {
      top: { x: -6, y: -44 },
      right: { x: 44, y: 0 },
      bottom: { x: 0, y: 48 },
      left: { x: -R, y: 0 },
    },
    label: 'Multiple Documents',
  },
  'manual-input': {
    d: `M ${-R} -34 L ${R} ${-R} V ${R} H ${-R} Z`,
    anchors: {
      top: { x: 0, y: -45 },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -R, y: 10 },
    },
    label: 'Manual Input',
  },
  delay: {
    d: `M -38 ${-R} H 27 C 66 ${-R}, 66 ${R}, 27 ${R} H -38 C -62 ${R}, -62 ${-R}, -38 ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R },
      right: { x: R, y: 0 },
      bottom: { x: 0, y: R },
      left: { x: -50, y: 0 },
    },
    label: 'Delay',
  },
  trapezoid: {
    d: `M -40 ${-R} H 40 L ${R} ${R} H ${-R} Z`,
    anchors: BOX_ANCHORS,
    label: 'Trapezoid',
  },
  'circle-x': {
    d: `M ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z`,
    anchors: BOX_ANCHORS,
    label: 'Circle X',
  },
  'circle-plus': {
    d: `M ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z`,
    anchors: BOX_ANCHORS,
    label: 'Circle Plus',
  },
  'off-page': {
    d: `M ${-R} ${-R} H ${R} V 24 L 0 ${R} L ${-R} 24 Z`,
    anchors: BOX_ANCHORS,
    label: 'Off-page Connector',
  },
  pentagon: {
    d: `M 0 ${-R} L 53 -18 L 33 ${R} H -33 L -53 -18 Z`,
    anchors: BOX_ANCHORS,
    label: 'Pentagon',
  },
  octagon: {
    d: `M -24 ${-R} H 24 L ${R} -24 V 24 L 24 ${R} H -24 L ${-R} 24 V -24 Z`,
    anchors: BOX_ANCHORS,
    label: 'Octagon',
  },
  cross: {
    d: `M -20 ${-R} H 20 V -20 H ${R} V 20 H 20 V ${R} H -20 V 20 H ${-R} V -20 H -20 Z`,
    anchors: BOX_ANCHORS,
    label: 'Cross',
  },
  'arrow-left': {
    d: `M ${R} -24 H -12 L -12 ${-R} L ${-R} 0 L -12 ${R} L -12 24 H ${R} Z
        M ${R - 8} -16 H -4 L -4 ${-R + 6} L ${-R + 6} 0 L -4 ${R - 6} L -4 16 H ${R - 8} Z`,
    anchors: BOX_ANCHORS,
    label: 'Left Arrow',
  },
  'arrow-right': {
    d: `M ${-R} -24 H 12 L 12 ${-R} L ${R} 0 L 12 ${R} L 12 24 H ${-R} Z
        M ${-R + 8} -16 H 4 L 4 ${-R + 6} L ${R - 6} 0 L 4 ${R - 6} L 4 16 H ${-R + 8} Z`,
    anchors: BOX_ANCHORS,
    label: 'Right Arrow',
  },
  star: {
    d: `M 0 ${-R} L 13 -19 L 53 -17 L 22 7 L 33 47 L 0 25 L -33 47 L -22 7 L -53 -17 L -13 -19 Z`,
    anchors: BOX_ANCHORS,
    label: 'Star',
  },
  'speech-bubble': {
    d: `M -40 -46 H 40 Q ${R} -46 ${R} -30 V 22 Q ${R} 40 38 40 H 5 L -18 ${R} L -13 40 H -40 Q ${-R} 40 ${-R} 22 V -30 Q ${-R} -46 -40 -46 Z`,
    anchors: {
      top: { x: 0, y: -46 },
      right: { x: R, y: 0 },
      bottom: { x: -8, y: R },
      left: { x: -R, y: 0 },
    },
    label: 'Speech Bubble',
  },
};

/**
 * Outline for a node's actual pixel size. `SHAPES[shape].d` is defined
 * once inside a unit square and stretched by non-uniform `scale(x, y)` to
 * fit each node — fine for straight-edged shapes, but for `rounded` that
 * turns the corner's quarter-circle into an ellipse, so wide/short nodes
 * end up with visibly mismatched corner radii between axes. Building the
 * rounded-rect path directly from the node's real width/height keeps the
 * corner radius constant on both axes instead.
 */
export function nodeOutline(shape: NodeShape, width: number, height: number): { d: string; transform: string } {
  if (shape === 'rounded') {
    const hw = width / 2;
    const hh = height / 2;
    const radius = Math.min(CORNER, hw, hh);
    return {
      d: `M ${-hw + radius} ${-hh}
          L ${hw - radius} ${-hh}
          Q ${hw} ${-hh} ${hw} ${-hh + radius}
          L ${hw} ${hh - radius}
          Q ${hw} ${hh} ${hw - radius} ${hh}
          L ${-hw + radius} ${hh}
          Q ${-hw} ${hh} ${-hw} ${hh - radius}
          L ${-hw} ${-hh + radius}
          Q ${-hw} ${-hh} ${-hw + radius} ${-hh} Z`,
      transform: '',
    };
  }
  const scaleX = width / (R * 2);
  const scaleY = height / (R * 2);
  return { d: SHAPES[shape].d, transform: `scale(${scaleX} ${scaleY})` };
}

// --- Colors ---------------------------------------------------------------

export interface ColorSpec {
  /** Tailwind classes for the body's gradient background. */
  gradient: string;
  /** Stroke colour for the body and the active-path ring. */
  ring: string;
  /** Text colour for the title / description / icon. */
  text: string;
  /** Fill colour for the out port dot. */
  port: string;
  /** Concrete colours used by SVG rendering and colour inputs. */
  foreground: `#${string}`;
  background: `#${string}`;
}

export const COLORS: Record<NodeColor, ColorSpec> = {
  red: {
    gradient: 'from-red-500/25 to-red-500/5',
    ring: 'red-400/50',
    text: 'red-100',
    port: 'red-300',
    foreground: '#fee2e2',
    background: '#450a0a',
  },
  orange: {
    gradient: 'from-orange-500/25 to-orange-500/5',
    ring: 'orange-400/50',
    text: 'orange-100',
    port: 'orange-300',
    foreground: '#ffedd5',
    background: '#431407',
  },
  amber: {
    gradient: 'from-amber-500/25 to-amber-500/5',
    ring: 'amber-400/50',
    text: 'amber-100',
    port: 'amber-300',
    foreground: '#fef3c7',
    background: '#451a03',
  },
  yellow: {
    gradient: 'from-yellow-500/25 to-yellow-500/5',
    ring: 'yellow-400/50',
    text: 'yellow-100',
    port: 'yellow-300',
    foreground: '#fef9c3',
    background: '#422006',
  },
  lime: {
    gradient: 'from-lime-500/25 to-lime-500/5',
    ring: 'lime-400/50',
    text: 'lime-100',
    port: 'lime-300',
    foreground: '#ecfccb',
    background: '#1a2e05',
  },
  green: {
    gradient: 'from-green-500/25 to-green-500/5',
    ring: 'green-400/50',
    text: 'green-100',
    port: 'green-300',
    foreground: '#dcfce7',
    background: '#052e16',
  },
  emerald: {
    gradient: 'from-emerald-500/25 to-emerald-500/5',
    ring: 'emerald-400/50',
    text: 'emerald-100',
    port: 'emerald-300',
    foreground: '#d1fae5',
    background: '#022c22',
  },
  teal: {
    gradient: 'from-teal-500/25 to-teal-500/5',
    ring: 'teal-400/50',
    text: 'teal-100',
    port: 'teal-300',
    foreground: '#ccfbf1',
    background: '#042f2e',
  },
  cyan: {
    gradient: 'from-cyan-500/25 to-cyan-500/5',
    ring: 'cyan-400/50',
    text: 'cyan-100',
    port: 'cyan-300',
    foreground: '#cffafe',
    background: '#083344',
  },
  sky: {
    gradient: 'from-sky-500/25 to-sky-500/5',
    ring: 'sky-400/50',
    text: 'sky-100',
    port: 'sky-300',
    foreground: '#dbeafe',
    background: '#082f49',
  },
  blue: {
    gradient: 'from-blue-500/25 to-blue-500/5',
    ring: 'blue-400/50',
    text: 'blue-100',
    port: 'blue-300',
    foreground: '#dbeafe',
    background: '#172554',
  },
  indigo: {
    gradient: 'from-indigo-500/25 to-indigo-500/5',
    ring: 'indigo-400/50',
    text: 'indigo-100',
    port: 'indigo-300',
    foreground: '#e0e7ff',
    background: '#1e1b4b',
  },
  violet: {
    gradient: 'from-violet-500/25 to-violet-500/5',
    ring: 'violet-400/50',
    text: 'violet-100',
    port: 'violet-300',
    foreground: '#ede9fe',
    background: '#2e1065',
  },
  purple: {
    gradient: 'from-purple-500/25 to-purple-500/5',
    ring: 'purple-400/50',
    text: 'purple-100',
    port: 'purple-300',
    foreground: '#f3e8ff',
    background: '#3b0764',
  },
  pink: {
    gradient: 'from-pink-500/25 to-pink-500/5',
    ring: 'pink-400/50',
    text: 'pink-100',
    port: 'pink-300',
    foreground: '#fce7f3',
    background: '#500724',
  },
  rose: {
    gradient: 'from-rose-500/25 to-rose-500/5',
    ring: 'rose-400/50',
    text: 'rose-100',
    port: 'rose-300',
    foreground: '#ffe4e6',
    background: '#4c0519',
  },
  brown: {
    gradient: 'from-[#a97142]/25 to-[#a97142]/5',
    ring: '[#c08a5a]/50',
    text: '[#f3e3d3]',
    port: '[#c08a5a]',
    foreground: '#f3e3d3',
    background: '#2a1a10',
  },
  coral: {
    gradient: 'from-[#ff6f61]/25 to-[#ff6f61]/5',
    ring: '[#ff8f80]/50',
    text: '[#ffdfd9]',
    port: '[#ff8f80]',
    foreground: '#ffdfd9',
    background: '#341411',
  },
};

// --- Icons ----------------------------------------------------------------

export type NodeIconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}>;

// A small curated set resolved instantly with no network fetch. Anything
// outside this set (picked from the full Lucide / Tabler catalogs in the
// icon picker) is resolved on demand — see `useResolvedIcon` in
// `@/lib/icon-library`.
export const LEGACY_ICONS: Record<string, NodeIconComponent> = {
  cog: Cog,
  play: Play,
  flag: Flag,
  bell: Bell,
  mail: Mail,
  database: Database,
  cloud: Cloud,
  code: Code,
  send: Send,
  sparkles: Sparkles,
  'lucide:workflow': Workflow,
  'lucide:rocket': Rocket,
  'lucide:user': User,
  'lucide:webhook': Webhook,
  'lucide:zap': Zap,
  'lucide:shield': Shield,
  'lucide:refresh-ccw': RefreshCcw,
  'lucide:boxes': Boxes,
  'lucide:puzzle': Puzzle,
  'lucide:circle-check': CircleCheck,
  'lucide:circle-x': CircleX,
  'lucide:message-circle': MessageCircle,
  'tabler:settings': IconSettings,
  'tabler:player-play': IconPlayerPlay,
  'tabler:flag': IconFlag,
  'tabler:bell': IconBell,
  'tabler:mail': IconMail,
  'tabler:database': IconDatabase,
  'tabler:cloud': IconCloud,
  'tabler:code': IconCode,
  'tabler:send': IconSend,
  'tabler:sparkles': IconSparkles,
  'tabler:route': IconRoute,
  'tabler:robot': IconRobot,
  'tabler:world': IconWorld,
  'tabler:shield': IconShield,
  'tabler:refresh': IconRefresh,
  'tabler:box': IconBox,
  'tabler:puzzle': IconPuzzle,
  'tabler:circle-check': IconCircleCheck,
  'tabler:circle-x': IconCircleX,
  'tabler:message-circle': IconMessageCircle,
};

// --- Defaults from `type` -------------------------------------------------

/** Default text / icon and border color for nodes without an explicit color. */
export const DEFAULT_FOREGROUND = '#ffffff';

const DEFAULT_BY_TYPE: Record<NodeType, { shape: NodeShape; color: NodeColor; icon: NodeIcon | null }> = {
  start: { shape: 'circle', color: 'sky', icon: 'flag' },
  process: { shape: 'circle', color: 'indigo', icon: 'cog' },
  decision: { shape: 'hexagon', color: 'amber', icon: 'play' },
  output: { shape: 'circle', color: 'emerald', icon: 'bell' },
  logo: { shape: 'rounded', color: 'blue', icon: null },
  group: { shape: 'rounded', color: 'violet', icon: null },
  text: { shape: 'rectangle', color: 'sky', icon: null },
};

// Type-level icons that the picker can fall back to when a node carries
// no explicit icon — only used by `iconForType` which is exported for
// legacy callers (FlowCanvas still uses CircleDashed for some UI bits).
const TYPE_DEFAULT_ICON: Record<NodeType, LucideIcon> = {
  start: CircleDashed,
  process: Cog,
  decision: GitBranch,
  output: CheckCircle2,
  logo: Image,
  group: Boxes,
  text: Type,
};

// --- Resolver -------------------------------------------------------------

export interface ResolvedNodeStyle {
  shape: NodeShape;
  color: NodeColor;
  icon: NodeIcon | null;
  shapeSpec: ShapeSpec;
  colorSpec: ColorSpec;
  foreground: `#${string}`;
  background: `#${string}`;
  borderColor: `#${string}`;
  width: number;
  height: number;
  rotation: number;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  fill: 'flat' | 'sheen';
  shadow: 'none' | 'soft' | 'glow';
  iconSize: number;
  iconPosition: 'top' | 'left' | 'right';
  blockAlign: 'left' | 'center' | 'right';
  fontSize: number;
  fontFamily: NonNullable<FlowNode['fontFamily']>;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  portSize: number;
  /** Convenience: the body's className combining gradient + ring + text. */
  bodyClass: string;
}

export function resolveNodeStyle(node: FlowNode): ResolvedNodeStyle {
  const shape: NodeShape = node.shape ?? DEFAULT_BY_TYPE[node.type].shape;
  const fallbackColor = DEFAULT_BY_TYPE[node.type].color;
  const paletteColor = node.color && node.color in COLORS ? (node.color as NodeColor) : fallbackColor;
  const color: NodeColor = paletteColor;
  const icon: NodeIcon | null = node.icon === null ? null : (node.icon ?? DEFAULT_BY_TYPE[node.type].icon);
  const shapeSpec = SHAPES[shape];
  const colorSpec = COLORS[color];
  const foreground = node.color?.startsWith('#') ? (node.color as `#${string}`) : DEFAULT_FOREGROUND;
  const background = node.backgroundColor ?? colorSpec.background;
  const borderColor = node.borderColor?.startsWith('#') ? (node.borderColor as `#${string}`) : node.borderColor && node.borderColor in COLORS ? COLORS[node.borderColor as NodeColor].foreground : foreground;
  const bodyClass = `bg-linear-to-br ${colorSpec.gradient} ring-1 ring-${colorSpec.ring} text-${colorSpec.text}`;
  const limits = nodeSizeLimits(node);
  return {
    shape,
    color,
    icon,
    shapeSpec,
    colorSpec,
    foreground,
    background,
    borderColor,
    // Limits are per node kind — a frame holds other blocks, a table
    // grows with its column list, a text object can be tiny — and they
    // all come from `nodeSizeLimits` so nothing drifts.
    width: Math.max(limits.minWidth, Math.min(limits.maxWidth, node.width ?? limits.defaultWidth)),
    height: Math.max(limits.minHeight, Math.min(limits.maxHeight, node.height ?? limits.defaultHeight)),
    rotation: node.rotation ?? 0,
    borderWidth: Math.max(0, Math.min(8, node.borderWidth ?? 1.5)),
    borderStyle: node.borderStyle ?? 'solid',
    opacity: Math.max(0.2, Math.min(1, node.opacity ?? 1)),
    // Unset = the gradient, so every saved diagram renders exactly as it
    // did before the field existed. New nodes are stamped 'flat'.
    fill: node.fill ?? 'sheen',
    shadow: node.shadow ?? 'none',
    iconSize: Math.max(12, Math.min(node.type === 'logo' ? 256 : 48, node.iconSize ?? (node.type === 'logo' ? 64 : 20))),
    iconPosition: node.iconPosition ?? 'top',
    blockAlign: node.blockAlign ?? 'center',
    fontFamily: node.fontFamily ?? 'geist-mono',
    fontSize: Math.max(10, Math.min(28, node.fontSize ?? 14)),
    fontWeight: node.fontWeight ?? 'semibold',
    // `justify` existed briefly and may sit in a saved document.
    textAlign: node.textAlign === 'left' || node.textAlign === 'right' ? node.textAlign : 'center',
    portSize: Math.max(4, Math.min(14, node.portSize ?? 9)),
    bodyClass,
  };
}

/** The four icons that map to `NodeType` when a node carries no
 *  explicit icon — used for the type buttons in the palette / legend. */
export function iconForType(type: NodeType): LucideIcon {
  return TYPE_DEFAULT_ICON[type];
}
