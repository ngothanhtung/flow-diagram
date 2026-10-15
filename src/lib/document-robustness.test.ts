// No Diagram JSON anyone can paste may crash the canvas.
//
// A valid sample document, with one field at a time replaced by junk, is
// fed through the path a document takes to the screen: the gate every
// entry point runs (`checkDocument` for pasted text, `normalizeDocument`
// for everything), then the resolvers and geometry the canvas calls, then
// a server render of `FlowCanvas` itself. Nothing may throw, and every
// coordinate that comes out has to be a finite number.
//
// A second pass skips the gate for the fields whose values only *degrade*
// (enums and numbers): the resolvers must fall back on their own, so a
// document that reached them some other way still renders.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowCanvas } from '@/components/FlowCanvas';
import { buildEdgeGeometry, edgeLabelAnchor } from '@/components/edge-geometry';
import { checkDocument, normalizeDocument, validateDocument } from '@/lib/document-validation';
import { resolveDocumentStyles, resolveEdgeStyle, edgeStylesOf } from '@/lib/edge-style';
import { computeOrderedGroups, computeRunTimeline } from '@/lib/editor-store';
import type { FlowDocumentJSON, FlowNode } from '@/lib/flowchart-types';
import { endpointsOfLine, lineCornerOf } from '@/lib/line-geometry';
import { resolveNodeStyle } from '@/lib/node-style';
import { descendantIds, sortByTreeDepth } from '@/lib/node-tree';
import { STARTER_DIAGRAMS, buildStarterDocument } from '@/lib/starter-diagrams';
import databaseSchema from '../../seed/templates/database-schema.json';

function sample(): FlowDocumentJSON {
  return {
    nodes: [
      { id: 'a', type: 'process', title: 'API', position: { x: 0, y: 0 }, icon: 'lucide:Network', sortOrder: 1 },
      { id: 'b', type: 'decision', title: 'Users', position: { x: 320, y: 0 }, table: { columns: [{ id: 'c1', name: 'id', dataType: 'uuid', primaryKey: true }] }, sortOrder: 2 },
      { id: 'g', type: 'group', title: 'Zone', position: { x: 0, y: 320 }, width: 420, height: 300 },
      { id: 't', type: 'text', title: 'Caption', position: { x: 0, y: 320 }, parentId: 'g' },
      { id: 'i', type: 'icon', title: '', position: { x: 120, y: 320 }, icon: 'logo:github', parentId: 'g' },
      { id: 'l', type: 'line', title: '', position: { x: 520, y: 320 }, width: 120, height: 60, lineStart: 'sw', endMarker: 'arrow' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', label: 'reads', endMarker: 'arrow', effect: 'comet', effectShape: 'lucide:Mail', styleRef: 's1' },
      { id: 'e2', from: 'b', to: 'g', routing: 'orthogonal', bendPoints: [{ x: 320, y: 200 }], fromSide: 'bottom', toSide: 'top' },
    ],
    settings: { runMode: 'sequential', edgeStyles: [{ id: 's1', name: 'Primary', color: '#38bdf8', width: 2.5, lineStyle: 'dashed' }] },
  };
}

/** Wrong in every way a hand- or AI-written value tends to be wrong. */
const JUNK: unknown[] = ['top-left', 'zzz', '', 'constructor', '__proto__', '12', 42, -1, 0, 1e300, NaN, Infinity, -Infinity, null, true, {}, [], { x: 'a' }, [1, 2]];

const NODE_FIELDS = [
  'type', 'title', 'description', 'position', 'width', 'height', 'rotation', 'sortOrder', 'duration', 'delay', 'shape', 'color', 'backgroundColor', 'borderColor',
  'borderWidth', 'borderStyle', 'opacity', 'fill', 'shadow', 'icon', 'iconSize', 'iconPosition', 'blockAlign', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign',
  'portSize', 'connectionPoints', 'effect', 'effectColor', 'effectSpeed', 'effectIntensity', 'table', 'lineStart', 'lineFlip', 'startMarker', 'endMarker', 'parentId',
];
const EDGE_STYLE_FIELDS = ['color', 'width', 'lineStyle', 'startMarker', 'endMarker', 'routing', 'direction', 'effect', 'effectColor', 'effectSize', 'effectCount', 'effectDensity', 'effectShape', 'animationSpeed', 'glowIntensity', 'glowColor'];
const EDGE_FIELDS = [
  ...EDGE_STYLE_FIELDS, 'id', 'from', 'to', 'fromSide', 'toSide', 'label', 'labelPosition', 'labelOffset', 'labelShape', 'labelColor', 'labelBackground', 'labelFontSize',
  'labelFontFamily', 'bendPoints', 'fromColumn', 'toColumn', 'sortOrder', 'duration', 'delay', 'styleRef',
];
/** Content rather than styling: the gate refuses or repairs these, and
 *  the renderer relies on it. Every other field must also degrade
 *  gracefully in the resolvers without the gate. */
const CONTENT_FIELDS = new Set(['title', 'description', 'position', 'table', 'label', 'id', 'from', 'to']);

type Mutation = { name: string; doc: unknown };

function set(record: object, field: string, value: unknown) {
  (record as Record<string, unknown>)[field] = value;
}

function nodeMutations(fields: readonly string[]): Mutation[] {
  const out: Mutation[] = [];
  for (const field of fields) {
    for (const junk of JUNK) {
      for (let index = 0; index < sample().nodes.length; index += 1) {
        const doc = sample();
        set(doc.nodes[index], field, junk);
        out.push({ name: `node "${doc.nodes[index].id}".${field} = ${String(junk)}`, doc });
      }
    }
  }
  return out;
}

function edgeMutations(fields: readonly string[]): Mutation[] {
  const out: Mutation[] = [];
  for (const field of fields) {
    for (const junk of JUNK) {
      for (let index = 0; index < sample().edges.length; index += 1) {
        const doc = sample();
        set(doc.edges[index], field, junk);
        out.push({ name: `edge "${doc.edges[index].id}".${field} = ${String(junk)}`, doc });
      }
      if (EDGE_STYLE_FIELDS.includes(field)) {
        // Through the line's style class instead of the line itself.
        const doc = sample();
        set(doc.settings!.edgeStyles![0], field, junk);
        out.push({ name: `edgeStyles[0].${field} = ${String(junk)}`, doc });
      }
    }
  }
  return out;
}

function structuralMutations(): Mutation[] {
  const out: Mutation[] = [];
  const add = (name: string, edit: (doc: FlowDocumentJSON) => void) => {
    const doc = sample();
    edit(doc);
    out.push({ name, doc });
  };
  for (const junk of JUNK) {
    add(`settings = ${String(junk)}`, (doc) => set(doc, 'settings', junk));
    add(`settings.runMode = ${String(junk)}`, (doc) => set(doc.settings!, 'runMode', junk));
    add(`settings.repeatEnabled = ${String(junk)}`, (doc) => set(doc.settings!, 'repeatEnabled', junk));
    add(`settings.edgeStyles = ${String(junk)}`, (doc) => set(doc.settings!, 'edgeStyles', junk));
    add(`settings.edgeStyles[0] = ${String(junk)}`, (doc) => set(doc.settings!.edgeStyles!, '0', junk));
    add(`table.columns = ${String(junk)}`, (doc) => set(doc.nodes[1].table!, 'columns', junk));
    add(`table.columns[0] = ${String(junk)}`, (doc) => set(doc.nodes[1].table!.columns, '0', junk));
    add(`table.schema = ${String(junk)}`, (doc) => set(doc.nodes[1].table!, 'schema', junk));
    add(`bendPoints[0] = ${String(junk)}`, (doc) => set(doc.edges[1].bendPoints!, '0', junk));
    for (const field of ['id', 'name', 'dataType', 'primaryKey', 'nullable', 'note']) {
      add(`table.columns[0].${field} = ${String(junk)}`, (doc) => set(doc.nodes[1].table!.columns[0], field, junk));
    }
    for (const field of ['input', 'output']) {
      add(`connectionPoints.${field} = ${String(junk)}`, (doc) => set(doc.nodes[0], 'connectionPoints', { input: 'left', output: 'right', [field]: junk }));
    }
  }
  add('parentId cycle between two frames', (doc) => {
    doc.nodes.push({ id: 'g2', type: 'group', title: 'Inner', position: { x: 0, y: 320 }, parentId: 'g' });
    doc.nodes[2].parentId = 'g2';
  });
  add('parentId pointing at itself', (doc) => (doc.nodes[2].parentId = 'g'));
  add('parentId pointing at a missing node', (doc) => (doc.nodes[3].parentId = 'nope'));
  add('parentId pointing at a block, not a frame', (doc) => (doc.nodes[3].parentId = 'a'));
  add('edge to a missing node', (doc) => (doc.edges[0].to = 'nope'));
  add('edge from a missing node', (doc) => (doc.edges[0].from = 'nope'));
  add('duplicate edge ids', (doc) => (doc.edges[1].id = 'e1'));
  add('duplicate node ids', (doc) => (doc.nodes[1].id = 'a'));
  add('self-loop edge', (doc) => (doc.edges[0].to = 'a'));
  add('nodes is not a list', (doc) => set(doc, 'nodes', { a: 1 }));
  add('edges is not a list', (doc) => set(doc, 'edges', 'e1'));
  add('a node that is not an object', (doc) => set(doc.nodes, '0', 'node'));
  add('an edge that is not an object', (doc) => set(doc.edges, '0', 7));
  return out;
}

const ALL_MUTATIONS = [...nodeMutations(NODE_FIELDS), ...edgeMutations(EDGE_FIELDS), ...structuralMutations()];

function expectFinite(value: number, what: string) {
  if (!Number.isFinite(value)) throw new Error(`${what} is ${value}`);
}

/** Everything the canvas computes from a document, with every number checked. */
function runRenderPipeline(raw: FlowDocumentJSON) {
  const doc = resolveDocumentStyles(raw);
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  for (const node of doc.nodes) {
    const style = resolveNodeStyle(node);
    for (const key of ['width', 'height', 'rotation', 'borderWidth', 'opacity', 'iconSize', 'fontSize', 'portSize'] as const) expectFinite(style[key], `${node.id} ${key}`);
    expect(style.shapeSpec?.anchors).toBeDefined();
    expect(style.colorSpec?.background).toBeDefined();
    if (node.position && typeof node.position === 'object') {
      const { start, end } = endpointsOfLine(node, style.width, style.height);
      for (const point of [start, end]) {
        if (Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
          expectFinite(point.x, `${node.id} line x`);
          expectFinite(point.y, `${node.id} line y`);
        }
      }
    }
  }
  const styles = edgeStylesOf(raw.settings);
  for (const edge of doc.edges) {
    const resolved = resolveEdgeStyle(edge, styles);
    const from = byId.get(resolved.from);
    const to = byId.get(resolved.to);
    if (!from || !to) continue;
    const geometry = buildEdgeGeometry(resolved, from, to);
    expect(geometry).toBeDefined();
    if ([from, to].every((node) => node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y))) {
      for (const point of [geometry.start, geometry.end, geometry.mid]) {
        expectFinite(point.x, `${edge.id} x`);
        expectFinite(point.y, `${edge.id} y`);
      }
      expectFinite(geometry.length, `${edge.id} length`);
      expect(geometry.d).not.toMatch(/NaN|Infinity|undefined/);
      const anchor = edgeLabelAnchor(resolved, geometry, 60);
      expectFinite(anchor.x, `${edge.id} label x`);
      expectFinite(anchor.y, `${edge.id} label y`);
    }
  }
  expect(sortByTreeDepth(doc.nodes)).toHaveLength(doc.nodes.length);
  for (const node of doc.nodes) descendantIds(doc.nodes, node.id);
  computeOrderedGroups(doc.nodes);
  computeRunTimeline(doc.nodes, doc.edges);
}

const noop = () => {};
function renderCanvas(document: FlowDocumentJSON): string {
  return renderToStaticMarkup(
    createElement(FlowCanvas, {
      document,
      selectedNodeId: null,
      onSelectNode: noop,
      onNodeMove: noop,
      onNodeResize: noop,
      onNodeDragStart: noop,
      onNodeDragEnd: noop,
      onConnect: noop,
      isDragging: false,
      linkingFromId: null,
      onLinkStart: noop,
      onLinkMove: noop,
      onLinkEnd: noop,
      selectedEdgeId: null,
      onSelectEdge: noop,
      onEdgeReconnect: noop,
      onEdgeUpdate: noop,
      activeShape: null,
      onShapeDrawn: noop,
      infoOpen: false,
      onToggleInfo: noop,
    }),
  );
}

/** Runs `check` for every mutation and reports all failures at once. */
function expectNoFailures(mutations: Mutation[], check: (mutation: Mutation) => void) {
  const failures: string[] = [];
  for (const mutation of mutations) {
    try {
      check(mutation);
    } catch (error) {
      failures.push(`${mutation.name}: ${(error as Error).message.split('\n')[0]}`);
    }
  }
  expect(failures).toEqual([]);
}

describe('the gate (checkDocument / normalizeDocument)', () => {
  it('never throws, and either refuses with a message or yields a renderable document', () => {
    expectNoFailures(ALL_MUTATIONS, ({ doc }) => {
      for (const lenientEdges of [false, true]) {
        const checked = checkDocument(doc, { lenientEdges });
        if (!checked.ok) {
          expect(checked.error).toMatch(/\w/);
          continue;
        }
        // What comes out of the gate passes the gate untouched.
        expect(validateDocument(checked.document, { lenientEdges })).toBeNull();
        const again = normalizeDocument(checked.document, { lenientEdges });
        expect(again.fixes).toEqual([]);
        expect(again.document).toBe(checked.document);
      }
      // The load paths (session, Firestore) don't validate first.
      const { document } = normalizeDocument(doc);
      expect(validateDocument(document)).toBeNull();
      runRenderPipeline(document);
    });
  });

  it('server-renders FlowCanvas for every normalised mutation without NaN or Infinity', { timeout: 120_000 }, () => {
    expectNoFailures(ALL_MUTATIONS, ({ doc }) => {
      const markup = renderCanvas(normalizeDocument(doc).document);
      expect(markup).not.toMatch(/NaN|Infinity/);
    });
  });
});

describe('the resolvers on their own', () => {
  const degradable = [...nodeMutations(NODE_FIELDS.filter((field) => !CONTENT_FIELDS.has(field))), ...edgeMutations(EDGE_FIELDS.filter((field) => !CONTENT_FIELDS.has(field)))];

  it('fall back on an out-of-vocabulary enum or number instead of throwing', () => {
    expectNoFailures(degradable, ({ doc }) => runRenderPipeline(doc as FlowDocumentJSON));
  });

  it('server-render FlowCanvas for those documents un-normalised, without NaN or Infinity', { timeout: 120_000 }, () => {
    expectNoFailures(degradable, ({ doc }) => {
      expect(renderCanvas(doc as FlowDocumentJSON)).not.toMatch(/NaN|Infinity/);
    });
  });

  it('read an unknown lineStart as unset — the reported crash', () => {
    const line = { lineStart: 'top-left' } as unknown as FlowNode;
    expect(lineCornerOf(line)).toBe('nw');
    expect(lineCornerOf({ ...line, lineFlip: true })).toBe('ne');
    expect(endpointsOfLine({ ...line, position: { x: 0, y: 0 } }, 100, 50)).toEqual({ start: { x: -50, y: -25 }, end: { x: 50, y: 25 } });
  });
});

describe('normalizeDocument', () => {
  it('leaves a clean document — the sample, every starter, the seeded template — untouched', () => {
    const clean: Array<[string, unknown]> = [
      ['sample', sample()],
      ['database-schema.json', databaseSchema],
      ...STARTER_DIAGRAMS.map((starter): [string, unknown] => [starter.name, buildStarterDocument(starter)]),
    ];
    for (const [name, doc] of clean) {
      const result = normalizeDocument(doc);
      expect({ name, fixes: result.fixes }).toEqual({ name, fixes: [] });
      expect(result.document).toBe(doc);
    }
  });

  it('reads the spelled-out corner names and reports it', () => {
    const doc = sample();
    set(doc.nodes[5], 'lineStart', 'top-left');
    const { document, fixes } = normalizeDocument(doc);
    expect(document.nodes[5].lineStart).toBe('nw');
    expect(fixes).toEqual(['Node "l": read lineStart "top-left" as "nw".']);
  });

  it('drops a value outside the vocabulary so its default applies, and says so', () => {
    const doc = sample();
    set(doc.nodes[5], 'lineStart', 'middle');
    set(doc.edges[0], 'routing', 'zigzag');
    const { document, fixes } = normalizeDocument(doc);
    expect(document.nodes[5]).not.toHaveProperty('lineStart');
    expect(document.edges[0]).not.toHaveProperty('routing');
    expect(fixes).toHaveLength(2);
    expect(fixes[0]).toMatch(/^Node "l": ignored lineStart "middle" — expected one of nw, ne, se, sw\.$/);
    expect(fixes[1]).toMatch(/^Line "e1": ignored routing "zigzag"/);
  });

  it('reads numeric strings as numbers and drops non-finite ones', () => {
    const doc = sample();
    set(doc.nodes[0], 'width', '180');
    set(doc.nodes[0], 'height', NaN);
    const { document } = normalizeDocument(doc);
    expect(document.nodes[0].width).toBe(180);
    expect(document.nodes[0]).not.toHaveProperty('height');
  });

  it('breaks a parentId loop and clears a parent that is missing or not a frame', () => {
    const doc = sample();
    doc.nodes.push({ id: 'g2', type: 'group', title: 'Inner', position: { x: 0, y: 0 }, parentId: 'g' });
    doc.nodes[2].parentId = 'g2';
    doc.nodes[0].parentId = 'b';
    doc.nodes[1].parentId = 'nope';
    const { document } = normalizeDocument(doc);
    const parentOf = (id: string) => document.nodes.find((node) => node.id === id)?.parentId;
    expect(parentOf('a')).toBeUndefined();
    expect(parentOf('b')).toBeUndefined();
    // Exactly one link of the loop is cut; the members of `g` stay put.
    expect([parentOf('g'), parentOf('g2')].filter(Boolean)).toHaveLength(1);
    expect(parentOf('t')).toBe('g');
  });

  it('drops lines to missing nodes outside a paste, and keeps them for a paste to sort out', () => {
    const doc = sample();
    doc.edges[0].to = 'nope';
    expect(normalizeDocument(doc).document.edges.map((edge) => edge.id)).toEqual(['e2']);
    expect(normalizeDocument(doc, { lenientEdges: true }).document.edges).toHaveLength(2);
  });

  it('keeps unknown keys (forward compatibility)', () => {
    const doc = sample();
    set(doc, 'futureTopLevel', { a: 1 });
    set(doc.nodes[0], 'futureField', 'x');
    set(doc.edges[0], 'futureField', 3);
    set(doc.nodes[0], 'width', 'wide');
    const { document } = normalizeDocument(doc);
    expect(document).toHaveProperty('futureTopLevel', { a: 1 });
    expect(document.nodes[0]).toHaveProperty('futureField', 'x');
    expect(document.edges[0]).toHaveProperty('futureField', 3);
  });
});

describe('validateDocument', () => {
  it('refuses an unknown node type with the list of valid ones', () => {
    const doc = sample();
    set(doc.nodes[0], 'type', 'database');
    expect(validateDocument(doc)).toBe('Node "a" has unknown type "database". Use one of: start, process, decision, output, group, text, icon, line.');
  });

  it('still accepts the legacy logo type', () => {
    const doc = sample();
    set(doc.nodes[0], 'type', 'logo');
    expect(validateDocument(doc)).toBeNull();
  });
});
