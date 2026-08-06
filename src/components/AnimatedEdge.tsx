'use client';

import type { EdgeMarker, ExecutionState, FlowEdge, FlowNode } from '@/lib/flowchart-types';
import { EDGE_DRAW_DURATION_MS } from '@/lib/execution-timing';
import { edgeLabelBox, resolveEdgeLabelStyle } from '@/lib/edge-label-style';
import { NODE_FONT_FAMILIES } from '@/lib/node-fonts';
import { buildEdgeGeometry, pointAlongEdgeGeometry } from './edge-geometry';
import { EdgeEffectLayer } from './edge-effect-layer';
import { EdgeMarkerSymbol } from './edge-marker';

interface AnimatedEdgeProps {
  edge: FlowEdge;
  from: FlowNode;
  to: FlowNode;
  /** Pause animation, e.g. when the user is dragging a node. */
  paused?: boolean;
  /** When true, render a hit area over the edge to receive pointer events for deletion. */
  interactive?: boolean;
  onClick?: (edgeId: string) => void;
  /** Starts a drag that slides the label along the line. Editor only —
   *  the canvas owns the pointer maths and writes `labelOffset`. */
  onLabelPointerDown?: (edgeId: string, event: React.PointerEvent<SVGGElement>) => void;
  /** Double-click on the line body — the canvas turns it into a bend point. */
  onDoubleClick?: (edgeId: string, event: React.MouseEvent<SVGPathElement>) => void;
  selected?: boolean;
  /** Tailwind text-colour class (e.g. "text-sky-300") used for the
   *  line + arrowhead via `currentColor`. Falls back to text-sky-300. */
  tone?: string;
  color?: string;
  /** Colour for the animated objects travelling the line. When set,
   *  overrides `color` for the effect layer only (the line itself and
   *  its markers keep `color`). Undefined inherits the line colour. */
  effectColor?: string;
  /** Keep motion but remove expensive blur layers on dense diagrams. */
  performanceMode?: boolean;
  executionState?: ExecutionState;
}

export function AnimatedEdge({ edge, from, to, paused = false, interactive = false, onClick, onLabelPointerDown, onDoubleClick, selected = false, tone = 'text-sky-300', color, effectColor, performanceMode = false, executionState = 'normal' }: AnimatedEdgeProps) {
  const geometry = buildEdgeGeometry(edge, from, to);
  const { d, start, end, startAngle, angle, length } = geometry;
  const effect = edge.effect ?? 'flow';
  const direction = edge.direction ?? 'forward';
  const lineWidth = Math.max(1, Math.min(6, edge.width ?? 2.5));
  const effectSize = Math.max(0.5, Math.min(3, edge.effectSize ?? 1));
  const speed = Math.max(0.25, Math.min(3, edge.animationSpeed ?? 1));
  const startMarker = edge.startMarker ?? 'none';
  const endMarker = edge.endMarker ?? 'arrow';
  const lowPower = executionState === 'pending';
  const isDrawing = executionState === 'active';
  const showEffect = executionState === 'normal' || executionState === 'active';
  const drawDuration = `${EDGE_DRAW_DURATION_MS}ms`;
  const drawStyle = isDrawing
    ? ({
        '--edge-draw-duration': drawDuration,
        animationPlayState: paused ? 'paused' : 'running',
      } as React.CSSProperties)
    : undefined;
  const labelStyle = resolveEdgeLabelStyle(edge);
  const labelBox = edgeLabelBox(edge.label ?? '', labelStyle);
  const labelWidth = labelBox.width;
  // Where the label pill anchors — sampled on the drawn path itself
  // (not the endpoint chord, which diverges on bent routes). Which
  // options travel along vs. across the line follows the local segment
  // direction at the midpoint: on a horizontal segment left/right ride
  // the quarter marks and top/bottom float clear; on a vertical segment
  // the roles swap so the pill never sits on the stroke.
  const labelPosition = edge.labelPosition ?? 'center';
  const midSample = pointAlongEdgeGeometry(geometry, 0.5);
  const horizontalAtMid = Math.abs(midSample.direction.x) >= Math.abs(midSample.direction.y);
  const startSample = pointAlongEdgeGeometry(geometry, 0.25);
  const endSample = pointAlongEdgeGeometry(geometry, 0.75);
  const sideOffset = labelWidth / 2 + 10;
  const labelAnchor = edge.labelOffset !== undefined
    ? pointAlongEdgeGeometry(geometry, Math.max(0, Math.min(1, edge.labelOffset))).point
    : labelPosition === 'left'
      ? horizontalAtMid
        ? startSample.point
        : { x: midSample.point.x - sideOffset, y: midSample.point.y }
      : labelPosition === 'right'
        ? horizontalAtMid
          ? endSample.point
          : { x: midSample.point.x + sideOffset, y: midSample.point.y }
        : labelPosition === 'top'
          ? horizontalAtMid
            ? { x: midSample.point.x, y: midSample.point.y - 26 }
            : startSample.point
          : labelPosition === 'bottom'
            ? horizontalAtMid
              ? { x: midSample.point.x, y: midSample.point.y + 26 }
              : endSample.point
            : midSample.point;
  // The arrowhead rides at the silhouette — its offset from the
  // destination's centre is the length of the in-anchor plus a small
  // gap so the arrow doesn't overlap the port dot.
  return (
    <g className={tone} opacity={lowPower ? 0.42 : executionState === 'completed' ? 0.72 : 1} style={{ color: lowPower && !selected ? '#52525b' : color }}>
      {selected && (
        <path
          d={d}
          pathLength={isDrawing ? 1 : undefined}
          stroke='currentColor'
          strokeWidth={lineWidth + 6}
          strokeOpacity={0.12}
          strokeLinecap='round'
          fill='none'
          pointerEvents='none'
          className={isDrawing ? 'edge-power-draw' : undefined}
          style={drawStyle}
        />
      )}
      <path d={d} pathLength={isDrawing ? 1 : undefined} stroke='currentColor' strokeWidth={selected ? lineWidth + 2 : lineWidth} strokeOpacity={selected ? 0.82 : 0.52} fill='none' className={isDrawing ? 'edge-power-draw' : undefined} style={drawStyle} />

      <g opacity={showEffect ? 1 : 0} className={isDrawing ? 'edge-after-draw' : undefined} style={effectColor ? { ...drawStyle, color: effectColor } : drawStyle}>
        <EdgeEffectLayer
          d={d}
          effect={effect}
          direction={direction}
          length={length}
          lineWidth={lineWidth}
          effectSize={effectSize}
          speed={speed}
          paused={paused}
          performanceMode={performanceMode || lowPower}
          isDrawing={isDrawing}
          drawDuration={drawDuration}
        />
      </g>

      <g className={isDrawing ? 'edge-after-draw' : undefined} style={drawStyle}>
        <EdgeMarkerShape marker={startMarker} x={start.x} y={start.y} angle={startAngle} />
        <EdgeMarkerShape marker={endMarker} x={end.x} y={end.y} angle={angle} />
      </g>

      {edge.label && (
        <g
          transform={`translate(${labelAnchor.x} ${labelAnchor.y})`}
          pointerEvents={interactive ? 'auto' : 'none'}
          className={isDrawing ? 'edge-after-draw' : interactive ? (onLabelPointerDown ? 'cursor-move' : 'cursor-pointer') : undefined}
          style={drawStyle}
          onPointerDown={
            interactive && onLabelPointerDown
              ? (e) => {
                  e.stopPropagation();
                  onLabelPointerDown(edge.id, e);
                }
              : undefined
          }
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  onClick?.(edge.id);
                }
              : undefined
          }
        >
          <path d={labelBox.path} fill={labelStyle.background} />
          <text
            textAnchor='middle'
            dominantBaseline='central'
            fill={labelStyle.color}
            className='font-semibold uppercase tracking-wider'
            style={{ fontSize: labelStyle.fontSize, fontFamily: NODE_FONT_FAMILIES[labelStyle.fontFamily] }}
          >
            {edge.label}
          </text>
        </g>
      )}

      {interactive && (
        <path
          d={d}
          stroke='transparent'
          strokeWidth={16}
          fill='none'
          className='cursor-pointer'
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(edge.id);
          }}
          onDoubleClick={onDoubleClick ? (e) => onDoubleClick(edge.id, e) : undefined}
        />
      )}
    </g>
  );
}

function EdgeMarkerShape({ marker, x, y, angle }: { marker: EdgeMarker; x: number; y: number; angle: number }) {
  if (marker === 'none') return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} pointerEvents='none'>
      <EdgeMarkerSymbol marker={marker} />
    </g>
  );
}
