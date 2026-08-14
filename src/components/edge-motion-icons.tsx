'use client';

// Renders a picked `NodeIcon` riding a connector, evenly spaced — the
// simplified, icon-only counterpart of the old built-in shape catalog.
// Always rendered at a fixed 16px; there is no size knob for this.
//
// See `EdgeMotionObjects` (removed) for the fuller version this was
// trimmed from — placement mechanics (CSS motion path, spacing delay
// ladder) are unchanged, just for a single resolved icon instead of a
// choice of built-in glyph or icon.

import type { CSSProperties } from 'react';
import type { NodeIcon } from '@/lib/flowchart-types';
import { useResolvedIcon } from '@/lib/icon-library';

const GLYPH_SIZE = 16;

interface EdgeMotionIconsProps {
  /** Same path `d` the line itself is drawn with. */
  d: string;
  icon: NodeIcon;
  /** How many icons ride the route at once. */
  count: number;
  /** Seconds for one icon to travel the whole route. */
  duration: number;
  reverse: boolean;
  paused: boolean;
  filter?: string;
  /** Execution draw-in: hold the icons back until the line is traced. */
  drawDelay?: string;
}

export function EdgeMotionIcons({ d, icon, count, duration, reverse, paused, filter, drawDelay }: EdgeMotionIconsProps) {
  const Icon = useResolvedIcon(icon);
  if (!Icon) return null;

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        // Negative delay = start mid-lap, which is what spreads the icons
        // out. During the draw-in the positive hold has to win, so the two
        // are summed in a calc() instead of one replacing the other.
        const offsetSeconds = (index / count) * duration;
        const delay = drawDelay ? `calc(${drawDelay} - ${offsetSeconds.toFixed(4)}s)` : `-${offsetSeconds.toFixed(4)}s`;
        const style: CSSProperties = {
          offsetPath: `path("${d}")`,
          // Icons have no inherent "forward" direction, so they stay
          // upright regardless of travel direction.
          offsetRotate: '0deg',
          animationDuration: `${duration}s`,
          animationDelay: delay,
          animationDirection: reverse ? 'reverse' : 'normal',
          animationPlayState: paused ? 'paused' : 'running',
          animationFillMode: drawDelay ? 'backwards' : undefined,
          filter,
        };
        return (
          <g key={index} className='animate-[edge-motion_1.2s_linear_infinite]' style={style}>
            <g transform={`translate(${-GLYPH_SIZE / 2} ${-GLYPH_SIZE / 2})`}>
              <Icon size={GLYPH_SIZE} />
            </g>
          </g>
        );
      })}
    </>
  );
}
