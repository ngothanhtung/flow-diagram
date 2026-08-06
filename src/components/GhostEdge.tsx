'use client';

import { ArrowRight } from 'lucide-react';
import { buildPath, portAnchor } from './edge-geometry';
import type { ConnectionSide, NodeShape } from '@/lib/flowchart-types';

interface GhostEdgeProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromShape?: NodeShape;
  toShape?: NodeShape;
  fromSide?: ConnectionSide;
  toSide?: ConnectionSide;
  fromAnchor?: { x: number; y: number };
  toAnchor?: { x: number; y: number };
  tone?: string;
  color?: string;
}

/**
 * Transient edge shown while the user drags from a node's output port.
 * Uses the same path math as AnimatedEdge so the visual transition
 * when the edge "snaps in" is invisible to the user.
 */
export function GhostEdge({
  fromX,
  fromY,
  toX,
  toY,
  fromShape = 'circle',
  toShape = 'circle',
  fromSide = 'right',
  toSide = 'left',
  fromAnchor: customFromAnchor,
  toAnchor: customToAnchor,
  tone = 'text-sky-300/80',
  color,
}: GhostEdgeProps) {
  const fromAnchor = customFromAnchor ?? portAnchor(fromShape, fromSide);
  const toAnchor = customToAnchor ?? portAnchor(toShape, toSide);
  const { d, end, angle } = buildPath(
    { x: fromX, y: fromY },
    fromAnchor,
    { x: toX, y: toY },
    toAnchor,
  );
  return (
    <g
      className={`pointer-events-none ${tone}`}
      style={color ? { color } : undefined}
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="6 6"
        fill="none"
      />
      {/* Arrowhead at the cursor's silhouette point, rotated to match
          the line angle. The `x` offset is in shape-local units along
          the line, so we translate the group and then offset by
          -toAnchorLen. */}
      <g transform={`translate(${end.x} ${end.y}) rotate(${angle}) translate(-10 0)`}>
        <foreignObject x={-12} y={-12} width={24} height={24}>
          <ArrowRight
            size={22}
            strokeWidth={2.5}
            className="text-current"
          />
        </foreignObject>
      </g>
    </g>
  );
}
