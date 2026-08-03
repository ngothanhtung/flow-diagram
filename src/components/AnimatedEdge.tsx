'use client';

import type {
  EdgeEffect,
  EdgeMarker,
  ExecutionState,
  FlowEdge,
  FlowNode,
} from '@/lib/flowchart-types';
import { EDGE_DRAW_DURATION_MS } from '@/lib/execution-timing';
import {
  buildEdgeGeometry,
} from './edge-geometry';

interface AnimatedEdgeProps {
  edge: FlowEdge;
  from: FlowNode;
  to: FlowNode;
  /** Pause animation, e.g. when the user is dragging a node. */
  paused?: boolean;
  /** When true, render a hit area over the edge to receive pointer events for deletion. */
  interactive?: boolean;
  onClick?: (edgeId: string) => void;
  selected?: boolean;
  /** Tailwind text-colour class (e.g. "text-sky-300") used for the
   *  line + arrowhead via `currentColor`. Falls back to text-sky-300. */
  tone?: string;
  color?: string;
  /** Keep motion but remove expensive blur layers on dense diagrams. */
  performanceMode?: boolean;
  executionState?: ExecutionState;
}

/**
 * Effects whose object travels the entire route use pixels/second so changing
 * connector length does not make the same effect suddenly race or crawl.
 */
const TRAVEL_VELOCITY: Partial<Record<EdgeEffect, number>> = {
  pulse: 150,
  glow: 120,
  comet: 190,
  dots: 115,
  scanner: 190,
  bidirectional: 135,
  laser: 145,
  meteor: 230,
  spark: 135,
  fade: 100,
};

/** Pattern effects move a repeating texture, so each gets a calibrated beat. */
const PATTERN_DURATION: Partial<Record<EdgeEffect, number>> = {
  flow: 0.95,
  dash: 0.75,
  wave: 1.1,
  traffic: 0.82,
  marching: 1.05,
  binary: 0.88,
  heartbeat: 1.25,
  rail: 0.85,
};

export function AnimatedEdge({
  edge,
  from,
  to,
  paused = false,
  interactive = false,
  onClick,
  selected = false,
  tone = 'text-sky-300',
  color,
  performanceMode = false,
  executionState = 'normal',
}: AnimatedEdgeProps) {
  const geometry = buildEdgeGeometry(edge, from, to);
  const { d, mid, start, end, startAngle, angle, length } = geometry;
  const effect = edge.effect ?? 'flow';
  const direction = edge.direction ?? 'forward';
  const lineWidth = Math.max(1, Math.min(6, edge.width ?? 2.5));
  const effectSize = Math.max(0.5, Math.min(3, edge.effectSize ?? 1));
  const effectWidth = Math.max(1, lineWidth * effectSize);
  // Particle count grows with the actual routed path length. Larger
  // particles reserve more room so short connectors never look crowded.
  const particleCount = Math.max(
    1,
    Math.min(14, Math.round(length / (96 * Math.sqrt(effectSize)))),
  );
  const particlePeriod = 100 / particleCount;
  const dotDasharray = `0.1 ${Math.max(0.1, particlePeriod - 0.1)}`;
  const cometLength = Math.min(1.2, particlePeriod * 0.16);
  const cometDasharray = `${cometLength} ${Math.max(0.1, particlePeriod - cometLength)}`;
  const speed = Math.max(0.25, Math.min(3, edge.animationSpeed ?? 1));
  const startMarker = edge.startMarker ?? 'none';
  const endMarker = edge.endMarker ?? 'arrow';
  const travelVelocity = TRAVEL_VELOCITY[effect];
  const baseDuration = travelVelocity
    ? Math.max(0.65, Math.min(6, length / travelVelocity))
    : (PATTERN_DURATION[effect] ?? 1.1);
  const animationDurationSeconds = baseDuration / speed;
  const animationDuration = `${animationDurationSeconds}s`;
  const lowPower = executionState === 'pending';
  const isDrawing = executionState === 'active';
  const showEffect = executionState === 'normal' || executionState === 'active';
  const drawDuration = `${EDGE_DRAW_DURATION_MS}ms`;
  const neonFilter = performanceMode || lowPower
    ? undefined
    : `drop-shadow(0 0 ${Math.max(2, effectSize * 2.5)}px currentColor) drop-shadow(0 0 ${Math.max(5, effectSize * 5)}px currentColor)`;
  const strongNeonFilter = performanceMode || lowPower
    ? undefined
    : `drop-shadow(0 0 ${Math.max(4, effectSize * 4)}px currentColor) drop-shadow(0 0 ${Math.max(9, effectSize * 8)}px currentColor)`;
  const animationStyle = {
    animationDuration,
    animationDelay: isDrawing ? drawDuration : undefined,
    animationPlayState: paused ? 'paused' : 'running',
    animationDirection: direction === 'reverse' ? 'reverse' : 'normal',
    animationFillMode: isDrawing ? 'backwards' : undefined,
    filter: neonFilter,
  } as const;
  const drawStyle = isDrawing
    ? ({
        '--edge-draw-duration': drawDuration,
        animationPlayState: paused ? 'paused' : 'running',
      } as React.CSSProperties)
    : undefined;
  const labelWidth = edge.label
    ? Math.max(44, Math.min(180, edge.label.length * 7 + 24))
    : 44;
  // The arrowhead rides at the silhouette — its offset from the
  // destination's centre is the length of the in-anchor plus a small
  // gap so the arrow doesn't overlap the port dot.
  return (
    <g
      className={tone}
      opacity={lowPower ? 0.42 : executionState === 'completed' ? 0.72 : 1}
      style={{ color: lowPower && !selected ? '#52525b' : color }}
    >
      {selected && (
        <path
          d={d}
          pathLength={isDrawing ? 1 : undefined}
          stroke="currentColor"
          strokeWidth={lineWidth + 6}
          strokeOpacity={0.12}
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
          className={isDrawing ? 'edge-power-draw' : undefined}
          style={drawStyle}
        />
      )}
      <path
        d={d}
        pathLength={isDrawing ? 1 : undefined}
        stroke="currentColor"
        strokeWidth={selected ? lineWidth + 2 : lineWidth}
        strokeOpacity={selected ? 0.82 : 0.52}
        fill="none"
        className={isDrawing ? 'edge-power-draw' : undefined}
        style={drawStyle}
      />

      <g
        opacity={showEffect ? 1 : 0}
        className={isDrawing ? 'edge-after-draw' : undefined}
        style={drawStyle}
      >
      {effect === 'flow' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="8 12"
          className="animate-[edge-dash_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'dash' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="6 7"
          className="animate-[edge-packet-stream_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'pulse' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="16 84"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'glow' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="32 68"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter }}
        />
      )}
      {effect === 'comet' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={cometDasharray}
          className="animate-[edge-travel_.9s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'dots' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={dotDasharray}
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'wave' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="10 6 2 6"
          className="animate-[edge-wave_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'scanner' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="8 92"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter }}
        />
      )}
      {effect === 'traffic' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="4 6 1 6"
          className="animate-[edge-traffic_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'laser' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="44 56"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter }}
        />
      )}
      {effect === 'meteor' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 4}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="2 98"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter }}
        />
      )}
      {effect === 'spark' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={dotDasharray}
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter }}
        />
      )}
      {effect === 'marching' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="square"
          fill="none"
          strokeDasharray="14 5"
          className="animate-[edge-dash_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'binary' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="2 3 8 3"
          className="animate-[edge-traffic_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'heartbeat' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize * 2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="1 4 18 4"
          className="animate-[edge-wave_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'rail' && (
        <>
          <path d={d} stroke="currentColor" strokeWidth={effectWidth + effectSize * 4} strokeOpacity={0.22} fill="none" />
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={effectWidth}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray="3 5"
            className="animate-[edge-packet-stream_1.2s_linear_infinite]"
            style={animationStyle}
          />
        </>
      )}
      {effect === 'fade' && (
        <path
          d={d}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={effectWidth + effectSize}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="55 45"
          className="animate-[edge-travel_1.2s_linear_infinite]"
          style={{ ...animationStyle, filter: strongNeonFilter, opacity: 0.78 }}
        />
      )}
      {effect === 'bidirectional' && (
        <>
          <path
            d={d}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={effectWidth + effectSize}
            strokeLinecap="round"
            fill="none"
            strokeDasharray="9 91"
            className="animate-[edge-travel_1.2s_linear_infinite]"
            style={animationStyle}
          />
          <path
            d={d}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={effectWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray="9 91"
            className="animate-[edge-travel_1.2s_linear_infinite]"
            style={{
              ...animationStyle,
              animationDirection:
                direction === 'reverse' ? 'normal' : 'reverse',
              animationDelay: isDrawing
                ? drawDuration
                : `-${animationDurationSeconds / 2}s`,
              opacity: 0.65,
            }}
          />
        </>
      )}
      </g>

      <g
        className={isDrawing ? 'edge-after-draw' : undefined}
        style={drawStyle}
      >
        <EdgeMarkerShape marker={startMarker} x={start.x} y={start.y} angle={startAngle} />
        <EdgeMarkerShape marker={endMarker} x={end.x} y={end.y} angle={angle} />
      </g>

      {edge.label && (
        <g
          transform={`translate(${mid.x} ${mid.y})`}
          pointerEvents="none"
          className={isDrawing ? 'edge-after-draw' : undefined}
          style={drawStyle}
        >
          <rect
            x={-labelWidth / 2}
            y={-12}
            width={labelWidth}
            height={24}
            rx={12}
            className="fill-zinc-900 dark:fill-zinc-100"
            opacity={0.9}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-white dark:fill-zinc-900 text-[11px] font-semibold uppercase tracking-wider"
          >
            {edge.label}
          </text>
        </g>
      )}

      {interactive && (
        <path
          d={d}
          stroke="transparent"
          strokeWidth={16}
          fill="none"
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(edge.id);
          }}
        />
      )}
    </g>
  );
}

function EdgeMarkerShape({
  marker,
  x,
  y,
  angle,
}: {
  marker: EdgeMarker;
  x: number;
  y: number;
  angle: number;
}) {
  if (marker === 'none') return null;

  const shape = (() => {
    switch (marker) {
      case 'arrow':
        return <path d="M -11 -6 L 0 0 L -11 6 Z" fill="currentColor" />;
      case 'open-arrow':
        return (
          <path
            d="M -11 -7 L 0 0 L -11 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case 'triangle':
        return (
          <path
            d="M -11 -7 L 0 0 L -11 7 Z"
            fill="#18181b"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        );
      case 'circle':
        return <circle cx={-5} cy={0} r={5} fill="#18181b" stroke="currentColor" strokeWidth={2} />;
      case 'diamond':
        return <path d="M 0 0 L -6 -6 L -12 0 L -6 6 Z" fill="#18181b" stroke="currentColor" strokeWidth={2} />;
    }
  })();

  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle})`}
      pointerEvents="none"
    >
      {shape}
    </g>
  );
}
