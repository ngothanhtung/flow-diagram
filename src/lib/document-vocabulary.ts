// The closed value sets of Diagram JSON, at runtime.
//
// `flowchart-types.ts` states them as union types, which vanish at runtime;
// these are the same lists as values, for the two places that have to
// check a document they didn't write themselves: `normalizeDocument`
// (document-validation.ts), which drops a value outside its set, and the
// resolvers (`resolveNodeStyle`, `lineCornerOf`, `buildEdgeGeometry`…),
// which fall back to the default instead of indexing a lookup table with
// it and crashing.
//
// Every list goes through `allOf<Union>()`, which refuses to compile when
// a member of the union is missing — add a value to a union in
// flowchart-types.ts and the matching list here fails the typecheck until
// it is added too. (A value in the list that isn't in the union fails the
// `readonly T[]` constraint the same way.)

import type {
  ConnectionSide,
  EdgeDirection,
  EdgeEffect,
  EdgeLabelPosition,
  EdgeLabelShape,
  EdgeLineStyle,
  EdgeMarker,
  EdgeRouting,
  FlowNode,
  LineCorner,
  NodeEffect,
  NodeFont,
  NodeShape,
  NodeType,
  RunMode,
} from './flowchart-types';

type Missing<T, A extends readonly T[]> = Exclude<T, A[number]>;

/** A runtime list of every member of the union `T`, checked at compile time. */
function allOf<T extends string>() {
  return <const A extends readonly T[]>(...values: A & ([Missing<T, A>] extends [never] ? unknown : { missing: Missing<T, A> })): ReadonlySet<string> => new Set<string>(values);
}

export const NODE_TYPES = allOf<NodeType>()('start', 'process', 'decision', 'output', 'logo', 'group', 'text', 'icon', 'line');
export const NODE_SHAPES = allOf<NodeShape>()(
  'circle',
  'ellipse',
  'rectangle',
  'rounded',
  'pill',
  'hexagon',
  'diamond',
  'parallelogram',
  'document',
  'database',
  'server',
  'cloud',
  'queue',
  'component',
  'predefined-process',
  'folder',
  'note',
  'triangle',
  'triangle-down',
  'chevron',
  'internal-storage',
  'multi-document',
  'manual-input',
  'delay',
  'trapezoid',
  'circle-x',
  'circle-plus',
  'off-page',
  'pentagon',
  'octagon',
  'cross',
  'arrow-left',
  'arrow-right',
  'star',
  'speech-bubble',
);
export const LINE_CORNERS = allOf<LineCorner>()('nw', 'ne', 'se', 'sw');
export const CONNECTION_SIDES = allOf<ConnectionSide>()('top', 'right', 'bottom', 'left');
export const NODE_EFFECTS = allOf<NodeEffect>()('none', 'float', 'breathe', 'shake', 'wobble', 'bounce', 'blink', 'glow', 'pulse', 'ripple', 'trace', 'sheen');
export const NODE_FONTS = allOf<NodeFont>()('geist-mono', 'be-vietnam-pro', 'noto-sans', 'source-sans-3', 'roboto-slab', 'merriweather');
export const BORDER_STYLES = allOf<NonNullable<FlowNode['borderStyle']>>()('solid', 'dashed', 'dotted');
export const NODE_FILLS = allOf<NonNullable<FlowNode['fill']>>()('flat', 'sheen');
export const NODE_SHADOWS = allOf<NonNullable<FlowNode['shadow']>>()('none', 'soft', 'glow');
export const ICON_POSITIONS = allOf<NonNullable<FlowNode['iconPosition']>>()('top', 'left', 'right');
export const BLOCK_ALIGNS = allOf<NonNullable<FlowNode['blockAlign']>>()('left', 'center', 'right');
export const FONT_WEIGHTS = allOf<NonNullable<FlowNode['fontWeight']>>()('normal', 'medium', 'semibold', 'bold');
/** `justify` existed briefly and may sit in a saved document; it renders
 *  as `center` (see `resolveNodeStyle`), so it is accepted rather than
 *  rewritten. */
export const TEXT_ALIGNS: ReadonlySet<string> = new Set([...allOf<NonNullable<FlowNode['textAlign']>>()('left', 'center', 'right'), 'justify']);

export const EDGE_EFFECTS = allOf<EdgeEffect>()(
  'none',
  'flow',
  'pulse',
  'glow',
  'comet',
  'dots',
  'scanner',
  'bidirectional',
  'laser',
  'meteor',
  'heartbeat',
  'rail',
  'fade',
  'convoy',
  'chase',
  'charging',
  'morse',
  'ants',
  'blink',
);
export const EDGE_MARKERS = allOf<EdgeMarker>()(
  'none',
  'arrow',
  'open-arrow',
  'triangle',
  'circle',
  'diamond',
  'tee',
  'cross',
  'circle-cross',
  'arrow-both',
  'arrow-bar',
  'bar',
  'crow-one',
  'crow-many',
  'crow-one-many',
  'crow-zero-one',
  'crow-zero-many',
);
export const EDGE_DIRECTIONS = allOf<EdgeDirection>()('forward', 'reverse', 'both');
export const EDGE_ROUTINGS = allOf<EdgeRouting>()('straight', 'smooth-step', 'orthogonal', 'curved');
export const EDGE_LINE_STYLES = allOf<EdgeLineStyle>()('solid', 'dashed', 'dotted');
export const EDGE_LABEL_POSITIONS = allOf<EdgeLabelPosition>()('center', 'left', 'right', 'top', 'bottom');
export const EDGE_LABEL_SHAPES = allOf<EdgeLabelShape>()('pill', 'hexagon', 'rectangle');
export const RUN_MODES = allOf<RunMode>()('sequential', 'concurrent', 'manual', 'static');

/** `value` when it is a member of `set`, else `fallback`. Typed by the
 *  fallback so a resolver keeps its precise union type. */
export function memberOr<T extends string>(set: ReadonlySet<string>, value: unknown, fallback: T): T {
  return typeof value === 'string' && set.has(value) ? (value as T) : fallback;
}

/** `value` when it is a finite number, else `fallback`. */
export function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
