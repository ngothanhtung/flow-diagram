import { describe, expect, it } from 'vitest';
import type { FlowDocumentJSON, FlowNode } from './flowchart-types';
import { snapDiagramToGrid } from './snap-diagram';

const node = (id: string, x: number, y: number, width: number, height: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, type: 'process', title: id, position: { x, y }, width, height, ...extra });
const edges = (box: FlowNode) => [box.position.x - box.width! / 2, box.position.y - box.height! / 2, box.width!, box.height!];

describe('snapDiagramToGrid', () => {
  it('puts every box on the grid: top-left on a grid point, whole cells', () => {
    const doc: FlowDocumentJSON = { nodes: [node('a', 13, -7, 196, 86)], edges: [] };
    const [a] = snapDiagramToGrid(doc).nodes;
    expect(edges(a)).toEqual([-80, -40, 200, 120]);
  });

  it('keeps a box already on the grid exactly where it is', () => {
    const doc: FlowDocumentJSON = { nodes: [node('a', 100, 60, 200, 120)], edges: [] };
    expect(snapDiagramToGrid(doc).nodes[0]).toEqual(doc.nodes[0]);
  });

  it('grows a group to hold its snapped members', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('g', 0, 0, 300, 200, { type: 'group' }), node('m', 70, 0, 160, 80, { parentId: 'g' })],
      edges: [],
    };
    const [g, m] = snapDiagramToGrid(doc).nodes;
    const [gl, gt, gw, gh] = edges(g);
    const [ml, mt, mw, mh] = edges(m);
    for (const value of [gl, gt, gw, gh, ml, mt, mw, mh]) expect(Math.abs(value % 40)).toBe(0);
    expect(ml).toBeGreaterThanOrEqual(gl);
    expect(mt).toBeGreaterThanOrEqual(gt);
    expect(ml + mw).toBeLessThanOrEqual(gl + gw);
    expect(mt + mh).toBeLessThanOrEqual(gt + gh);
  });

  it('snaps a free line by its two ends, a zero height included', () => {
    const doc: FlowDocumentJSON = { nodes: [node('l', 103, 18, 190, 0, { type: 'line' })], edges: [] };
    const [l] = snapDiagramToGrid(doc).nodes;
    expect(edges(l)).toEqual([0, 0, 200, 0]);
  });

  it('puts bend points on the half grid and leaves everything else alone', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('a', 100, 60, 200, 120, { color: '#fff' })],
      edges: [{ id: 'e', from: 'a', to: 'a', label: 'x', bendPoints: [{ x: 33, y: -9 }] }],
      settings: { runMode: 'static' },
    };
    const out = snapDiagramToGrid(doc);
    expect(out.edges[0]).toEqual({ id: 'e', from: 'a', to: 'a', label: 'x', bendPoints: [{ x: 40, y: 0 }] });
    expect(out.nodes[0].color).toBe('#fff');
    expect(out.settings).toEqual(doc.settings);
  });

  it('never makes a card bigger than a card may be', () => {
    const doc: FlowDocumentJSON = { nodes: [node('a', 0, 0, 318, 238)], edges: [] };
    const [a] = snapDiagramToGrid(doc).nodes;
    expect(a.width).toBe(320);
    expect(a.height).toBe(240);
  });
});

describe('snapDiagramToGrid straightens Lines', () => {
  it('grows the odd-cell block of a side-by-side pair so the Line between them runs straight', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('a', 100, 40, 200, 80), node('b', 400, 60, 200, 120)],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    };
    const [a, b] = snapDiagramToGrid(doc).nodes;
    expect(a.position.y).toBe(b.position.y);
    for (const box of [a, b]) for (const value of edges(box)) expect(Math.abs(value % 40)).toBe(0);
  });

  it('does the same for a stacked pair, along x', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('a', 100, 40, 200, 80), node('b', 120, 300, 160, 80)],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    };
    const [a, b] = snapDiagramToGrid(doc).nodes;
    expect(a.position.x).toBe(b.position.x);
  });

  it('leaves a pair alone when growing would run into another block', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('a', 100, 40, 200, 80), node('b', 400, 60, 200, 120), node('wall', 400, 160, 200, 80), node('roof', 400, -40, 200, 80)],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    };
    const out = snapDiagramToGrid(doc).nodes;
    expect(out.find((n) => n.id === 'b')!.height).toBe(120);
  });
});

describe('snapDiagramToGrid straightens variants', () => {
  it('still grows a block that shares its spot with another variant of itself', () => {
    const doc: FlowDocumentJSON = {
      nodes: [node('a', 100, 40, 200, 80), node('b', 400, 60, 200, 120), node('b-2', 400, 60, 200, 120)],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    };
    const out = snapDiagramToGrid(doc).nodes;
    expect(out.find((n) => n.id === 'b')!.position.y).toBe(out.find((n) => n.id === 'a')!.position.y);
  });
});
