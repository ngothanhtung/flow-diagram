import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { autoLayout, autoLayoutScope, canAutoLayout, type LayoutDirection } from './auto-layout';
import { selectCanUndo, useEditorStore } from './editor-store';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { measureLayout } from './layout-metrics';
import { importMermaid } from './mermaid-import';
import { STARTER_DIAGRAMS, buildStarterDocument } from './starter-diagrams';

// The PRD's acceptance criteria for Auto-layout (v0.3 §4.3), checked on
// every Diagram in the reference set, in both directions. Adding a JSON
// file to `seed/layout-reference/` adds it to this suite.

const REFERENCE_DIR = path.resolve(__dirname, '../../seed/layout-reference');
const reference = fs
  .readdirSync(REFERENCE_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => ({ name: file.replace(/\.json$/, ''), doc: JSON.parse(fs.readFileSync(path.join(REFERENCE_DIR, file), 'utf8')) as FlowDocumentJSON }));

const DIRECTIONS: LayoutDirection[] = ['TB', 'LR'];

describe('reference set', () => {
  it('is not empty', () => {
    expect(reference.length).toBeGreaterThanOrEqual(6);
  });

  for (const { name, doc } of reference) {
    for (const direction of DIRECTIONS) {
      describe(`${name}, ${direction}`, () => {
        const result = autoLayout(doc, { direction });
        const metrics = measureLayout(result.document, direction, doc);
        // The arrangement as authored (for the Starters: as shipped) is the
        // baseline the PRD compares crossings against.
        const hand = measureLayout(doc, direction, doc);

        it('routes no Line through an Element', () => {
          expect(metrics.problems.filter((problem) => problem.includes('passes through'))).toEqual([]);
        });
        it('has no more crossings than the hand arrangement', () => {
          expect(metrics.crossings).toBeLessThanOrEqual(hand.crossings);
        });
        it('lines up every 1-in/1-out chain', () => {
          expect(metrics.problems.filter((problem) => problem.startsWith('chain'))).toEqual([]);
        });
        it('overlaps no Elements', () => {
          expect(metrics.problems.filter((problem) => problem.includes('overlaps'))).toEqual([]);
        });
        it('keeps every member inside its Frame', () => {
          expect(metrics.containmentViolations).toBe(0);
        });
        it('leaves Text, Icon and Free line exactly where they were', () => {
          expect(metrics.sceneryMoved).toBe(0);
        });
        it('is deterministic', () => {
          expect(autoLayout(doc, { direction }).document).toEqual(result.document);
        });
        it('changes nothing when run again', () => {
          expect(autoLayout(result.document, { direction }).document).toEqual(result.document);
        });
      });
    }
  }
});

// --- Behaviour ------------------------------------------------------------

function block(id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'process', title: id, position: { x, y }, width: 140, height: 60, ...extra };
}

function line(id: string, from: string, to: string, extra: Partial<FlowEdge> = {}): FlowEdge {
  return { id, from, to, routing: 'smooth-step', ...extra };
}

const byId = (doc: FlowDocumentJSON, id: string) => doc.nodes.find((node) => node.id === id)!;
const edgeById = (doc: FlowDocumentJSON, id: string) => doc.edges.find((edge) => edge.id === id)!;

describe('autoLayout', () => {
  it('re-picks the ports of Lines the user connected to specific sides, and drops stale bends', () => {
    const doc: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 400, 300), block('c', 0, 600)],
      edges: [line('ab', 'a', 'b', { fromSide: 'right', toSide: 'left', bendPoints: [{ x: 900, y: 900 }] }), line('bc', 'b', 'c', { fromSide: 'left', toSide: 'right' })],
    };
    const tb = autoLayout(doc, { direction: 'TB' }).document;
    expect(edgeById(tb, 'ab')).toMatchObject({ fromSide: 'bottom', toSide: 'top' });
    expect(edgeById(tb, 'ab').bendPoints).toBeUndefined();
    const lr = autoLayout(doc, { direction: 'LR' }).document;
    expect(edgeById(lr, 'bc')).toMatchObject({ fromSide: 'right', toSide: 'left' });
    // A straight chain: one column.
    expect(byId(tb, 'a').position.x).toBe(byId(tb, 'b').position.x);
    expect(byId(tb, 'b').position.x).toBe(byId(tb, 'c').position.x);
  });

  it('moves only the selected Elements', () => {
    const doc = reference.find((entry) => entry.name === 'purchase-approval')!.doc;
    const selection = ['manager', 'director', 'approved', 'revise'];
    const result = autoLayout(doc, { direction: 'TB', selection });
    for (const node of doc.nodes) {
      const after = byId(result.document, node.id);
      if (!selection.includes(node.id)) expect(after).toEqual(node);
    }
    expect(result.movedNodeIds.every((id) => selection.includes(id))).toBe(true);
    expect(result.movedNodeIds.length).toBeGreaterThan(0);
  });

  it('lays a Frame out as one block and fits it around its members', () => {
    const doc: FlowDocumentJSON = {
      nodes: [block('in', 0, 0), block('frame', 300, 300, { type: 'group', width: 900, height: 900 }), block('m1', 200, 200, { parentId: 'frame' }), block('m2', 500, 500, { parentId: 'frame' }), block('out', 0, 900)],
      edges: [line('e1', 'in', 'm1'), line('e2', 'm1', 'm2'), line('e3', 'm2', 'out')],
    };
    const result = autoLayout(doc, { direction: 'TB' }).document;
    const metrics = measureLayout(result, 'TB', doc);
    expect(metrics.containmentViolations).toBe(0);
    expect(metrics.overlaps).toBe(0);
    expect(metrics.lineThroughElement).toBe(0);
    // Shrunk to fit: far smaller than the 900×900 it started as.
    expect(byId(result, 'frame').height).toBeLessThan(500);
    expect(byId(result, 'frame').width).toBeLessThan(300);
  });

  it('never moves scenery, nor a Frame that holds scenery', () => {
    const doc: FlowDocumentJSON = {
      nodes: [
        block('a', 0, 0),
        block('b', 500, 40),
        { id: 'caption', type: 'text', title: 'note', position: { x: 900, y: 900 }, width: 120, height: 30 },
        { id: 'rule', type: 'line', title: '', position: { x: 600, y: 600 }, width: 200, height: 0 },
        block('pinned', 1400, 400, { type: 'group', width: 400, height: 300 }),
        block('inside', 1400, 420, { parentId: 'pinned' }),
        { id: 'inside-note', type: 'text', title: 'n', position: { x: 1400, y: 500 }, width: 80, height: 24, parentId: 'pinned' },
      ],
      edges: [line('ab', 'a', 'b'), line('bi', 'b', 'inside')],
    };
    const result = autoLayout(doc, { direction: 'TB' });
    for (const id of ['caption', 'rule', 'pinned', 'inside', 'inside-note']) expect(byId(result.document, id)).toEqual(byId(doc, id));
    expect(measureLayout(result.document, 'TB', doc).overlaps).toBe(0);
  });

  it('gives a loop its own lane on the side, apart from the forward Line', () => {
    const doc: FlowDocumentJSON = { nodes: [block('a', 0, 0), block('b', 0, 200)], edges: [line('ab', 'a', 'b'), line('ba', 'b', 'a')] };
    const result = autoLayout(doc, { direction: 'TB' }).document;
    expect(edgeById(result, 'ab')).toMatchObject({ fromSide: 'bottom', toSide: 'top' });
    expect(edgeById(result, 'ba')).toMatchObject({ fromSide: 'right', toSide: 'right' });
    expect(measureLayout(result, 'TB').crossings).toBe(0);
  });

  it('routes a Line spanning several ranks around the Blocks between', () => {
    const doc: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 0, 100), block('c', 0, 200), block('d', 0, 300)],
      edges: [line('ab', 'a', 'b'), line('bc', 'b', 'c'), line('cd', 'c', 'd'), line('ad', 'a', 'd')],
    };
    for (const direction of DIRECTIONS) {
      const result = autoLayout(doc, { direction }).document;
      expect(measureLayout(result, direction).lineThroughElement).toBe(0);
    }
  });

  it('does nothing when there is nothing to arrange', () => {
    const doc: FlowDocumentJSON = { nodes: [{ id: 't', type: 'text', title: 'x', position: { x: 1, y: 2 } }], edges: [] };
    expect(autoLayout(doc, { direction: 'TB' })).toEqual({ document: doc, movedNodeIds: [] });
    expect(canAutoLayout(doc, [])).toBe(false);
  });

  it('scopes to the selection only from two Elements, or one Frame', () => {
    const doc: FlowDocumentJSON = { nodes: [block('a', 0, 0), block('b', 0, 0), block('f', 0, 0, { type: 'group' }), block('m', 0, 0, { parentId: 'f' })], edges: [] };
    expect(autoLayoutScope(doc, [])).toEqual([]);
    expect(autoLayoutScope(doc, ['a'])).toEqual([]);
    expect(autoLayoutScope(doc, ['a', 'b'])).toEqual(['a', 'b']);
    expect(autoLayoutScope(doc, ['f'])).toEqual(['f']);
  });
});

describe('Mermaid import and Starters', () => {
  it('lay out with Auto-layout: clean by the same measures', () => {
    for (const starter of STARTER_DIAGRAMS) {
      const doc = buildStarterDocument(starter);
      const metrics = measureLayout(doc, starter.id === 'er' ? 'LR' : 'TB');
      expect(metrics.lineThroughElement).toBe(0);
      expect(metrics.overlaps).toBe(0);
      expect(metrics.containmentViolations).toBe(0);
      expect(metrics.misalignedChainLinks).toBe(0);
    }
  });

  it('place an import exactly where Auto-layout would', () => {
    const imported = importMermaid('flowchart LR\n  A --> B --> C\n  A --> C').document;
    expect(autoLayout(imported, { direction: 'LR', origin: { x: 240, y: 160 } }).document).toEqual(imported);
  });
});

describe('the Auto-layout command in the editor', () => {
  beforeEach(() => {
    useEditorStore.setState({ doc: { nodes: [], edges: [] }, selectedNodeIds: [], selectedNodeId: null, selectedEdgeId: null });
    useEditorStore.getState().openTemplate({ name: 't', category: 'test', description: '', document: reference.find((entry) => entry.name === 'saas-architecture')!.doc });
  });

  it('is one undo step that restores everything, Line ports included', () => {
    const before = useEditorStore.getState().doc;
    const steps = useEditorStore.getState().history.past.length;
    const result = useEditorStore.getState().autoLayout('LR');
    expect(result.document).not.toBeNull();
    expect(useEditorStore.getState().history.past.length).toBe(steps + 1);
    expect(useEditorStore.getState().doc).not.toEqual(before);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc).toEqual(before);
    expect(selectCanUndo(useEditorStore.getState())).toBe(steps > 0);
  });

  it('arranges only the selection when two or more Elements are selected', () => {
    const before = useEditorStore.getState().doc;
    useEditorStore.getState().selectNodes(['users', 'admin', 'cdn', 's3']);
    const result = useEditorStore.getState().autoLayout('TB');
    expect(result.scoped).toBe(true);
    const after = useEditorStore.getState().doc;
    for (const node of before.nodes) if (!['users', 'admin', 'cdn', 's3'].includes(node.id)) expect(byId(after, node.id)).toEqual(node);
  });
});
