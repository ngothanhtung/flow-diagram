import { describe, expect, it } from 'vitest';
import type { LineCorner } from '@/lib/flowchart-types';
import { endpointsOfLine, lineCornerOf, lineGeometryFromEndpoints, oppositeCorner } from '@/lib/line-geometry';

describe('lineGeometryFromEndpoints ↔ endpointsOfLine', () => {
  // One segment per direction, so every corner is the start corner once.
  const cases: Array<{ name: string; start: { x: number; y: number }; end: { x: number; y: number }; corner: LineCorner }> = [
    { name: 'right and down', start: { x: 10, y: 20 }, end: { x: 110, y: 70 }, corner: 'nw' },
    { name: 'right and up', start: { x: 10, y: 70 }, end: { x: 110, y: 20 }, corner: 'sw' },
    { name: 'left and down', start: { x: 110, y: 20 }, end: { x: 10, y: 70 }, corner: 'ne' },
    { name: 'left and up', start: { x: 110, y: 70 }, end: { x: 10, y: 20 }, corner: 'se' },
  ];

  it.each(cases)('round-trips a segment running $name', ({ start, end, corner }) => {
    const geometry = lineGeometryFromEndpoints(start, end);
    expect(geometry.lineStart).toBe(corner);
    expect(geometry.position).toEqual({ x: 60, y: 45 });
    expect(geometry.width).toBe(100);
    expect(geometry.height).toBe(50);

    const back = endpointsOfLine(
      { position: geometry.position, lineStart: geometry.lineStart },
      geometry.width,
      geometry.height,
    );
    expect(back).toEqual({ start, end });
  });

  it('keeps a dead-horizontal line flat (height 0)', () => {
    const geometry = lineGeometryFromEndpoints({ x: 0, y: 40 }, { x: 80, y: 40 });
    expect(geometry.height).toBe(0);
    expect(endpointsOfLine({ position: geometry.position, lineStart: geometry.lineStart }, geometry.width, geometry.height)).toEqual({
      start: { x: 0, y: 40 },
      end: { x: 80, y: 40 },
    });
  });

  it('keeps the start as the start after it is dragged past the end', () => {
    // Start dragged from the left of the end to its right: the start corner
    // must follow it, not silently swap which end carries the start marker.
    const before = lineGeometryFromEndpoints({ x: 0, y: 0 }, { x: 100, y: 0 });
    const after = lineGeometryFromEndpoints({ x: 150, y: 0 }, { x: 100, y: 0 });
    expect(before.lineStart).toBe('nw');
    expect(after.lineStart).toBe('ne');
    expect(endpointsOfLine({ position: after.position, lineStart: after.lineStart }, after.width, after.height).start).toEqual({ x: 150, y: 0 });
  });
});

describe('lineCornerOf', () => {
  it('prefers lineStart over the legacy lineFlip', () => {
    expect(lineCornerOf({ lineStart: 'se', lineFlip: true })).toBe('se');
  });

  it('reads the legacy lineFlip when lineStart is unset', () => {
    expect(lineCornerOf({ lineFlip: true })).toBe('ne');
    expect(lineCornerOf({ lineFlip: false })).toBe('nw');
    expect(lineCornerOf({})).toBe('nw');
  });
});

describe('oppositeCorner', () => {
  it('pairs each corner with its diagonal opposite', () => {
    expect(oppositeCorner('nw')).toBe('se');
    expect(oppositeCorner('ne')).toBe('sw');
    expect(oppositeCorner('se')).toBe('nw');
    expect(oppositeCorner('sw')).toBe('ne');
  });
});
