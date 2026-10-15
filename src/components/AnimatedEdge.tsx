'use client';

import { EDGE_DIRECTIONS, EDGE_EFFECTS, EDGE_MARKERS, finiteOr, memberOr } from '@/lib/document-vocabulary';
import type { EdgeDirection, EdgeEffect, EdgeMarker, ExecutionState, FlowEdge, FlowNode } from '@/lib/flowchart-types';
import { EDGE_DRAW_DURATION_MS } from '@/lib/execution-timing';
import { edgeLabelBox, resolveEdgeLabelStyle } from '@/lib/edge-label-style';
import { edgeLineCap, edgeLineDash } from '@/lib/edge-style';
import { NODE_FONT_FAMILIES } from '@/lib/node-fonts';
import { buildEdgeGeometry, edgeLabelAnchor } from './edge-geometry';
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
  /** Static run mode: render this line as if `effect: 'none'` — a plain
   *  connector, not a frozen mid-effect one. A paused travelling-object
   *  mark (a short dash the same colour as the line) reads as barely
   *  distinguishable from the line itself once it stops moving, so
   *  freezing it (the node-effect approach) just looks broken here
   *  rather than intentional; hiding it reads as the plain reference
   *  diagram `static` is meant to show. */
  flattenEffect?: boolean;
}

export function AnimatedEdge({ edge, from, to, paused = false, interactive = false, onClick, onLabelPointerDown, onDoubleClick, selected = false, tone = 'text-sky-300', color, effectColor: rawEffectColor, performanceMode = false, executionState = 'normal', flattenEffect = false }: AnimatedEdgeProps) {
  const geometry = buildEdgeGeometry(edge, from, to);
  const { d, start, end, startAngle, angle, length } = geometry;
  // Every optional field is read through its vocabulary, like
  // `resolveNodeStyle` does for nodes: an out-of-range value falls back to
  // the default rather than reaching a lookup table (`PATTERN_DASHES[…]`).
  const effect = flattenEffect ? 'none' : memberOr<EdgeEffect>(EDGE_EFFECTS, edge.effect, 'flow');
  const direction = memberOr<EdgeDirection>(EDGE_DIRECTIONS, edge.direction, 'forward');
  const lineWidth = Math.max(1, Math.min(6, finiteOr(edge.width, 2.5)));
  const effectSize = Math.max(0.5, Math.min(3, finiteOr(edge.effectSize, 1)));
  const effectCount = isFiniteNumber(edge.effectCount) ? Math.max(1, Math.min(8, Math.round(edge.effectCount))) : undefined;
  const effectDensity = isFiniteNumber(edge.effectDensity) ? Math.max(0.5, Math.min(2, edge.effectDensity)) : undefined;
  const glowIntensity = isFiniteNumber(edge.glowIntensity) ? Math.max(0, Math.min(3, edge.glowIntensity)) : undefined;
  const glowColor = typeof edge.glowColor === 'string' ? edge.glowColor : undefined;
  const speed = Math.max(0.25, Math.min(3, finiteOr(edge.animationSpeed, 1)));
  const startMarker = memberOr<EdgeMarker>(EDGE_MARKERS, edge.startMarker, 'none');
  const endMarker = memberOr<EdgeMarker>(EDGE_MARKERS, edge.endMarker, 'none');
  const effectShape = typeof edge.effectShape === 'string' ? edge.effectShape : undefined;
  const effectColor = typeof rawEffectColor === 'string' ? rawEffectColor : undefined;
  const lowPower = executionState === 'pending';
  const isDrawing = executionState === 'active';
  const lineDash = edgeLineDash(edge.lineStyle, lineWidth);
  const lineCap = edgeLineCap(edge.lineStyle);
  // The draw-in reveal is a `stroke-dasharray` trick (`.edge-power-draw` in
  // globals.css) — the same attribute a dashed/dotted line needs for its own
  // pattern, so the two cannot share one path. Putting the reveal on a mask
  // instead lets the line underneath keep its pattern the whole way through.
  // Dropping the pattern for the draw's duration is what made "Stroke
  // pattern" look dead outside `static`: every other mode marks at least one
  // edge 'active', and `concurrent` marks *every* edge 'active' for the whole
  // run, so there was no "after the draw" for the pattern to come back in.
  // A solid line needs none of this and keeps the cheap single path.
  const maskedDraw = isDrawing && lineDash !== undefined;
  const drawnPathLength = isDrawing && !maskedDraw ? 1 : undefined;
  const drawClass = isDrawing && !maskedDraw ? 'edge-power-draw' : undefined;
  const drawMaskId = `edge-draw-${edge.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const drawMask = maskedDraw ? `url(#${drawMaskId})` : undefined;
  // No point on a route can sit further from an endpoint than the route's own
  // arc length, so this box is guaranteed to hold the whole path — bends,
  // curve bulges and all — without asking the DOM for a bounding box.
  const maskPad = length + lineWidth + 8;
  const showEffect = executionState === 'normal' || executionState === 'active';
  const drawDuration = `${finiteOr(edge.duration, EDGE_DRAW_DURATION_MS)}ms`;
  const drawStyle = isDrawing
    ? ({
        '--edge-draw-duration': drawDuration,
        animationPlayState: paused ? 'paused' : 'running',
      } as React.CSSProperties)
    : undefined;
  const labelStyle = resolveEdgeLabelStyle(edge);
  const labelBox = edgeLabelBox(edge.label ?? '', labelStyle);
  const labelWidth = labelBox.width;
  // Where the label pill anchors — shared with the image export's bounds
  // so a label can never sit outside the exported picture.
  const labelAnchor = edgeLabelAnchor(edge, geometry, labelWidth);
  // The arrowhead rides at the silhouette — its offset from the
  // destination's centre is the length of the in-anchor plus a small
  // gap so the arrow doesn't overlap the port dot.
  return (
    <g className={tone} opacity={lowPower ? 0.42 : executionState === 'completed' ? 0.72 : 1} style={{ color: lowPower && !selected ? '#52525b' : color }}>
      {maskedDraw && (
        <defs>
          <mask
            id={drawMaskId}
            maskUnits='userSpaceOnUse'
            x={Math.min(start.x, end.x) - maskPad}
            y={Math.min(start.y, end.y) - maskPad}
            width={Math.abs(end.x - start.x) + maskPad * 2}
            height={Math.abs(end.y - start.y) + maskPad * 2}
          >
            <path d={d} pathLength={1} stroke='#fff' strokeWidth={lineWidth + 14} fill='none' className='edge-power-draw' style={drawStyle} />
          </mask>
        </defs>
      )}
      {selected && (
        <path
          d={d}
          pathLength={drawnPathLength}
          stroke='currentColor'
          strokeWidth={lineWidth + 6}
          strokeOpacity={0.12}
          strokeLinecap='round'
          fill='none'
          pointerEvents='none'
          className={drawClass}
          mask={drawMask}
          style={drawStyle}
        />
      )}
      <path d={d} pathLength={drawnPathLength} stroke='currentColor' strokeWidth={selected ? lineWidth + 2 : lineWidth} strokeOpacity={selected ? 0.82 : 0.52} strokeDasharray={lineDash} strokeLinecap={lineCap} fill='none' className={drawClass} mask={drawMask} style={drawStyle} />

      <g opacity={showEffect ? 1 : 0} className={isDrawing ? 'edge-after-draw' : undefined} style={effectColor ? { ...drawStyle, color: effectColor } : drawStyle}>
        <EdgeEffectLayer
          d={d}
          effect={effect}
          direction={direction}
          length={length}
          lineWidth={lineWidth}
          effectSize={effectSize}
          speed={speed}
          count={effectCount}
          density={effectDensity}
          glow={glowIntensity}
          glowColor={glowColor}
          shape={effectShape}
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
      {/* Painted after the hit area on purpose: that 16px transparent band
          runs straight through the chip, so drawing the label first would
          leave the pointer hitting the line instead of the label. */}
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
            className='font-semibold uppercase tracking-wider select-none'
            style={{ fontSize: labelStyle.fontSize, fontFamily: NODE_FONT_FAMILIES[labelStyle.fontFamily] }}
          >
            {edge.label}
          </text>
        </g>
      )}

    </g>
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function EdgeMarkerShape({ marker, x, y, angle }: { marker: EdgeMarker; x: number; y: number; angle: number }) {
  if (marker === 'none') return null;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} pointerEvents='none'>
      <EdgeMarkerSymbol marker={marker} />
    </g>
  );
}
