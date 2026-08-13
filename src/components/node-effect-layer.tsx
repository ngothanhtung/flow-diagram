'use client';

// Node animations, the counterpart to `edge-effect-layer.tsx`.
//
// Everything here is opt-in: `effect: 'none'` (the default for every node)
// produces no class, no extra element and no cost. That is the whole point
// of the field — a block, frame or text object is static until the user
// picks an effect, exactly like a line.
//
// Two families, mirroring the edge split:
//
//   motion      the node itself animates (float, breathe, shake, wobble,
//               bounce, blink) — a CSS class on a wrapper <g>.
//   decoration  an extra layer is painted around or over the silhouette
//               (glow, pulse, ripple, trace, sheen) — <NodeEffectLayer>.
//
// Both read the same three knobs so "speed" and "intensity" mean the same
// thing whichever effect is chosen.

import type { NodeEffect } from '@/lib/flowchart-types';

/** Base cycle length per effect, in seconds, before `effectSpeed`. */
const DURATION: Record<Exclude<NodeEffect, 'none'>, number> = {
  float: 3.2,
  breathe: 3,
  shake: 0.9,
  wobble: 2.4,
  bounce: 2.2,
  blink: 1.8,
  glow: 0,
  pulse: 2.2,
  ripple: 2.6,
  trace: 1.6,
  sheen: 3.4,
};

const MOTION_EFFECTS = new Set<NodeEffect>(['float', 'breathe', 'shake', 'wobble', 'bounce', 'blink']);
const DECORATION_EFFECTS = new Set<NodeEffect>(['glow', 'pulse', 'ripple', 'trace', 'sheen']);

export function isMotionEffect(effect: NodeEffect) {
  return MOTION_EFFECTS.has(effect);
}

export function isDecorationEffect(effect: NodeEffect) {
  return DECORATION_EFFECTS.has(effect);
}

/** Speed and intensity, clamped once so every caller agrees on the range. */
export function resolveEffectKnobs(speed: number | undefined, intensity: number | undefined) {
  return {
    speed: Math.max(0.25, Math.min(3, speed ?? 1)),
    intensity: Math.max(0.25, Math.min(3, intensity ?? 1)),
  };
}

/**
 * Style for the wrapper `<g>` that carries a motion effect. Returns
 * undefined for `none` and for the decoration family, so the wrapper stays
 * a plain group and nothing is animated.
 *
 * `transform-box: fill-box` makes scale and rotate pivot on the node's own
 * centre rather than the canvas origin.
 */
export function nodeMotionStyle(effect: NodeEffect | undefined, speed: number, intensity: number, paused = false): React.CSSProperties | undefined {
  if (!effect || !MOTION_EFFECTS.has(effect)) return undefined;
  return {
    animationName: `node-fx-${effect}`,
    animationDuration: `${(DURATION[effect as Exclude<NodeEffect, 'none'>] / speed).toFixed(3)}s`,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
    // Static run mode freezes every animation on the canvas, including a
    // node's own opt-in motion — paused rather than unmounted, so the
    // node still renders at whatever pose the animation was stopped at.
    animationPlayState: paused ? 'paused' : 'running',
    transformBox: 'fill-box',
    transformOrigin: 'center',
    // The keyframes multiply their amplitude by this, so one keyframe
    // set covers every intensity instead of one per level.
    '--node-fx-intensity': intensity,
  } as React.CSSProperties;
}

interface NodeEffectLayerProps {
  /** The node's silhouette, shared with the body so they line up exactly. */
  d: string;
  transform?: string;
  effect: NodeEffect | undefined;
  /** Effect colour, already resolved (falls back to the node foreground). */
  color: string;
  speed: number;
  intensity: number;
  /** Node box, needed by the effects that sweep or ring the whole card. */
  width: number;
  height: number;
  /** Id-safe suffix for the clip path the sheen needs. */
  clipId: string;
  /** Dense diagrams drop the blur, never the effect itself. */
  performanceMode?: boolean;
  /** Static run mode: freeze the animation, keep the decoration painted. */
  paused?: boolean;
}

/**
 * The decoration family. Renders nothing for `none` or for a motion
 * effect, so `FlowNodeCard` can mount it unconditionally.
 */
export function NodeEffectLayer({ d, transform, effect, color, speed, intensity, width, height, clipId, performanceMode = false, paused = false }: NodeEffectLayerProps) {
  if (!effect || !DECORATION_EFFECTS.has(effect)) return null;

  const duration = `${(DURATION[effect as Exclude<NodeEffect, 'none'>] / speed).toFixed(3)}s`;
  const halo = performanceMode ? `drop-shadow(0 0 ${5 * intensity}px ${color})` : `drop-shadow(0 0 ${4 * intensity}px ${color}) drop-shadow(0 0 ${13 * intensity}px ${color}80)`;

  if (effect === 'glow' || effect === 'pulse') {
    // A steady halo and a breathing one are the same ring; only the
    // animation differs, so they share a branch.
    return (
      <g transform={transform} pointerEvents='none'>
        <path
          d={d}
          fill='none'
          stroke={color}
          strokeWidth={2 + intensity}
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
          opacity={effect === 'glow' ? Math.min(1, 0.5 * intensity) : undefined}
          style={{
            filter: halo,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            ...(effect === 'pulse'
              ? {
                  animationName: 'node-fx-pulse',
                  animationDuration: duration,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                  animationPlayState: paused ? 'paused' : 'running',
                }
              : {}),
          }}
        />
      </g>
    );
  }

  if (effect === 'ripple') {
    // Two rings a half-cycle apart read as a continuous emanation
    // without needing a third element.
    return (
      <g transform={transform} pointerEvents='none'>
        {[0, 0.5].map((offset) => (
          <path
            key={offset}
            d={d}
            fill='none'
            stroke={color}
            strokeWidth={1.5 + intensity}
            strokeLinejoin='round'
            vectorEffect='non-scaling-stroke'
            style={{
              filter: performanceMode ? undefined : halo,
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animationName: 'node-fx-ripple',
              animationDuration: duration,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-out',
              animationDelay: `-${(DURATION.ripple / speed) * offset}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        ))}
      </g>
    );
  }

  if (effect === 'trace') {
    return (
      <g transform={transform} pointerEvents='none'>
        <path
          d={d}
          fill='none'
          stroke={color}
          strokeWidth={1.5 + intensity}
          strokeLinejoin='round'
          strokeLinecap='round'
          strokeDasharray='16 32'
          vectorEffect='non-scaling-stroke'
          style={{
            filter: performanceMode ? undefined : halo,
            animationName: 'node-fx-trace',
            animationDuration: duration,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </g>
    );
  }

  // sheen — a band of light sweeping across the body, clipped to the
  // silhouette so it never spills past a rounded or angled outline.
  const gradientId = `${clipId}-sheen`;
  const bandWidth = Math.max(24, width * 0.34);
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={d} transform={transform} />
        </clipPath>
        <linearGradient id={gradientId} x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor={color} stopOpacity={0} />
          <stop offset='50%' stopColor={color} stopOpacity={Math.min(0.75, 0.28 * intensity)} />
          <stop offset='100%' stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`} pointerEvents='none'>
        <rect
          x={-width / 2 - bandWidth}
          y={-height / 2}
          width={bandWidth}
          height={height}
          fill={`url(#${gradientId})`}
          style={
            {
              animationName: 'node-fx-sheen',
              animationDuration: duration,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
              animationPlayState: paused ? 'paused' : 'running',
              '--node-fx-sweep': `${width + bandWidth * 2}px`,
            } as React.CSSProperties
          }
        />
      </g>
    </>
  );
}
