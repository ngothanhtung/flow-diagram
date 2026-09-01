import type { DiagramSettings, EdgeLineStyle, EdgeStyleClass, EdgeStyleProps, FlowDocumentJSON, FlowEdge, LegendItem } from './flowchart-types';

/**
 * Named line styles: the document's line vocabulary.
 *
 * What makes a large diagram readable is not the individual lines but
 * how few *kinds* of line there are. A class names one kind once; every
 * line pointing at it (`FlowEdge.styleRef`) follows, so changing the
 * vocabulary is one edit rather than one edit per line.
 *
 * The resolution rule is the same one `resolveNodeStyle` uses for nodes:
 * **a line's own explicit field wins over its class**, and the class
 * wins over the built-in default. That keeps a class a *default set*
 * rather than a lock — a single line can still deviate — while the
 * editor makes an assignment visibly take effect by clearing the line's
 * own values for the fields the class defines (`clearStyleOverrides`).
 */

/**
 * Every field a class can define, as a runtime list. `EdgeStyleProps` is
 * the compile-time half of the same statement; the `satisfies` below is
 * what stops the two from drifting when a field is added to either.
 */
export const EDGE_STYLE_FIELDS = ['color', 'width', 'lineStyle', 'startMarker', 'endMarker', 'routing', 'direction', 'effect', 'effectColor', 'effectSize', 'effectCount', 'effectDensity', 'effectShape', 'animationSpeed', 'glowIntensity', 'glowColor'] as const satisfies ReadonlyArray<keyof EdgeStyleProps>;

export type EdgeStyleField = (typeof EDGE_STYLE_FIELDS)[number];

/**
 * The vocabulary a document starts with when the user first opens the
 * style palette — four kinds of line, which is about as many as a reader
 * can hold at once. Colours are mid-tone on purpose: like every other
 * piece of diagram content they never follow the app theme, so each one
 * has to read on a light *and* a dark canvas.
 */
export const STARTER_EDGE_STYLES: EdgeStyleClass[] = [
  { id: 'primary', name: 'Primary flow', color: '#38bdf8', width: 2.5, lineStyle: 'solid', endMarker: 'arrow', effect: 'flow' },
  { id: 'default', name: 'Secondary', color: '#94a3b8', width: 2, lineStyle: 'solid', endMarker: 'open-arrow', effect: 'none' },
  { id: 'async', name: 'Async / event', color: '#a78bfa', width: 2, lineStyle: 'dashed', endMarker: 'arrow', effect: 'dots' },
  { id: 'policy', name: 'Policy / control', color: '#fbbf24', width: 2, lineStyle: 'dotted', endMarker: 'open-arrow', effect: 'none' },
];

/** The classes a document defines, or an empty list. */
export function edgeStylesOf(settings: DiagramSettings | undefined): EdgeStyleClass[] {
  return settings?.edgeStyles ?? [];
}

/** The class a line follows, or null — including when `styleRef` points
 *  at a class that has since been deleted. */
export function edgeStyleOf(edge: FlowEdge, styles: EdgeStyleClass[]): EdgeStyleClass | null {
  if (!edge.styleRef) return null;
  return styles.find((style) => style.id === edge.styleRef) ?? null;
}

/**
 * The line as it should render: its class's fields filled in wherever it
 * doesn't set its own. Returns the edge object itself when there is
 * nothing to merge, so callers can memoize on identity.
 */
export function resolveEdgeStyle(edge: FlowEdge, styles: EdgeStyleClass[]): FlowEdge {
  const style = edgeStyleOf(edge, styles);
  if (!style) return edge;
  const inherited: Partial<EdgeStyleProps> = {};
  let count = 0;
  for (const field of EDGE_STYLE_FIELDS) {
    if (edge[field] !== undefined || style[field] === undefined) continue;
    // The key and the value come from the same field, so this is sound;
    // `Object.assign` is what lets TypeScript see that without a cast to
    // an index signature `FlowEdge` doesn't have.
    Object.assign(inherited, { [field]: style[field] });
    count += 1;
  }
  // A spread of the edge would clobber inherited values with the
  // explicit `undefined`s a `Partial` patch leaves behind, so the
  // inherited fields go on second.
  return count === 0 ? edge : { ...edge, ...inherited };
}

/** The default a legend row falls back to when neither it nor its class
 *  names a colour. */
const LEGEND_FALLBACK_COLOR = '#94a3b8';

/**
 * A legend row with its class resolved: concrete colour, stroke pattern
 * and label, whatever mix of own fields and `styleRef` produced them.
 * Same precedence as everywhere else — the row's own value wins.
 */
export function resolveLegendItem(item: LegendItem, styles: EdgeStyleClass[]): LegendItem & { color: `#${string}`; lineStyle: EdgeLineStyle } {
  const style = item.styleRef ? styles.find((candidate) => candidate.id === item.styleRef) : undefined;
  return {
    ...item,
    color: item.color ?? style?.color ?? LEGEND_FALLBACK_COLOR,
    lineStyle: item.lineStyle ?? style?.lineStyle ?? (item.dashed ? 'dashed' : 'solid'),
    label: item.label || style?.name || '',
  };
}

/**
 * The document ready to paint: every line and every legend row resolved
 * against the palette. Returns the document itself when no class is in
 * use, which is both the common case and what lets the canvas memoize
 * on identity.
 */
export function resolveDocumentStyles(doc: FlowDocumentJSON): FlowDocumentJSON {
  const styles = edgeStylesOf(doc.settings);
  if (styles.length === 0) return doc;
  let changed = false;
  const edges = doc.edges.map((edge) => {
    const resolved = resolveEdgeStyle(edge, styles);
    if (resolved !== edge) changed = true;
    return resolved;
  });
  const nodes = doc.nodes.map((node) => {
    if (!node.legend?.items.some((item) => item.styleRef)) return node;
    changed = true;
    return { ...node, legend: { ...node.legend, items: node.legend.items.map((item) => resolveLegendItem(item, styles)) } };
  });
  return changed ? { ...doc, edges, nodes } : doc;
}

/**
 * The classes at least one line actually follows, in palette order —
 * what a generated legend lists. A class nobody uses is vocabulary the
 * reader never meets, so putting it in the key would mislead.
 */
export function usedEdgeStyles(doc: FlowDocumentJSON): EdgeStyleClass[] {
  const used = new Set(doc.edges.map((edge) => edge.styleRef).filter((ref): ref is string => Boolean(ref)));
  return edgeStylesOf(doc.settings).filter((style) => used.has(style.id));
}

/**
 * Legend rows for the line vocabulary the document is actually using.
 * Each row carries nothing but its `styleRef`, so it keeps naming the
 * class correctly as the class is renamed or recoloured — generating is
 * a one-time action, staying in sync is not.
 */
export function buildLegendItemsFromDocument(doc: FlowDocumentJSON): LegendItem[] {
  return usedEdgeStyles(doc).map((style) => ({ id: `legend-${style.id}`, kind: 'line' as const, label: '', styleRef: style.id }));
}

/**
 * Which of the class's fields this line overrides with its own value.
 * The inspector uses it to say so out loud — an override is easy to
 * create by accident and impossible to spot otherwise.
 */
export function edgeStyleOverrides(edge: FlowEdge, style: EdgeStyleClass): EdgeStyleField[] {
  return EDGE_STYLE_FIELDS.filter((field) => style[field] !== undefined && edge[field] !== undefined);
}

/**
 * A patch clearing every field the class owns, so the line renders as
 * the class defines it. Used both when assigning a class (otherwise the
 * assignment would appear to do nothing on a line that already carries
 * explicit colours) and by the inspector's "Reset to style" action.
 */
export function clearStyleOverrides(style: EdgeStyleClass | null): Partial<FlowEdge> {
  const patch: Record<string, undefined> = {};
  for (const field of EDGE_STYLE_FIELDS) {
    if (!style || style[field] !== undefined) patch[field] = undefined;
  }
  return patch as Partial<FlowEdge>;
}

/**
 * `stroke-dasharray` for a line's stroke pattern, scaled by its width so
 * a 1px dotted line and a 6px one read as the same style rather than the
 * thick one turning into a solid rule. Solid returns undefined — no
 * attribute at all, which is what every pre-existing line renders as.
 *
 * Dotted needs `stroke-linecap: round` to actually be dots; see
 * `edgeLineCap`.
 */
export function edgeLineDash(lineStyle: EdgeLineStyle | undefined, width: number): string | undefined {
  if (lineStyle === 'dashed') return `${(width * 3).toFixed(2)} ${(width * 2.2).toFixed(2)}`;
  // A zero-length dash with a round cap paints a circle of the stroke's
  // diameter; any positive length would render as a short capsule.
  if (lineStyle === 'dotted') return `0 ${(width * 2.4).toFixed(2)}`;
  return undefined;
}

export function edgeLineCap(lineStyle: EdgeLineStyle | undefined): 'round' | 'butt' {
  return lineStyle === 'dotted' ? 'round' : 'butt';
}

/** A fresh class id that doesn't collide with an existing one. */
export function nextEdgeStyleId(styles: EdgeStyleClass[]): string {
  const used = new Set(styles.map((style) => style.id));
  for (let index = styles.length + 1; ; index += 1) {
    const id = `style-${index}`;
    if (!used.has(id)) return id;
  }
}
