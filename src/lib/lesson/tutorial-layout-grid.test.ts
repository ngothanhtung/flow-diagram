import { describe, expect, it } from 'vitest';
import { GRID, placeScene, snapCenter, snapSize } from './tutorial-layout';

describe('snapSize', () => {
  it('rounds up to whole 40px cells, never below one cell', () => {
    expect(snapSize({ width: 196, height: 86 })).toEqual({ width: 200, height: 120 });
    expect(snapSize({ width: 200, height: 40 })).toEqual({ width: 200, height: 40 });
    expect(snapSize({ width: 12, height: 0 })).toEqual({ width: GRID, height: GRID });
  });
});

describe('snapCenter', () => {
  it('puts the top-left corner on the nearest grid point', () => {
    const size = { width: 200, height: 120 };
    const center = snapCenter({ x: 113, y: -7 }, size);
    expect(center.x - size.width / 2).toBe(0);
    expect(center.y - size.height / 2).toBe(-80);
  });
});

describe('placeScene on a grid', () => {
  it('snaps every top-left and keeps a cell between boxes the rounding brought together', () => {
    const box = () => ({ width: 200, height: 80 });
    const steps = new Set([0]);
    const { positions } = placeScene(
      [
        { key: 'a', ux: 0, uy: 0, size: box, steps },
        { key: 'b', ux: 7, uy: 0, size: box, steps },
      ],
      { minScale: 16, maxScale: 16, gap: GRID, grid: GRID },
    );
    const a = positions.get('a')!;
    const b = positions.get('b')!;
    for (const p of [a, b]) {
      expect(Math.abs((p.x - 100) % GRID)).toBe(0);
      expect(Math.abs((p.y - 40) % GRID)).toBe(0);
    }
    expect(Math.abs(b.x - a.x) - 200).toBeGreaterThanOrEqual(GRID);
  });
});
