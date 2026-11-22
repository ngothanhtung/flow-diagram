// The isometric scene: the Diagram projected onto a floor seen from above at
// the isometric angle, every block a box with depth, lines on the floor and
// labels standing upright above their block.
import { describe, expect, it } from 'vitest';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { ISO_BLOCK_DEPTH, isoProject, isometricScene } from './isometric';

const block = (id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, type: 'process', title: id.toUpperCase(), position: { x, y }, width: 200, height: 100, ...extra }) as FlowNode;
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 5);
  expect(a.y).toBeCloseTo(b.y, 5);
};

describe('isoProject', () => {
  it('turns the floor 45° and flattens it to the isometric 30°', () => {
    close(isoProject({ x: 100, y: 0 }), { x: 100 * Math.cos(Math.PI / 6), y: 50 });
    close(isoProject({ x: 0, y: 100 }), { x: -100 * Math.cos(Math.PI / 6), y: 50 });
  });

  it('lifts a point straight up the screen by its height', () => {
    close(isoProject({ x: 100, y: 0 }, 24), { x: 100 * Math.cos(Math.PI / 6), y: 26 });
  });
});

describe('isometricScene', () => {
  it('makes a block a box: a top face lifted by its depth and the two faces that show', () => {
    const scene = isometricScene({ nodes: [block('a', 0, 0)], edges: [] });
    const box = scene.boxes[0];
    expect(box.id).toBe('a');
    expect(box.top).toHaveLength(4);
    // The block's floor corners lifted by the depth.
    close(box.top[0], isoProject({ x: -100, y: -50 }, ISO_BLOCK_DEPTH));
    close(box.top[2], isoProject({ x: 100, y: 50 }, ISO_BLOCK_DEPTH));
    expect(box.right).toHaveLength(4);
    expect(box.front).toHaveLength(4);
    // The label stands over the top face's centre.
    close(box.label, isoProject({ x: 0, y: 0 }, ISO_BLOCK_DEPTH));
    expect(box.title).toBe('A');
  });

  it('paints far boxes before near ones', () => {
    const scene = isometricScene({ nodes: [block('near', 400, 400), block('far', 0, 0)], edges: [] });
    expect(scene.boxes.map((box) => box.id)).toEqual(['far', 'near']);
  });

  it('lays a connector on the floor from port to port', () => {
    const doc: FlowDocumentJSON = { nodes: [block('a', 0, 0), block('b', 400, 0)], edges: [{ id: 'e', from: 'a', to: 'b' } as FlowEdge] };
    const line = isometricScene(doc).lines[0];
    expect(line.id).toBe('e');
    // a's right port (100, 0) to b's left port (300, 0).
    close(line.points[0], isoProject({ x: 100, y: 0 }));
    close(line.points.at(-1)!, isoProject({ x: 300, y: 0 }));
    expect(line.arrow).toBe(true);
  });

  it('keeps a group frame a flat tile on the floor, under the blocks', () => {
    const scene = isometricScene({ nodes: [block('a', 0, 0), block('g', 0, 0, { type: 'group', width: 400, height: 300 })], edges: [] });
    expect(scene.tiles.map((tile) => tile.id)).toEqual(['g']);
    expect(scene.boxes.map((box) => box.id)).toEqual(['a']);
  });

  it('stands a free text object upright on the floor, with no box', () => {
    const scene = isometricScene({ nodes: [block('t', 0, 0, { type: 'text', title: 'Note' })], edges: [] });
    expect(scene.boxes).toHaveLength(0);
    expect(scene.labels.map((label) => label.text)).toEqual(['Note']);
  });

  it('dims what the run has not reached yet', () => {
    const scene = isometricScene({ nodes: [block('a', 0, 0), block('b', 400, 0)], edges: [] }, { nodeStates: { a: 'active', b: 'pending' } });
    expect(scene.boxes.find((box) => box.id === 'b')!.opacity).toBeLessThan(1);
    expect(scene.boxes.find((box) => box.id === 'a')!.active).toBe(true);
  });

  it('frames everything it draws', () => {
    const scene = isometricScene({ nodes: [block('a', 0, 0), block('b', 400, 400)], edges: [] });
    for (const box of scene.boxes) {
      for (const p of [...box.top, ...box.right, ...box.front]) {
        expect(p.x).toBeGreaterThanOrEqual(scene.bounds.x);
        expect(p.y).toBeGreaterThanOrEqual(scene.bounds.y);
        expect(p.x).toBeLessThanOrEqual(scene.bounds.x + scene.bounds.width);
        expect(p.y).toBeLessThanOrEqual(scene.bounds.y + scene.bounds.height);
      }
    }
  });

  it('frames in whole pixels, so an exported picture has a clean size', () => {
    const { bounds } = isometricScene({ nodes: [block('a', 0, 0), block('b', 137, 291)], edges: [] });
    for (const value of Object.values(bounds)) expect(Number.isInteger(value)).toBe(true);
  });

  it('is empty, not broken, for an empty Diagram', () => {
    const scene = isometricScene({ nodes: [], edges: [] });
    expect(scene.boxes).toEqual([]);
    expect(Number.isFinite(scene.bounds.width)).toBe(true);
  });
});
