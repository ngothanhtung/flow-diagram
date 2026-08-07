'use client';

// Glyphs for the "object shape" line effects — the real silhouettes that
// ride a connector instead of a plain dash (an arrow, an envelope, a coin…).
//
// Every glyph is authored inside a 20×20 box centred on the origin, so the
// motion layer can place it with a single uniform scale and no per-shape
// offset. `rotate: true` means the glyph points along the route (an arrow
// must); the rest stay upright so they remain readable on vertical and
// diagonal segments.

import type { EdgeObjectShape } from '@/lib/flowchart-types';

export interface EdgeObjectShapeSpec {
  label: string;
  /** Follow the path's local direction instead of staying upright. */
  rotate: boolean;
  render: (fill: string) => React.ReactNode;
}

const stroke = (color: string) => ({ stroke: color, fill: 'none', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });

export const EDGE_OBJECT_SHAPES: Record<EdgeObjectShape, EdgeObjectShapeSpec> = {
  arrow: {
    label: 'Arrow',
    rotate: true,
    render: (fill) => <path d='M -7 -5.5 L 7 0 L -7 5.5 L -4 0 Z' fill={fill} />,
  },
  chevron: {
    label: 'Chevron',
    rotate: true,
    render: (fill) => <path d='M -5 -6 L 4 0 L -5 6' {...stroke(fill)} strokeWidth={2.4} />,
  },
  plane: {
    label: 'Plane',
    rotate: true,
    render: (fill) => <path d='M 8 0 L -6 5.5 L -3.5 0 L -6 -5.5 Z' fill={fill} />,
  },
  bolt: {
    label: 'Bolt',
    rotate: true,
    render: (fill) => <path d='M 2 -7 L -4 0.5 L 0 0.5 L -2 7 L 4 -0.5 L 0 -0.5 Z' fill={fill} />,
  },
  envelope: {
    label: 'Envelope',
    rotate: false,
    render: (fill) => (
      <>
        <rect x={-7} y={-5} width={14} height={10} rx={1.4} fill={fill} />
        <path d='M -7 -4.2 L 0 1.4 L 7 -4.2' stroke='#000' strokeOpacity={0.45} strokeWidth={1.4} fill='none' strokeLinejoin='round' />
      </>
    ),
  },
  box: {
    label: 'Package',
    rotate: false,
    render: (fill) => (
      <>
        <rect x={-6} y={-6} width={12} height={12} rx={1.2} fill={fill} />
        <path d='M -6 -1.5 L 6 -1.5 M 0 -6 L 0 -1.5' stroke='#000' strokeOpacity={0.45} strokeWidth={1.4} fill='none' />
      </>
    ),
  },
  coin: {
    label: 'Coin',
    rotate: false,
    render: (fill) => (
      <>
        <circle r={6} fill={fill} />
        <circle r={3.6} fill='none' stroke='#000' strokeOpacity={0.4} strokeWidth={1.2} />
      </>
    ),
  },
  dot: {
    label: 'Dot',
    rotate: false,
    render: (fill) => <circle r={4.5} fill={fill} />,
  },
  ring: {
    label: 'Ring',
    rotate: false,
    render: (fill) => <circle r={5} {...stroke(fill)} strokeWidth={2} />,
  },
  square: {
    label: 'Square',
    rotate: false,
    render: (fill) => <rect x={-4.6} y={-4.6} width={9.2} height={9.2} rx={1} fill={fill} />,
  },
  diamond: {
    label: 'Diamond',
    rotate: false,
    render: (fill) => <path d='M 0 -6 L 6 0 L 0 6 L -6 0 Z' fill={fill} />,
  },
  star: {
    label: 'Star',
    rotate: false,
    render: (fill) => <path d='M 0 -7 L 1.9 -2.3 L 6.9 -2.1 L 3 1 L 4.3 5.9 L 0 3.1 L -4.3 5.9 L -3 1 L -6.9 -2.1 L -1.9 -2.3 Z' fill={fill} />,
  },
};

export const EDGE_OBJECT_SHAPE_OPTIONS = (Object.keys(EDGE_OBJECT_SHAPES) as EdgeObjectShape[]).map((value) => ({ value, label: EDGE_OBJECT_SHAPES[value].label }));

/** Standalone swatch for the shape picker — same glyph, fixed size. */
export function EdgeObjectShapeSwatch({ shape, size = 20 }: { shape: EdgeObjectShape; size?: number }) {
  return (
    <svg width={size} height={size} viewBox='-10 -10 20 20' className='shrink-0' aria-hidden='true'>
      {EDGE_OBJECT_SHAPES[shape].render('currentColor')}
    </svg>
  );
}
