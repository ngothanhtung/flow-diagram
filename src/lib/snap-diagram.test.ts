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
