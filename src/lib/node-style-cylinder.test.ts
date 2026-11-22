import { describe, expect, it } from 'vitest';
import { portAnchor } from '@/components/edge-geometry';
import { SHAPES } from './node-style';

/** Topmost / bottommost y of a cubic Bézier, sampled (the cylinder's caps). */
function capExtremes(d: string): { top: number; bottom: number } {
  const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  // M x0 y0 C x1 y1 x2 y2 x3 y3 L x4 y4 C x5 y5 x6 y6 x7 y7 Z
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i <= 100; i += 1) {
    const t = i / 100;
    top = Math.min(top, cubic(numbers[1], numbers[3], numbers[5], numbers[7], t));
    bottom = Math.max(bottom, cubic(numbers[9], numbers[11], numbers[13], numbers[15], t));
  }
  return { top, bottom };
}

// The Lessons' data store: a cylinder that fills its box, unlike the classic
// `database` silhouette, whose caps stop short of the box edges.
describe('cylinder shape', () => {
  it('fills its box: the caps reach the top and bottom edges', () => {
    const { top, bottom } = capExtremes(SHAPES.cylinder.d);
    expect(top).toBeCloseTo(-56, 1);
    expect(bottom).toBeCloseTo(56, 1);
  });

  it('puts its top and bottom ports on the box edges, so Lines end on the grid', () => {
    expect(portAnchor('cylinder', 'top')).toEqual({ x: 0, y: -56 });
    expect(portAnchor('cylinder', 'bottom')).toEqual({ x: 0, y: 56 });
  });

  it('leaves the classic database silhouette as it was', () => {
    expect(portAnchor('database', 'top')).toEqual({ x: 0, y: -45 });
  });
});
