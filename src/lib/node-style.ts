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
import type {
  ConnectionSide,
  FlowNode,
  NodeColor,
  NodeIcon,
  NodeShape,
  NodeType,
} from './flowchart-types';

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
      top: { x: 8, y: -52 }, right: { x: R, y: 10 },
      bottom: { x: 0, y: R }, left: { x: -R, y: 10 },
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
      top: { x: 0, y: -R }, right: { x: 28, y: 0 },
      bottom: { x: 0, y: R }, left: { x: -28, y: 0 },
    },
    label: 'Triangle',
  },
  'triangle-down': {
    d: `M ${-R} ${-R} H ${R} L 0 ${R} Z`,
    anchors: {
      top: { x: 0, y: -R }, right: { x: 28, y: 0 },
      bottom: { x: 0, y: R }, left: { x: -28, y: 0 },
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
      top: { x: -6, y: -44 }, right: { x: 44, y: 0 },
      bottom: { x: 0, y: 48 }, left: { x: -R, y: 0 },
    },
    label: 'Multiple Documents',
  },
  'manual-input': {
    d: `M ${-R} -34 L ${R} ${-R} V ${R} H ${-R} Z`,
    anchors: {
      top: { x: 0, y: -45 }, right: { x: R, y: 0 },
      bottom: { x: 0, y: R }, left: { x: -R, y: 10 },
    },
    label: 'Manual Input',
  },
  delay: {
    d: `M -38 ${-R} H 27 C 66 ${-R}, 66 ${R}, 27 ${R} H -38 C -62 ${R}, -62 ${-R}, -38 ${-R} Z`,
    anchors: {
      top: { x: 0, y: -R }, right: { x: R, y: 0 },
      bottom: { x: 0, y: R }, left: { x: -50, y: 0 },
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
      top: { x: 0, y: -46 }, right: { x: R, y: 0 },
      bottom: { x: -8, y: R }, left: { x: -R, y: 0 },
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
export function nodeOutline(
  shape: NodeShape,
  width: number,
  height: number,
): { d: string; transform: string } {
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
  sky: {
    gradient: 'from-sky-500/25 to-sky-500/5',
    ring: 'sky-400/50',
    text: 'sky-100',
    port: 'sky-300',
    foreground: '#dbeafe',
    background: '#082f49',
  },
  indigo: {
    gradient: 'from-indigo-500/25 to-indigo-500/5',
    ring: 'indigo-400/50',
    text: 'indigo-100',
    port: 'indigo-300',
    foreground: '#e0e7ff',
    background: '#1e1b4b',
  },
  amber: {
    gradient: 'from-amber-500/25 to-amber-500/5',
    ring: 'amber-400/50',
    text: 'amber-100',
    port: 'amber-300',
    foreground: '#fef3c7',
    background: '#451a03',
  },
  emerald: {
    gradient: 'from-emerald-500/25 to-emerald-500/5',
    ring: 'emerald-400/50',
    text: 'emerald-100',
    port: 'emerald-300',
    foreground: '#d1fae5',
    background: '#022c22',
  },
  rose: {
    gradient: 'from-rose-500/25 to-rose-500/5',
    ring: 'rose-400/50',
    text: 'rose-100',
    port: 'rose-300',
    foreground: '#ffe4e6',
    background: '#4c0519',
  },
  violet: {
    gradient: 'from-violet-500/25 to-violet-500/5',
    ring: 'violet-400/50',
    text: 'violet-100',
    port: 'violet-300',
    foreground: '#ede9fe',
    background: '#2e1065',
  },
};

// --- Icons ----------------------------------------------------------------

export type NodeIconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}>;

export const ICONS: Record<NodeIcon, NodeIconComponent> = {
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

const DEFAULT_BY_TYPE: Record<NodeType, { shape: NodeShape; color: NodeColor; icon: NodeIcon }> = {
  start: { shape: 'circle', color: 'sky', icon: 'flag' },
  process: { shape: 'circle', color: 'indigo', icon: 'cog' },
  decision: { shape: 'hexagon', color: 'amber', icon: 'play' },
  output: { shape: 'circle', color: 'emerald', icon: 'bell' },
};

// Type-level icons that the picker can fall back to when a node carries
// no explicit icon — only used by `iconForType` which is exported for
// legacy callers (FlowCanvas still uses CircleDashed for some UI bits).
const TYPE_DEFAULT_ICON: Record<NodeType, LucideIcon> = {
  start: CircleDashed,
  process: Cog,
  decision: GitBranch,
  output: CheckCircle2,
};

// --- Resolver -------------------------------------------------------------

export interface ResolvedNodeStyle {
  shape: NodeShape;
  color: NodeColor;
  icon: NodeIcon | null;
  Icon: NodeIconComponent | null;
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
  shadow: 'none' | 'soft' | 'glow';
  iconSize: number;
  iconPosition: 'top' | 'left';
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
  const paletteColor =
    node.color && node.color in COLORS ? (node.color as NodeColor) : fallbackColor;
  const color: NodeColor = paletteColor;
  const icon: NodeIcon | null = node.icon === null
    ? null
    : (node.icon ?? DEFAULT_BY_TYPE[node.type].icon);
  const Icon = icon ? ICONS[icon] : null;
  const shapeSpec = SHAPES[shape];
  const colorSpec = COLORS[color];
  const foreground =
    node.color?.startsWith('#') ? (node.color as `#${string}`) : colorSpec.foreground;
  const background = node.backgroundColor ?? colorSpec.background;
  const borderColor = node.borderColor?.startsWith('#')
    ? (node.borderColor as `#${string}`)
    : node.borderColor && node.borderColor in COLORS
      ? COLORS[node.borderColor as NodeColor].foreground
      : foreground;
  const bodyClass = `bg-linear-to-br ${colorSpec.gradient} ring-1 ring-${colorSpec.ring} text-${colorSpec.text}`;
  return {
    shape,
    color,
    icon,
    Icon,
    shapeSpec,
    colorSpec,
    foreground,
    background,
    borderColor,
    width: Math.max(72, Math.min(320, node.width ?? 112)),
    height: Math.max(72, Math.min(240, node.height ?? 112)),
    rotation: node.rotation ?? 0,
    borderWidth: Math.max(0, Math.min(8, node.borderWidth ?? 1.5)),
    borderStyle: node.borderStyle ?? 'solid',
    opacity: Math.max(0.2, Math.min(1, node.opacity ?? 1)),
    shadow: node.shadow ?? 'none',
    iconSize: Math.max(12, Math.min(48, node.iconSize ?? 20)),
    iconPosition: node.iconPosition ?? 'top',
    fontFamily: node.fontFamily ?? 'geist-mono',
    fontSize: Math.max(10, Math.min(28, node.fontSize ?? 14)),
    fontWeight: node.fontWeight ?? 'semibold',
    textAlign: node.textAlign ?? 'center',
    portSize: Math.max(4, Math.min(14, node.portSize ?? 9)),
    bodyClass,
  };
}

/** The four icons that map to `NodeType` when a node carries no
 *  explicit icon — used for the type buttons in the palette / legend. */
export function iconForType(type: NodeType): LucideIcon {
  return TYPE_DEFAULT_ICON[type];
}
