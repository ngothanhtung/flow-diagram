// Validation and normalisation for Diagram JSON the app didn't write itself
// in this session — pasted into the JSON Playground, pasted onto the canvas
// through the clipboard, restored from localStorage, or read back from
// Firestore (a saved diagram, a public one, a template). Pure, no React.
//
// Two steps, two jobs:
//
// - `validateDocument` *rejects* what can't be shown at all: no
//   `nodes`/`edges` arrays, a node without a usable id, `type`, `title` or
//   numeric `position`, and (strict mode) a line whose ends don't exist.
//   Its message is what the JSON Playground and the paste toast show.
// - `normalizeDocument` *repairs* the rest, field by field: a value
//   outside a field's vocabulary (`lineStart: 'top-left'`), a number that
//   isn't finite, a string where a list belongs, a `parentId` that points
//   nowhere or loops — each is dropped so the field's default applies, and
//   reported in `fixes`. It never throws and is the one gate every
//   document passes before it reaches the store or the Viewer.
//
// The resolvers (`resolveNodeStyle`, `lineCornerOf`, `buildEdgeGeometry`,
// `edgeStylesOf`) also fall back on an out-of-vocabulary value on their
// own, so a document that somehow skipped this gate degrades instead of
// crashing; this module is what keeps the stored document clean.
//
// Unknown keys are kept untouched everywhere (forward compatibility): only
// fields this build knows are checked.

import {
  BLOCK_ALIGNS,
  BORDER_STYLES,
  CONNECTION_SIDES,
  EDGE_DIRECTIONS,
  EDGE_EFFECTS,
  EDGE_LABEL_POSITIONS,
  EDGE_LABEL_SHAPES,
  EDGE_LINE_STYLES,
  EDGE_MARKERS,
  EDGE_ROUTINGS,
  FONT_WEIGHTS,
  ICON_POSITIONS,
  LINE_CORNERS,
  NODE_EFFECTS,
  NODE_FILLS,
  NODE_FONTS,
  NODE_SHADOWS,
  NODE_SHAPES,
  NODE_TYPES,
  RUN_MODES,
  TEXT_ALIGNS,
} from './document-vocabulary';
import type { FlowDocumentJSON } from './flowchart-types';

export interface ValidateDocumentOptions {
  /**
   * The JSON Playground replaces the canvas with the document as-is, so a
   * line pointing at a missing node, or one without an id, is an error
   * there. A paste re-ids every line and drops the ones whose ends aren't
   * part of what was pasted, so it only needs `from`/`to` to be strings.
   */
  lenientEdges?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The node types offered to authors — `logo` is legacy and still loads,
 *  but isn't advertised. */
const ADVERTISED_TYPES = [...NODE_TYPES].filter((type) => type !== 'logo').join(', ');

/**
 * Returns an error message for the first problem found, or null when
 * `parsed` is a `{ nodes, edges }` document that is safe to render:
 * unique non-empty node ids, every node with a known `type`, a string
 * `title` (empty is fine — Icons and Free lines have none) and a numeric
 * `position`, and lines that reference existing nodes. Optional fields
 * are `normalizeDocument`'s job, not this function's.
 */
export function validateDocument(parsed: unknown, options: ValidateDocumentOptions = {}): string | null {
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return 'Document must be an object with "nodes" and "edges" arrays.';
  }
  const nodeIds = new Set<string>();
  for (const node of parsed.nodes as unknown[]) {
    if (!isRecord(node) || typeof node.id !== 'string' || !node.id) return 'Every node needs a non-empty string "id".';
    if (nodeIds.has(node.id)) return `Duplicate node id "${node.id}".`;
    const position = node.position;
    if (typeof node.type !== 'string' || !node.type || typeof node.title !== 'string' || !isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
      return `Node "${node.id}" is missing "type", "title", or a numeric "position".`;
    }
    // `type` decides what a node *is* — guessing would be wrong, so an
    // unknown one is refused rather than repaired.
    if (!NODE_TYPES.has(node.type)) return `Node "${node.id}" has unknown type "${node.type}". Use one of: ${ADVERTISED_TYPES}.`;
    nodeIds.add(node.id);
  }
  for (const edge of parsed.edges as unknown[]) {
    if (!isRecord(edge)) return 'Every edge must be an object.';
    if (options.lenientEdges) {
      if (typeof edge.from !== 'string' || typeof edge.to !== 'string') return 'Every edge needs string "from" and "to" node ids.';
      continue;
    }
    if (typeof edge.id !== 'string' || !edge.id) return 'Every edge needs a non-empty string "id".';
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return `Edge "${edge.id}" references a node id that doesn't exist ("${String(edge.from)}" → "${String(edge.to)}").`;
    }
  }
  return null;
}

/** Narrowing companion to `validateDocument`. */
export function isValidDocument(parsed: unknown, options?: ValidateDocumentOptions): parsed is FlowDocumentJSON {
  return validateDocument(parsed, options) === null;
}

// --- Normalisation ----------------------------------------------------------

/** A field check: the value to keep (possibly coerced), or `REJECT`. */
type FieldRule = (value: unknown) => unknown;
const REJECT = Symbol('reject');

interface Rule {
  check: FieldRule;
  /** What the field expects, for the fix message. */
  expected: string;
}

/** The values a field accepts, for a fix message — the long sets (35
 *  shapes, 19 effects…) are cut short so a toast stays readable. */
function list(values: ReadonlySet<string>) {
  const all = [...values];
  return all.length <= 8 ? all.join(', ') : `${all.slice(0, 6).join(', ')}, … (${all.length} in all, see /guide)`;
}

function oneOf(values: ReadonlySet<string>, aliases: Record<string, string> = {}): Rule {
  return {
    check: (value) => (typeof value === 'string' && values.has(value) ? value : typeof value === 'string' && Object.hasOwn(aliases, value) ? aliases[value] : REJECT),
    expected: `one of ${list(values)}`,
  };
}

/**
 * Largest magnitude any number in a document may have. Far beyond any real
 * canvas coordinate or size, yet small enough that geometry built from it
 * (sums, `Math.hypot`) can't overflow to Infinity — `1e308` is finite, but
 * a path through it isn't.
 */
const NUMBER_LIMIT = 1e9;

function inRange(value: number) {
  return Number.isFinite(value) && Math.abs(value) <= NUMBER_LIMIT;
}

/** A finite number; a numeric string (`"120"`) is read as the number. */
const finite: Rule = {
  check: (value) => {
    if (typeof value === 'number' && inRange(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && inRange(Number(value))) return Number(value);
    return REJECT;
  },
  expected: 'a number (up to ±1e9)',
};

const string: Rule = { check: (value) => (typeof value === 'string' ? value : REJECT), expected: 'a string' };
/** Text that is shown: a number is shown as its digits. */
const text: Rule = { check: (value) => (typeof value === 'string' ? value : isFiniteNumber(value) ? String(value) : REJECT), expected: 'a string' };
const boolean: Rule = { check: (value) => (typeof value === 'boolean' ? value : REJECT), expected: 'true or false' };
/** `null` is meaningful on `icon` (explicitly no icon). */
const iconRule: Rule = { check: (value) => (value === null || typeof value === 'string' ? value : REJECT), expected: 'an icon name or null' };

const point = (value: unknown): { x: number; y: number } | null => {
  if (!isRecord(value)) return null;
  const x = finite.check(value.x);
  const y = finite.check(value.y);
  if (x === REJECT || y === REJECT) return null;
  return x === value.x && y === value.y ? (value as { x: number; y: number }) : { ...value, x: x as number, y: y as number };
};

const markerRule = oneOf(EDGE_MARKERS);

const NODE_RULES: Record<string, Rule> = {
  description: text,
  width: finite,
  height: finite,
  rotation: finite,
  sortOrder: finite,
  duration: finite,
  delay: finite,
  shape: oneOf(NODE_SHAPES),
  color: string,
  backgroundColor: string,
  borderColor: string,
  borderWidth: finite,
  borderStyle: oneOf(BORDER_STYLES),
  opacity: finite,
  fill: oneOf(NODE_FILLS),
  shadow: oneOf(NODE_SHADOWS),
  icon: iconRule,
  iconSize: finite,
  iconPosition: oneOf(ICON_POSITIONS),
  blockAlign: oneOf(BLOCK_ALIGNS),
  fontFamily: oneOf(NODE_FONTS),
  fontSize: finite,
  fontWeight: oneOf(FONT_WEIGHTS),
  textAlign: oneOf(TEXT_ALIGNS),
  portSize: finite,
  effect: oneOf(NODE_EFFECTS),
  effectColor: string,
  effectSpeed: finite,
  effectIntensity: finite,
  // The spelled-out corners are what people (and AIs) write by hand.
  lineStart: oneOf(LINE_CORNERS, { 'top-left': 'nw', 'top-right': 'ne', 'bottom-right': 'se', 'bottom-left': 'sw' }),
  lineFlip: boolean,
  startMarker: markerRule,
  endMarker: markerRule,
  parentId: string,
};

/** Every line field a named style class can also carry (`EDGE_STYLE_FIELDS`). */
const EDGE_STYLE_RULES: Record<string, Rule> = {
  color: string,
  width: finite,
  lineStyle: oneOf(EDGE_LINE_STYLES),
  startMarker: markerRule,
  endMarker: markerRule,
  routing: oneOf(EDGE_ROUTINGS),
  direction: oneOf(EDGE_DIRECTIONS),
  effect: oneOf(EDGE_EFFECTS),
  effectColor: string,
  effectSize: finite,
  effectCount: finite,
  effectDensity: finite,
  effectShape: string,
  animationSpeed: finite,
  glowIntensity: finite,
  glowColor: string,
};

const EDGE_RULES: Record<string, Rule> = {
  ...EDGE_STYLE_RULES,
  fromSide: oneOf(CONNECTION_SIDES),
  toSide: oneOf(CONNECTION_SIDES),
  label: text,
  labelPosition: oneOf(EDGE_LABEL_POSITIONS),
  labelOffset: finite,
  labelShape: oneOf(EDGE_LABEL_SHAPES),
  labelColor: string,
  labelBackground: string,
  labelFontSize: finite,
  labelFontFamily: oneOf(NODE_FONTS),
  fromColumn: string,
  toColumn: string,
  sortOrder: finite,
  duration: finite,
  delay: finite,
  styleRef: string,
};

const COLUMN_RULES: Record<string, Rule> = {
  primaryKey: boolean,
  foreignKey: boolean,
  unique: boolean,
  index: boolean,
  nullable: boolean,
  defaultValue: text,
  note: text,
};

function preview(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return String(value);
    return json.length > 40 ? `${json.slice(0, 37)}…` : json;
  } catch {
    return String(value);
  }
}

/**
 * Applies `rules` to `record`, returning the same object when nothing
 * needed fixing (so a clean document keeps its identity) or a copy with
 * each bad field dropped or coerced. Fields `rules` doesn't name — unknown
 * keys included — are left alone.
 */
function applyRules(record: Record<string, unknown>, rules: Record<string, Rule>, label: string, fixes: string[]): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  for (const [field, rule] of Object.entries(rules)) {
    if (!Object.hasOwn(record, field) || record[field] === undefined) continue;
    const value = record[field];
    const kept = rule.check(value);
    if (kept === value) continue;
    next ??= { ...record };
    if (kept === REJECT) {
      delete next[field];
      fixes.push(`${label}: ignored ${field} ${preview(value)} — expected ${rule.expected}.`);
    } else {
      next[field] = kept;
      fixes.push(`${label}: read ${field} ${preview(value)} as ${preview(kept)}.`);
    }
  }
  return next ?? record;
}

function normalizeTable(value: unknown, label: string, fixes: string[]): unknown {
  if (!isRecord(value)) {
    fixes.push(`${label}: ignored table ${preview(value)} — expected an object with a "columns" list.`);
    return REJECT;
  }
  let table = value;
  if (Object.hasOwn(table, 'schema') && table.schema !== undefined && typeof table.schema !== 'string') {
    table = { ...table };
    delete table.schema;
    fixes.push(`${label}: ignored table schema ${preview(value.schema)} — expected a string.`);
  }
  if (!Array.isArray(table.columns)) {
    fixes.push(`${label}: table columns ${preview(table.columns)} is not a list — the table starts empty.`);
    return { ...table, columns: [] };
  }
  let changed = false;
  const columns: unknown[] = [];
  (table.columns as unknown[]).forEach((column, index) => {
    const columnLabel = `${label} column ${index + 1}`;
    if (!isRecord(column)) {
      fixes.push(`${columnLabel}: ignored ${preview(column)} — expected a column object.`);
      changed = true;
      return;
    }
    let next = applyRules(column, COLUMN_RULES, columnLabel, fixes);
    // id, name and dataType are always read as text by the table card,
    // the columns editor and SQL export.
    const repaired: Record<string, unknown> = {};
    if (typeof next.id !== 'string' || !next.id) repaired.id = `column-${index + 1}`;
    for (const field of ['name', 'dataType'] as const) {
      if (typeof next[field] !== 'string') {
        const kept = text.check(next[field]);
        repaired[field] = kept === REJECT ? '' : kept;
        if (next[field] !== undefined) fixes.push(`${columnLabel}: ${field} ${preview(next[field])} is not text — read as ${preview(repaired[field])}.`);
      }
    }
    if (Object.keys(repaired).length > 0) next = { ...next, ...repaired };
    if (next !== column) changed = true;
    columns.push(next);
  });
  return changed || table !== value ? { ...table, columns } : value;
}

export interface NormalizeResult {
  document: FlowDocumentJSON;
  /** One human-readable line per repair, in document order. Empty when
   *  the input was already clean — and then `document` is the input. */
  fixes: string[];
}

/**
 * Repairs every known field of a Diagram JSON document so it can be
 * rendered and edited — see the top of this file. Total: any input gives
 * a document (a non-document gives an empty one). Returns the input
 * object itself when nothing needed fixing, so loading a clean document
 * changes neither its identity nor its JSON.
 *
 * Structural repairs, beyond per-field ones: nodes without a usable id
 * (or repeating one) are dropped, a missing `title` reads as `''`, a bad
 * `position` as the origin, an unknown `type` as `process`; a `parentId`
 * that points at a missing node, at something that isn't a Frame, or
 * round in a loop is cleared. Lines need string `from`/`to`; outside
 * `lenientEdges` they must also name existing nodes (else they are
 * dropped), and a missing or repeated id is replaced. Named line styles
 * without a string `id` are dropped.
 */
export function normalizeDocument(input: unknown, options: ValidateDocumentOptions = {}): NormalizeResult {
  const fixes: string[] = [];
  if (!isRecord(input)) {
    return { document: { nodes: [], edges: [] }, fixes: ['The document is not an object — loaded an empty diagram.'] };
  }
  let changed = false;

  // Nodes ------------------------------------------------------------------
  const rawNodes: unknown[] = Array.isArray(input.nodes) ? input.nodes : [];
  if (!Array.isArray(input.nodes)) {
    fixes.push('"nodes" is not a list — loaded no Elements.');
    changed = true;
  }
  const seenIds = new Set<string>();
  let nodes: Record<string, unknown>[] = [];
  rawNodes.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || seenIds.has(raw.id)) {
      const why = isRecord(raw) && typeof raw.id === 'string' && raw.id ? `repeats id "${raw.id}"` : 'has no usable id';
      fixes.push(`Node ${index + 1} ${why} — dropped.`);
      changed = true;
      return;
    }
    seenIds.add(raw.id);
    const label = `Node "${raw.id}"`;
    let node = applyRules(raw, NODE_RULES, label, fixes);
    const structural: Record<string, unknown> = {};
    if (typeof node.type !== 'string' || !NODE_TYPES.has(node.type)) {
      structural.type = 'process';
      fixes.push(`${label}: unknown type ${preview(node.type)} — read as "process".`);
    }
    if (typeof node.title !== 'string') {
      const kept = text.check(node.title);
      structural.title = kept === REJECT ? '' : kept;
      if (node.title !== undefined) fixes.push(`${label}: title ${preview(node.title)} is not text — read as ${preview(structural.title)}.`);
    }
    const position = point(node.position);
    if (!position) {
      structural.position = { x: 0, y: 0 };
      fixes.push(`${label}: position ${preview(node.position)} is not a point — placed at the origin.`);
    } else if (position !== node.position) {
      structural.position = position;
    }
    if (node.connectionPoints !== undefined) {
      const points = node.connectionPoints;
      const input = isRecord(points) && typeof points.input === 'string' && CONNECTION_SIDES.has(points.input);
      const output = isRecord(points) && typeof points.output === 'string' && CONNECTION_SIDES.has(points.output);
      if (!input || !output) {
        fixes.push(`${label}: ignored connectionPoints ${preview(points)} — expected { input, output } sides (${list(CONNECTION_SIDES)}).`);
        structural.connectionPoints = undefined;
      }
    }
    if (node.table !== undefined) {
      const table = normalizeTable(node.table, label, fixes);
      if (table !== node.table) structural.table = table === REJECT ? undefined : table;
    }
    if (Object.keys(structural).length > 0) {
      node = { ...node, ...structural };
      for (const [field, value] of Object.entries(structural)) if (value === undefined) delete node[field];
    }
    if (node !== raw) changed = true;
    nodes.push(node);
  });

  // Frame membership: a parent must exist, be a Frame, and not loop back.
  const byId = new Map(nodes.map((node) => [node.id as string, node]));
  const clearParent = new Set<string>();
  for (const node of nodes) {
    const parentId = node.parentId;
    if (parentId === undefined) continue;
    const parent = typeof parentId === 'string' ? byId.get(parentId) : undefined;
    if (!parent || parent === node || parent.type !== 'group') {
      // In a paste, a parent outside the fragment is normal: the copy is
      // re-homed by the drop rule, so clear it without a word.
      if (!(options.lenientEdges && !parent)) fixes.push(`Node "${node.id}": parentId ${preview(parentId)} is not a Frame in this diagram — cleared.`);
      clearParent.add(node.id as string);
    }
  }
  for (const node of nodes) {
    if (clearParent.has(node.id as string)) continue;
    // Walk up; arriving back at this node means a loop. Clearing this
    // node's link breaks it, and later nodes on the loop then terminate.
    const seen = new Set<string>([node.id as string]);
    let current = typeof node.parentId === 'string' ? byId.get(node.parentId) : undefined;
    while (current && !clearParent.has(current.id as string)) {
      if (seen.has(current.id as string)) {
        if (current === node) {
          clearParent.add(node.id as string);
          fixes.push(`Node "${node.id}": parentId "${node.parentId}" puts it inside itself — cleared.`);
        }
        break;
      }
      seen.add(current.id as string);
      current = typeof current.parentId === 'string' ? byId.get(current.parentId) : undefined;
    }
  }
  if (clearParent.size > 0) {
    changed = true;
    nodes = nodes.map((node) => {
      if (!clearParent.has(node.id as string)) return node;
      const next = { ...node };
      delete next.parentId;
      return next;
    });
  }

  // Lines ------------------------------------------------------------------
  const rawEdges: unknown[] = Array.isArray(input.edges) ? input.edges : [];
  if (!Array.isArray(input.edges)) {
    fixes.push('"edges" is not a list — loaded no Lines.');
    changed = true;
  }
  const edgeIds = new Set<string>();
  const edges: Record<string, unknown>[] = [];
  rawEdges.forEach((raw, index) => {
    const name = isRecord(raw) && typeof raw.id === 'string' && raw.id ? `Line "${raw.id}"` : `Line ${index + 1}`;
    if (!isRecord(raw) || typeof raw.from !== 'string' || typeof raw.to !== 'string') {
      fixes.push(`${name} has no string "from"/"to" — dropped.`);
      changed = true;
      return;
    }
    if (!options.lenientEdges && (!byId.has(raw.from) || !byId.has(raw.to))) {
      fixes.push(`${name} connects "${raw.from}" → "${raw.to}", which isn't two Elements of this diagram — dropped.`);
      changed = true;
      return;
    }
    let edge = applyRules(raw, EDGE_RULES, name, fixes);
    if (edge.bendPoints !== undefined) {
      const bendPoints = Array.isArray(edge.bendPoints) ? edge.bendPoints.map(point) : null;
      if (!bendPoints) {
        fixes.push(`${name}: ignored bendPoints ${preview(edge.bendPoints)} — expected a list of points.`);
        edge = { ...edge };
        delete edge.bendPoints;
      } else if (bendPoints.some((bend, at) => bend !== (edge.bendPoints as unknown[])[at])) {
        const kept = bendPoints.filter((bend): bend is { x: number; y: number } => bend !== null);
        if (kept.length < bendPoints.length) fixes.push(`${name}: ignored ${bendPoints.length - kept.length} bend point(s) that aren't points.`);
        edge = { ...edge, bendPoints: kept };
      }
    }
    if (!options.lenientEdges) {
      const id = typeof edge.id === 'string' && edge.id ? edge.id : null;
      if (!id || edgeIds.has(id)) {
        let fresh = `edge-${index + 1}`;
        for (let suffix = 2; edgeIds.has(fresh) || rawEdges.some((other) => isRecord(other) && other.id === fresh); suffix += 1) fresh = `edge-${index + 1}-${suffix}`;
        fixes.push(`${name} ${id ? 'repeats an id' : 'has no id'} — given id "${fresh}".`);
        edge = { ...edge, id: fresh };
      }
      edgeIds.add(edge.id as string);
    }
    if (edge !== raw) changed = true;
    edges.push(edge);
  });

  // Settings -----------------------------------------------------------------
  let settings = input.settings;
  if (settings !== undefined) {
    if (!isRecord(settings)) {
      fixes.push(`Ignored settings ${preview(settings)} — expected an object.`);
      settings = undefined;
    } else {
      let next = applyRules(settings, { runMode: oneOf(RUN_MODES), repeatEnabled: boolean }, 'Settings', fixes);
      if (next.edgeStyles !== undefined) {
        if (!Array.isArray(next.edgeStyles)) {
          fixes.push(`Ignored settings.edgeStyles ${preview(next.edgeStyles)} — expected a list of line styles.`);
          next = { ...next };
          delete next.edgeStyles;
        } else {
          let stylesChanged = false;
          const styles: unknown[] = [];
          (next.edgeStyles as unknown[]).forEach((raw, index) => {
            if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) {
              fixes.push(`Line style ${index + 1} has no string id — dropped.`);
              stylesChanged = true;
              return;
            }
            const label = `Line style "${raw.id}"`;
            let style = applyRules(raw, EDGE_STYLE_RULES, label, fixes);
            if (typeof style.name !== 'string') {
              const kept = text.check(style.name);
              style = { ...style, name: kept === REJECT ? raw.id : kept };
            }
            if (style !== raw) stylesChanged = true;
            styles.push(style);
          });
          if (stylesChanged) next = { ...next, edgeStyles: styles };
        }
      }
      settings = next;
    }
    if (settings !== input.settings) changed = true;
  }

  if (!changed) return { document: input as unknown as FlowDocumentJSON, fixes };
  const document: Record<string, unknown> = { ...input, nodes, edges };
  if (settings === undefined) delete document.settings;
  else document.settings = settings;
  return { document: document as unknown as FlowDocumentJSON, fixes };
}

export type ParseDocumentResult = { ok: true; document: FlowDocumentJSON; fixes: string[] } | { ok: false; error: string };

/**
 * `validateDocument` then `normalizeDocument`: what the two text paths
 * (JSON Playground, ⌘V) run on parsed JSON. Refuses what can't be shown;
 * repairs the rest and says what it repaired.
 */
export function checkDocument(parsed: unknown, options: ValidateDocumentOptions = {}): ParseDocumentResult {
  const error = validateDocument(parsed, options);
  if (error) return { ok: false, error };
  const { document, fixes } = normalizeDocument(parsed, options);
  return { ok: true, document, fixes };
}

/** A short summary of `fixes` for a toast: the first few, then a count. */
export function summarizeFixes(fixes: readonly string[], limit = 3): string {
  const shown = fixes.slice(0, limit).join(' ');
  return fixes.length > limit ? `${shown} …and ${fixes.length - limit} more.` : shown;
}
