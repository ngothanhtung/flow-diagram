'use client';

import type { EdgeDirection, EdgeEffect } from '@/lib/flowchart-types';

/**
 * Effects whose object travels the entire route use pixels/second so changing
 * connector length does not make the same effect suddenly race or crawl.
 */
export const TRAVEL_VELOCITY: Partial<Record<EdgeEffect, number>> = {
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
export const PATTERN_DURATION: Partial<Record<EdgeEffect, number>> = {
  flow: 0.95,
  dash: 0.75,
  wave: 1.1,
  traffic: 0.82,
  marching: 1.05,
  binary: 1.15,
  heartbeat: 1.25,
  rail: 0.85,
};

interface EdgeEffectLayerProps {
  /** SVG path `d` the effect travels along — the exact same path drawn for the line itself. */
  d: string;
  effect: EdgeEffect;
  direction: EdgeDirection;
  /** Routed path length in px, used to keep travel speed constant regardless of line length. */
  length: number;
  lineWidth: number;
  effectSize: number;
  speed: number;
  paused?: boolean;
  /** Keep motion but remove expensive blur layers on dense diagrams. */
  performanceMode?: boolean;
  isDrawing?: boolean;
  drawDuration?: string;
}

/**
 * Renders the per-effect animated SVG paths travelling a line. Shared by the
 * live canvas edge and the effect picker's preview so the preview always
 * matches what actually ends up on the diagram.
 *
 * `direction: 'both'` runs the chosen effect twice — once forward, once
 * reverse — as two fully identical, mirrored passes (same width, same
 * opacity, same delay; only the animation direction flips), the same
 * symmetric-pair technique the dedicated `bidirectional` effect uses.
 * `bidirectional` already renders its own two-way pair unconditionally, so
 * it's excluded here to avoid quadrupling its objects.
 */
export function EdgeEffectLayer(props: EdgeEffectLayerProps) {
  if (props.direction === 'both' && props.effect !== 'bidirectional') {
    return (
      <>
        <EdgeEffectLayerSingle {...props} direction="forward" />
        <EdgeEffectLayerSingle {...props} direction="reverse" />
      </>
    );
  }
  return <EdgeEffectLayerSingle {...props} />;
}

function EdgeEffectLayerSingle({
  d,
  effect,
  direction,
  length,
  lineWidth,
  effectSize,
  speed,
  paused = false,
  performanceMode = false,
  isDrawing = false,
  drawDuration = '0ms',
}: EdgeEffectLayerProps) {
  // Every effect's traveling object — including backdrop/track layers and
  // secondary passes — is sized as the same fixed multiple of the line's
  // own width, scaled by the `effectSize` slider (0.5x-3x, default 1x). At
  // the default 1x this is exactly 1.5x the line width, for any line width,
  // because the formula is multiplicative rather than a per-effect flat
  // pixel addition that only happened to look right at one width. Every
  // effect uses this single value so the slider feels identical everywhere.
  const BASE_SCALE = 1.5;
  const baseWidth = Math.max(1, lineWidth * BASE_SCALE * effectSize);
  // Particle count grows with the actual routed path length. Larger
  // particles reserve more room so short connectors never look crowded.
  const particleCount = Math.max(
    1,
    Math.min(14, Math.round(length / (96 * Math.sqrt(effectSize)))),
  );
  const particlePeriod = 100 / particleCount;
  const dotDasharray = `0.1 ${Math.max(0.1, particlePeriod - 0.1)}`;
  // Comet's tail length scales with effectSize too (capped at 45% of the
  // gap between particles) so the whole object grows/shrinks together with
  // its width instead of only the width changing while the tail stays fixed.
  const cometLength = Math.min(particlePeriod * 0.45, 1.2 * effectSize);
  const cometDasharray = `${cometLength} ${Math.max(0.1, particlePeriod - cometLength)}`;
  const travelVelocity = TRAVEL_VELOCITY[effect];
  const baseDuration = travelVelocity
    ? Math.max(0.65, Math.min(6, length / travelVelocity))
    : (PATTERN_DURATION[effect] ?? 1.1);
  const animationDurationSeconds = baseDuration / speed;
  const animationDuration = `${animationDurationSeconds}s`;
  const neonFilter = performanceMode
    ? undefined
    : `drop-shadow(0 0 ${Math.max(2, effectSize * 2.5)}px currentColor) drop-shadow(0 0 ${Math.max(5, effectSize * 5)}px currentColor)`;
  const strongNeonFilter = performanceMode
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

  return (
    <>
      {effect === 'flow' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
          strokeLinecap="square"
          fill="none"
          strokeDasharray="14 5"
          className="animate-[edge-dash_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'binary' && (
        <>
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={Math.max(1, baseWidth * 0.4)}
            strokeOpacity={0.14}
            fill="none"
          />
          {/* Byte 10110010: two dasharrays that light up complementary bit
              slots, so a "1" pulses bright and a "0" only pulses dim —
              a high/low signal, the one shape universally read as binary
              data, instead of a single-track dash pattern that just looked
              like generic Morse-style dashes. */}
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={baseWidth * 0.7}
            strokeLinecap="square"
            strokeOpacity={0.35}
            fill="none"
            strokeDasharray="0 5 3 2 0 5 0 5 3 2 3 2 0 5 3 2"
            className="animate-[edge-binary_1.15s_linear_infinite]"
            style={{ ...animationStyle, filter: undefined }}
          />
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={baseWidth}
            strokeLinecap="square"
            fill="none"
            strokeDasharray="3 2 0 5 3 2 3 2 0 5 0 5 3 2 0 5"
            className="animate-[edge-binary_1.15s_linear_infinite]"
            style={animationStyle}
          />
        </>
      )}
      {effect === 'heartbeat' && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={baseWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="1 4 18 4"
          className="animate-[edge-wave_1.2s_linear_infinite]"
          style={animationStyle}
        />
      )}
      {effect === 'rail' && (
        <>
          <path d={d} stroke="currentColor" strokeWidth={baseWidth} strokeOpacity={0.22} fill="none" />
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={baseWidth}
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
          strokeWidth={baseWidth}
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
            strokeWidth={baseWidth}
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
            strokeWidth={baseWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray="9 91"
            className="animate-[edge-travel_1.2s_linear_infinite]"
            style={{
              ...animationStyle,
              // Mirrors the first path exactly — same duration, same delay,
              // only the direction flips — so the two objects start at
              // opposite ends, cross in the middle, and arrive together.
              // No extra delay or opacity here: either one breaks the
              // symmetry (a phase offset makes them cross off-center; a
              // dimmer second object makes them read as unequal).
              animationDirection:
                direction === 'reverse' ? 'normal' : 'reverse',
            }}
          />
        </>
      )}
    </>
  );
}
