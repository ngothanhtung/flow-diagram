'use client';

// Renders N real object silhouettes riding a connector, evenly spaced.
//
// Placement uses the CSS motion path (`offset-path: path(...)` +
// `offset-distance`) rather than SMIL `<animateMotion>`: a CSS animation
// honours `animation-play-state` (the canvas pauses effects while a node is
// dragged), `animation-direction` (reverse lines), `animation-delay` (the
// phase-offset control and the execution draw-in) and `animation-duration`
// (the speed slider) — all of which SMIL would need bespoke handling for.
//
// Spacing is a delay ladder: object *i* starts i/N of a lap early, so the
// objects are evenly distributed along the route at any moment.

import type { CSSProperties } from 'react';
import { EDGE_OBJECT_SHAPES } from '@/components/edge-object-shapes';
import type { EdgeObjectShape } from '@/lib/flowchart-types';

interface EdgeMotionObjectsProps {
  /** Same path `d` the line itself is drawn with. */
  d: string;
  shape: EdgeObjectShape;
  /** How many silhouettes ride the route at once. */
  count: number;
  /** Seconds for one object to travel the whole route. */
  duration: number;
  reverse: boolean;
  /** Glyph size in px (already scaled by the size slider). */
  size: number;
  paused: boolean;
  /** Fraction of a lap (0–1) every object is shifted by. */
  phase: number;
  filter?: string;
  /** Execution draw-in: hold the objects back until the line is traced. */
  drawDelay?: string;
}

export function EdgeMotionObjects({ d, shape, count, duration, reverse, size, paused, phase, filter, drawDelay }: EdgeMotionObjectsProps) {
  const spec = EDGE_OBJECT_SHAPES[shape];
  // The glyphs are authored in a 20-unit box, so this maps them to `size` px.
  const scale = size / 20;

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        // Negative delay = start mid-lap, which is what spreads the objects
        // out. During the draw-in the positive hold has to win, so the two
        // are summed in a calc() instead of one replacing the other.
        const offsetSeconds = ((index / count + phase) % 1) * duration;
        const delay = drawDelay ? `calc(${drawDelay} - ${offsetSeconds.toFixed(4)}s)` : `-${offsetSeconds.toFixed(4)}s`;
        const style: CSSProperties = {
          offsetPath: `path("${d}")`,
          // `auto` aligns with the path's own direction, which is the
          // direction of travel only when the animation plays forwards.
          // A reversed object moves against the path, so it needs the
          // extra half turn or it flies backwards.
          offsetRotate: spec.rotate ? (reverse ? 'auto 180deg' : 'auto') : '0deg',
          animationDuration: `${duration}s`,
          animationDelay: delay,
          animationDirection: reverse ? 'reverse' : 'normal',
          animationPlayState: paused ? 'paused' : 'running',
          animationFillMode: drawDelay ? 'backwards' : undefined,
          filter,
        };
        return (
          <g key={index} className='animate-[edge-motion_1.2s_linear_infinite]' style={style}>
            <g transform={`scale(${scale})`}>{spec.render('currentColor')}</g>
          </g>
        );
      })}
    </>
  );
}
