import { describe, expect, it } from 'vitest';
import type { FlowDocumentJSON, FlowNode } from './flowchart-types';
import { measureLayout } from './layout-metrics';

// Each metric has to fire on a deliberately bad arrangement, or the
// reference-set gates in auto-layout.test.ts would pass vacuously.

function block(id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'process', title: id, position: { x, y }, width: 100, height: 50, ...extra };
}

describe('measureLayout', () => {
  it('counts a Line through an Element that is not one of its ends', () => {
    const doc: FlowDocumentJSON = { nodes: [block('a', 0, 0), block('b', 0, 400), block('wall', 0, 200)], edges: [{ id: 'e', from: 'a', to: 'b', routing: 'straight' }] };
    expect(measureLayout(doc, 'TB').lineThroughElement).toBe(1);
  });

  it('counts a crossing, but not two Lines sharing a port', () => {
    const crossing: FlowDocumentJSON = {
      nodes: [block('a', 0, 0), block('b', 300, 0), block('c', 0, 300), block('d', 300, 300)],
      edges: [
        { id: 'ad', from: 'a', to: 'd', routing: 'straight', fromSide: 'bottom', toSide: 'top' },
        { id: 'bc', from: 'b', to: 'c', routing: 'straight', fromSide: 'bottom', toSide: 'top' },
      ],
    };
    expect(measureLayout(crossing, 'TB').crossings).toBe(1);
    const fan: FlowDocumentJSON = { ...crossing, edges: [{ id: 'ac', from: 'a', to: 'c' }, { id: 'ad', from: 'a', to: 'd' }] };
    expect(measureLayout(fan, 'TB').crossings).toBe(0);
  });

  it('measures how far a 1-in/1-out chain is off its axis', () => {
    const doc: FlowDocumentJSON = { nodes: [block('a', 0, 0), block('b', 30, 200)], edges: [{ id: 'e', from: 'a', to: 'b' }] };
    const metrics = measureLayout(doc, 'TB');
    expect(metrics.chainLinks).toBe(1);
    expect(metrics.misalignedChainLinks).toBe(1);
    expect(metrics.maxChainDeviation).toBe(30);
  });

  it('counts overlaps, members sticking out of Frames and moved scenery', () => {
    const before: FlowDocumentJSON = {
      nodes: [block('f', 0, 0, { type: 'group', width: 200, height: 200 }), block('m', 0, 0, { parentId: 'f' }), block('x', 500, 0), block('y', 520, 10), { id: 't', type: 'text', title: 't', position: { x: 900, y: 900 } }],
      edges: [],
    };
    const after: FlowDocumentJSON = { ...before, nodes: before.nodes.map((node) => (node.id === 'm' ? { ...node, position: { x: 150, y: 0 } } : node.id === 't' ? { ...node, position: { x: 901, y: 900 } } : node)) };
    const metrics = measureLayout(after, 'TB', before);
    expect(metrics.overlaps).toBe(1);
    expect(metrics.containmentViolations).toBe(1);
    expect(metrics.sceneryMoved).toBe(1);
  });
});
