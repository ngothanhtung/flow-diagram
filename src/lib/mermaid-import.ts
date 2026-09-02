import { layoutDocument, type LayoutDirection } from './auto-layout';
import type { EdgeMarker, FlowDocumentJSON, FlowEdge, FlowNode, NodeShape, NodeType, TableColumn } from './flowchart-types';
import { tableCardHeight } from './node-style';

/**
 * Mermaid → `FlowDocumentJSON`.
 *
 * A hand-written parser for the three diagram kinds this app draws, not
 * a general mermaid implementation: mermaid's own grammar covers a dozen
 * chart types this editor has no representation for, and pulling it in
 * to reject most of what it parses would be a large dependency doing
 * mostly nothing. What's here is the subset people actually paste.
 *
 * Unrecognised lines are collected as warnings rather than throwing. A
 * paste that is 90% understood is far more useful than an error, and the
 * warnings tell the user exactly what was dropped.
 */

export interface MermaidImportResult {
  document: FlowDocumentJSON;
  /** What kind of diagram the header declared. */
  kind: 'flowchart' | 'er';
  /** Lines that parsed but lost something, or didn't parse at all. */
  warnings: string[];
}

export class MermaidImportError extends Error {}

/**
 * Palette used for imported nodes, cycled so a diagram isn't monotone.
 * These are diagram *content*, so they never follow the app theme and
 * every value has to read on a light and a dark canvas alike —
 * `color`/`backgroundColor` are the pale-on-deep pair a filled card
 * wears.
 */
const IMPORT_PAINT: Array<{ color: `#${string}`; backgroundColor: `#${string}` }> = [
  { color: '#c7d2fe', backgroundColor: '#1e293b' },
  { color: '#bae6fd', backgroundColor: '#172554' },
  { color: '#a7f3d0', backgroundColor: '#052e2b' },
  { color: '#fde68a', backgroundColor: '#422006' },
  { color: '#e9d5ff', backgroundColor: '#2e1065' },
];

/**
 * Ink for every imported line.
 *
 * An edge with no colour of its own inherits the *source node's*
 * foreground, and those are pale-on-dark palette values — at the base
 * path's 52% stroke opacity they all but vanish on a light canvas. A
 * mid-tone slate is legible against either background, which is the
 * same rule every other piece of diagram content follows.
 */
const LINE_INK = '#64748b';

export function importMermaid(source: string): MermaidImportResult {
  const lines = source
    .split('\n')
    .map((line) => line.replace(/%%.*$/, '').trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) throw new MermaidImportError('Nothing to import — paste a mermaid diagram first.');

  const header = lines[0].toLowerCase();
  if (header.startsWith('erdiagram')) return importEr(lines.slice(1));
  if (header.startsWith('flowchart') || header.startsWith('graph')) return importFlowchart(lines, header);
  throw new MermaidImportError(`Unsupported diagram type: "${lines[0]}". This importer understands flowchart / graph and erDiagram.`);
}

// --- Flowchart -------------------------------------------------------------

/** Mermaid's bracket pairs, and the silhouette each maps onto. Ordered
 *  longest-open-token first so `[(` is matched before `[`. */
const FLOW_SHAPES: Array<{ open: string; close: string; shape: NodeShape; type?: NodeType }> = [
  { open: '[(', close: ')]', shape: 'database' },
  { open: '[[', close: ']]', shape: 'predefined-process' },
  { open: '[/', close: '/]', shape: 'parallelogram' },
  { open: '[\\', close: '\\]', shape: 'parallelogram' },
  { open: '((', close: '))', shape: 'circle', type: 'start' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '>', close: ']', shape: 'chevron' },
  { open: '{', close: '}', shape: 'diamond', type: 'decision' },
  { open: '(', close: ')', shape: 'pill' },
  { open: '[', close: ']', shape: 'rounded' },
];

/**
 * The inline-label forms — `A -- text --> B`. Tried before the plain
 * operators below, because `--` is a prefix of `-->`.
 *
 * The label's first character may not be one of `-` `>` `=` `.`, which
 * is what stops `A --> B --> C` from being read as a link labelled
 * "> B": the lazy `.+?` would otherwise happily swallow the next node
 * and stop at the second arrow.
 */
const FLOW_LABELLED_LINKS: Array<{ token: RegExp; dashed?: boolean; thick?: boolean; arrow: boolean }> = [
  { token: /^-\.\s*([^->=.\s][\s\S]*?)\s*\.->/, dashed: true, arrow: true },
  { token: /^-\.\s*([^->=.\s][\s\S]*?)\s*\.-/, dashed: true, arrow: false },
  { token: /^==\s*([^->=.\s][\s\S]*?)\s*==>/, thick: true, arrow: true },
  { token: /^==\s*([^->=.\s][\s\S]*?)\s*===/, thick: true, arrow: false },
  { token: /^--\s*([^->=.\s][\s\S]*?)\s*-->/, arrow: true },
  { token: /^--\s*([^->=.\s][\s\S]*?)\s*---/, arrow: false },
];

/**
 * The plain operators, longest first so `-.->` isn't matched as `-.` +
 * `->`. `dashed`/`thick` map onto `lineStyle` and `width`, which is what
 * those shapes mean in mermaid — a different *kind* of line, not
 * decoration.
 */
const FLOW_LINKS: Array<{ token: RegExp; dashed?: boolean; thick?: boolean; arrow: boolean }> = [
  { token: /^<-->/, arrow: true },
  { token: /^-\.->/, dashed: true, arrow: true },
  { token: /^-\.-/, dashed: true, arrow: false },
  { token: /^==>/, thick: true, arrow: true },
  { token: /^===/, thick: true, arrow: false },
  { token: /^-->/, arrow: true },
  { token: /^---/, arrow: false },
];

function importFlowchart(lines: string[], header: string): MermaidImportResult {
  const warnings: string[] = [];
  const direction: LayoutDirection = /\b(lr|rl)\b/.test(header) ? 'LR' : 'TB';
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  // Mermaid subgraphs become group frames. Membership is recorded as we
  // go and applied at the end, once every node exists.
  const subgraphStack: string[] = [];
  const membership = new Map<string, string>();
  const subgraphs = new Map<string, string>();

  const ensureNode = (id: string, label?: string, shape?: NodeShape, type?: NodeType) => {
    const existing = nodes.get(id);
    if (existing) {
      // A later mention carrying a label wins: mermaid lets you declare
      // `A --> B` first and give B its label further down.
      if (label !== undefined) existing.title = label;
      if (shape !== undefined) existing.shape = shape;
      if (type !== undefined) existing.type = type;
      return existing;
    }
    const paint = IMPORT_PAINT[nodes.size % IMPORT_PAINT.length];
    const node: FlowNode = {
      id,
      type: type ?? 'process',
      title: label ?? id,
      position: { x: 0, y: 0 },
      width: 150,
      height: 84,
      shape: shape ?? 'rounded',
      sortOrder: nodes.size + 1,
      icon: null,
      color: paint.color,
      backgroundColor: paint.backgroundColor,
      borderColor: paint.color,
      borderWidth: 2,
      shadow: 'none',
      fill: 'flat',
      fontSize: 13,
      textAlign: 'center',
    };
    nodes.set(id, node);
    return node;
  };

  // Mermaid puts a node in a subgraph by *mentioning* it inside the
  // block, and the node itself is usually declared earlier — so this
  // records membership on every mention, not just on creation.
  const noteMembership = (id: string) => {
    if (subgraphStack.length > 0) membership.set(id, subgraphStack.at(-1)!);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (/^(flowchart|graph)\b/i.test(line)) continue;
    if (/^(classDef|class|style|linkStyle|click|direction)\b/i.test(line)) {
      warnings.push(`Styling directive ignored: "${truncate(line)}" — set colours in the inspector instead.`);
      continue;
    }
    if (/^end$/i.test(line)) {
      if (subgraphStack.length === 0) warnings.push('Stray "end" with no open subgraph.');
      else subgraphStack.pop();
      continue;
    }
    const subgraph = /^subgraph\s+(.+)$/i.exec(line);
    if (subgraph) {
      const spec = subgraph[1].trim();
      // `subgraph id [Title]` and the bare `subgraph Title` form.
      const titled = /^(\S+)\s*\[(.+)\]$/.exec(spec);
      const id = titled ? titled[1] : `sg-${subgraphs.size + 1}`;
      subgraphs.set(id, titled ? titled[2] : spec);
      subgraphStack.push(id);
      continue;
    }

    const statement = parseFlowStatement(line);
    if (!statement) {
      warnings.push(`Could not parse: "${truncate(line)}"`);
      continue;
    }
    if (statement.kind === 'node') {
      ensureNode(statement.id, statement.label, statement.shape, statement.type);
      noteMembership(statement.id);
      continue;
    }
    // A chained statement (A --> B --> C) links each neighbouring pair.
    for (const part of statement.parts) {
      ensureNode(part.id, part.label, part.shape, part.type);
      noteMembership(part.id);
    }
    for (let index = 0; index < statement.links.length; index += 1) {
      const link = statement.links[index];
      const from = statement.parts[index];
      const to = statement.parts[index + 1];
      edges.push({
        id: `e${edges.length + 1}`,
        from: from.id,
        to: to.id,
        label: link.label,
        routing: 'smooth-step',
        effect: 'none',
        endMarker: (link.arrow ? 'arrow' : 'none') as EdgeMarker,
        startMarker: link.bidirectional ? 'arrow' : 'none',
        lineStyle: link.dashed ? 'dashed' : undefined,
        color: LINE_INK,
        width: link.thick ? 4 : 2,
        sortOrder: edges.length + 1,
      });
    }
  }

  // Frames last, so they can be sized around members that now exist.
  for (const [id, title] of subgraphs) {
    nodes.set(id, {
      id,
      type: 'group',
      title,
      position: { x: 0, y: 0 },
      width: 360,
      height: 260,
      shape: 'rounded',
      icon: null,
      color: '#c4b5fd',
      backgroundColor: '#1e1b4b',
      borderColor: '#c4b5fd',
      borderWidth: 2,
      borderStyle: 'dashed',
      shadow: 'none',
      fill: 'flat',
      fontSize: 13,
    });
  }
  for (const [nodeId, frameId] of membership) {
    const node = nodes.get(nodeId);
    if (node) node.parentId = frameId;
  }

  const document: FlowDocumentJSON = { nodes: [...nodes.values()], edges, settings: { runMode: 'sequential' } };
  applyLayout(document, direction);
  fitFramesToMembers(document);
  return { document, kind: 'flowchart', warnings };
}

interface FlowPart {
  id: string;
  label?: string;
  shape?: NodeShape;
  type?: NodeType;
}

type FlowStatement = ({ kind: 'node' } & FlowPart) | { kind: 'chain'; parts: FlowPart[]; links: Array<{ label?: string; dashed?: boolean; thick?: boolean; arrow: boolean; bidirectional?: boolean }> };

/**
 * One flowchart line: either a bare node declaration or a chain of nodes
 * joined by links. Walks the string rather than using one big regex —
 * labels can contain the same brackets and arrows the syntax uses, so a
 * regex would keep mis-splitting on `A[a --> b]`.
 */
function parseFlowStatement(line: string): FlowStatement | null {
  const parts: FlowPart[] = [];
  const links: Array<{ label?: string; dashed?: boolean; thick?: boolean; arrow: boolean; bidirectional?: boolean }> = [];
  let cursor = 0;

  while (cursor < line.length) {
    while (cursor < line.length && line[cursor] === ' ') cursor += 1;
    const part = readFlowPart(line, cursor);
    if (!part) return null;
    parts.push(part.part);
    cursor = part.next;

    while (cursor < line.length && line[cursor] === ' ') cursor += 1;
    if (cursor >= line.length) break;

    const rest = line.slice(cursor);
    let label: string | undefined;
    let link: { dashed?: boolean; thick?: boolean; arrow: boolean } | undefined;

    // `A -- text --> B`: the operator carries its own label.
    for (const spec of FLOW_LABELLED_LINKS) {
      const match = spec.token.exec(rest);
      if (!match) continue;
      label = match[1].trim().replace(/^["']|["']$/g, '');
      link = spec;
      cursor += match[0].length;
      break;
    }

    if (!link) {
      const plain = FLOW_LINKS.find((candidate) => candidate.token.test(rest));
      if (!plain) return null;
      link = plain;
      cursor += plain.token.exec(rest)![0].length;
      // `A -->|text| B`: the label follows the operator in pipes.
      if (line[cursor] === '|') {
        const close = line.indexOf('|', cursor + 1);
        if (close === -1) return null;
        label = line.slice(cursor + 1, close).trim().replace(/^["']|["']$/g, '');
        cursor = close + 1;
      }
    }

    links.push({ label, dashed: link.dashed, thick: link.thick, arrow: link.arrow, bidirectional: rest.startsWith('<-->') });
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return links.length === 0 ? { kind: 'node', ...parts[0] } : null;
  return { kind: 'chain', parts, links };
}

/** Read one `id`, `id[Label]`, `id{Label}`… starting at `from`. */
function readFlowPart(line: string, from: number): { part: FlowPart; next: number } | null {
  let cursor = from;
  while (cursor < line.length && /[A-Za-z0-9_.-]/.test(line[cursor])) cursor += 1;
  const id = line.slice(from, cursor);
  if (!id) return null;

  for (const spec of FLOW_SHAPES) {
    if (!line.startsWith(spec.open, cursor)) continue;
    const close = line.indexOf(spec.close, cursor + spec.open.length);
    if (close === -1) continue;
    const label = line
      .slice(cursor + spec.open.length, close)
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/<br\s*\/?>/gi, '\n');
    return { part: { id, label, shape: spec.shape, type: spec.type }, next: close + spec.close.length };
  }
  return { part: { id }, next: cursor };
}

// --- Sequence diagram ------------------------------------------------------

// --- ER diagram ------------------------------------------------------------

/** Mermaid's cardinality tokens, per end of the relationship. */
const ER_CARDINALITY: Record<string, EdgeMarker> = {
  '||': 'crow-one',
  'o|': 'crow-zero-one',
  '|o': 'crow-zero-one',
  '}|': 'crow-one-many',
  '|{': 'crow-one-many',
  '}o': 'crow-zero-many',
  'o{': 'crow-zero-many',
};

function importEr(lines: string[]): MermaidImportResult {
  const warnings: string[] = [];
  const tables = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  let openTable: FlowNode | null = null;

  const ensureTable = (name: string) => {
    const existing = tables.get(name);
    if (existing) return existing;
    const paint = IMPORT_PAINT[tables.size % IMPORT_PAINT.length];
    const node: FlowNode = {
      id: name,
      type: 'process',
      title: name,
      position: { x: 0, y: 0 },
      width: 236,
      height: tableCardHeight(1),
      shape: 'rounded',
      icon: null,
      color: paint.color,
      backgroundColor: paint.backgroundColor,
      borderColor: paint.color,
      borderWidth: 2,
      shadow: 'none',
      fill: 'flat',
      table: { columns: [] },
      sortOrder: tables.size + 1,
    };
    tables.set(name, node);
    return node;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (openTable) {
      if (line === '}') {
        openTable = null;
        continue;
      }
      // `string id PK "comment"` — type first, then name, then keys.
      const column = /^(\S+)\s+(\S+)(?:\s+(PK|FK|UK))?(?:\s+"(.*)")?$/i.exec(line);
      if (!column) {
        warnings.push(`Could not parse column: "${truncate(line)}"`);
        continue;
      }
      const [, dataType, name, key, note] = column;
      const flag = key?.toUpperCase();
      const entry: TableColumn = {
        id: `c${openTable.table!.columns.length + 1}`,
        name,
        dataType,
        primaryKey: flag === 'PK' || undefined,
        foreignKey: flag === 'FK' || undefined,
        unique: flag === 'UK' || undefined,
        note: note || undefined,
      };
      openTable.table!.columns.push(entry);
      openTable.height = tableCardHeight(openTable.table!.columns.length);
      continue;
    }

    const block = /^(\S+)\s*\{$/.exec(line);
    if (block) {
      openTable = ensureTable(block[1]);
      openTable.table = { columns: [] };
      continue;
    }

    // `USERS ||--o{ ORDERS : places`
    const relationship = /^(\S+)\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+(\S+)\s*:\s*(.*)$/.exec(line);
    if (relationship) {
      const [, leftName, leftCard, connector, rightCard, rightName, label] = relationship;
      const left = ensureTable(leftName);
      const right = ensureTable(rightName);
      edges.push({
        id: `r${edges.length + 1}`,
        from: left.id,
        to: right.id,
        routing: 'orthogonal',
        effect: 'none',
        startMarker: ER_CARDINALITY[leftCard] ?? 'crow-one',
        endMarker: ER_CARDINALITY[rightCard] ?? 'crow-many',
        // Mermaid's `..` is a non-identifying relationship, which reads
        // as a dashed line in every ERD notation.
        lineStyle: connector === '..' ? 'dashed' : undefined,
        label: label.trim().replace(/^["']|["']$/g, '') || undefined,
        color: LINE_INK,
        width: 2,
        sortOrder: edges.length + 1,
      });
      continue;
    }

    warnings.push(`Could not parse: "${truncate(line)}"`);
  }

  for (const table of tables.values()) {
    if (table.table!.columns.length === 0) {
      table.table!.columns.push({ id: 'c1', name: 'id', dataType: 'uuid', primaryKey: true });
      table.height = tableCardHeight(1);
    }
  }

  if (tables.size === 0) throw new MermaidImportError('No entities found in the ER diagram.');
  const document: FlowDocumentJSON = { nodes: [...tables.values()], edges, settings: { runMode: 'static' } };
  applyLayout(document, 'LR');
  return { document, kind: 'er', warnings };
}

// --- Shared ----------------------------------------------------------------

function applyLayout(document: FlowDocumentJSON, direction: LayoutDirection) {
  const positions = layoutDocument(document, { direction });
  for (const node of document.nodes) {
    const position = positions.get(node.id);
    if (position) node.position = position;
  }
}

/** Size each imported subgraph frame around the members it captured. */
function fitFramesToMembers(document: FlowDocumentJSON) {
  for (const frame of document.nodes) {
    if (frame.type !== 'group') continue;
    const members = document.nodes.filter((node) => node.parentId === frame.id);
    if (members.length === 0) continue;
    const left = Math.min(...members.map((node) => node.position.x - (node.width ?? 150) / 2));
    const right = Math.max(...members.map((node) => node.position.x + (node.width ?? 150) / 2));
    const topEdge = Math.min(...members.map((node) => node.position.y - (node.height ?? 84) / 2));
    const bottom = Math.max(...members.map((node) => node.position.y + (node.height ?? 84) / 2));
    const padding = 32;
    frame.position = { x: (left + right) / 2, y: (topEdge + bottom) / 2 - 14 };
    frame.width = right - left + padding * 2;
    frame.height = bottom - topEdge + padding * 2 + 28;
  }
}

function truncate(line: string): string {
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}
