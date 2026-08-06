'use client';

import type { EdgeDirection, EdgeEffect } from '@/lib/flowchart-types';

/**
 * Effects whose object travels the entire route use pixels/second, so the
 * object always moves at the same speed no matter how long the line is.
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
  convoy: 150,
  chase: 165,
};

/** The charging fill sweeps the whole route at this px/s. */
const CHARGING_VELOCITY = 170;

/**
 * Pattern effects tile a repeating dash texture along the whole line.
 * The arrays are the classic dasharrays (numeric so the density slider
 * can scale them); PATTERN_VELOCITY is each texture's calibrated px/s
 * (the original period ÷ the original beat), so scaling the pattern
 * denser/sparser never changes its apparent speed.
 */
export const PATTERN_DASHES: Partial<Record<EdgeEffect, number[]>> = {
  flow: [8, 12],
  dash: [6, 7],
  wave: [10, 6, 2, 6],
  traffic: [4, 6, 1, 6],
  marching: [14, 5],
  heartbeat: [1, 4, 18, 4],
  rail: [3, 5],
  // "SOS" in dots and dashes — reads instantly as a telegraph signal.
  morse: [2, 3, 2, 3, 2, 6, 8, 3, 8, 3, 8, 6, 2, 3, 2, 3, 2, 12],
  // Tiny dots packed tight — a slow trail of ants.
  ants: [0.5, 4.5],
  // Stationary checkpoint marks; they pulse in place instead of moving.
  blink: [2.5, 27.5],
};

export const PATTERN_VELOCITY: Partial<Record<EdgeEffect, number>> = {
  flow: 20 / 0.95,
  dash: 13 / 0.75,
  wave: 24 / 1.1,
  traffic: 17 / 0.82,
  marching: 20 / 1.05,
  binary: 40 / 1.15,
  heartbeat: 24 / 1.25,
  rail: 13 / 0.85,
  morse: 26,
  ants: 9,
  // Blink doesn't translate — this only sets its pulse beat (period/velocity).
  blink: 25,
};

/** Byte 10110010 — complementary "1" (bright) and "0" (dim) bit slots. */
const BINARY_HIGH = [3, 2, 0, 5, 3, 2, 3, 2, 0, 5, 0, 5, 3, 2, 0, 5];
const BINARY_LOW = [0, 5, 3, 2, 0, 5, 0, 5, 3, 2, 3, 2, 0, 5, 3, 2];

interface EdgeEffectLayerProps {
  /** SVG path `d` the effect travels along — the exact same path drawn for the line itself. */
  d: string;
  effect: EdgeEffect;
  direction: EdgeDirection;
  /** Routed path length in px — lets the laser run a single beam per
   *  pass by stretching its dash period across the whole route. */
  length?: number;
  lineWidth: number;
  effectSize: number;
  speed: number;
  /** Exact number of objects travelling the line (1–8). Undefined keeps
   *  the automatic spacing (one object per 100px of route). Only the
   *  travelling-object effects listed in TRAVEL_VELOCITY honour it —
   *  pattern effects tile the whole line and have no object count. */
  count?: number;
  /** Mark density for pattern effects, 0.5×–2× (default 1). Higher =
   *  more, smaller marks per length at the same apparent speed. */
  density?: number;
  /** Neon glow strength, 0–3× (default 1). 0 removes the halo. */
  glow?: number;
  /** Phase offset as a fraction of one animation cycle (0–1). */
  phase?: number;
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
        <EdgeEffectLayerSingle {...props} direction='forward' />
        <EdgeEffectLayerSingle {...props} direction='reverse' />
      </>
    );
  }
  return <EdgeEffectLayerSingle {...props} />;
}

function EdgeEffectLayerSingle({ d, effect, direction, length = 0, lineWidth, effectSize, speed, count, density, glow, phase, paused = false, performanceMode = false, isDrawing = false, drawDuration = '0ms' }: EdgeEffectLayerProps) {
  // Every effect's traveling object — including backdrop/track layers and
  // secondary passes — is sized as the same fixed multiple of the line's
  // own width, scaled by the `effectSize` slider (0.5x-3x, default 1x). At
  // the default 1x this is exactly 1.5x the line width, for any line width,
  // because the formula is multiplicative rather than a per-effect flat
  // pixel addition that only happened to look right at one width. Every
  // effect uses this single value so the slider feels identical everywhere.
  const BASE_SCALE = 1.5;
  const baseWidth = Math.max(1, lineWidth * BASE_SCALE * effectSize);
  // Travelling objects have a FIXED pixel length — scaled only by the
  // `effectSize` slider — independent of the line's length, packed into
  // a fixed dash period. The `edge-travel` keyframes shift exactly one
  // period per loop (seamless), and duration = period / velocity keeps
  // the px-per-second speed constant across short and long connectors.
  // With an explicit `count`, the dash period becomes length/count so
  // exactly N objects ride the route, evenly spaced, whatever its length.
  // Without it, the classic fixed 100px period applies (auto spacing).
  const objectCount = count !== undefined && length > 0 ? Math.max(1, Math.min(8, Math.round(count))) : undefined;
  const PERIOD = objectCount ? Math.max(4, length / objectCount) : 100;
  const objectLength = (base: number) => Math.max(0.5, Math.min(PERIOD - 0.5, base * effectSize));
  const objectDash = (len: number) => `${len} ${Math.max(0.5, PERIOD - len)}`;
  const pulseDash = objectDash(objectLength(16));
  const glowDash = objectDash(objectLength(32));
  const scannerDash = objectDash(objectLength(8));
  // The laser shows exactly ONE beam per run: its dash period stretches
  // to the full path length so the pattern never repeats mid-line, and the
  // beam only re-enters once it has fully exited at the destination. The
  // beam itself keeps its fixed ~130px length (scaled by the size slider).
  // `edge-travel-long` shifts by this period via the `--edge-period` CSS
  // variable, keeping the loop seamless and the px-per-second speed constant.
  const LASER_PERIOD = 200;
  const laserLength = Math.max(1, Math.min(LASER_PERIOD - 4, 130 * effectSize));
  // With an explicit count, N beams share the route; otherwise one beam
  // spans the whole path as before.
  const laserPeriod = objectCount ? Math.max(laserLength + 4, Math.ceil(length / objectCount)) : Math.max(LASER_PERIOD, Math.ceil(length));
  const laserDash = `${laserLength} ${Math.max(0.5, laserPeriod - laserLength)}`;
  const meteorDash = objectDash(objectLength(2));
  const fadeDash = objectDash(objectLength(55));
  const bidirectionalDash = objectDash(objectLength(9));
  // Comet's tail grows with the size slider together with its width.
  const cometDash = objectDash(objectLength(20));
  // Convoy: three vehicles bumper-to-bumper, then open road until the
  // next group. The trio + gaps must fit the period, so each piece is
  // clamped against the space the previous ones left over.
  const convoyUnit = Math.max(0.5, Math.min((PERIOD - 2.5) / 3, 8 * effectSize));
  const convoyGap = Math.max(0.5, Math.min((PERIOD - 3 * convoyUnit - 0.5) / 2, 3 * effectSize));
  const convoyDash = `${convoyUnit} ${convoyGap} ${convoyUnit} ${convoyGap} ${convoyUnit} ${Math.max(0.5, PERIOD - 3 * convoyUnit - 2 * convoyGap)}`;
  // Chase: a lead object and a faster pursuer on the same route.
  const chaseLeadDash = objectDash(objectLength(12));
  const chasePursuerDash = objectDash(objectLength(6));
  // Charging: the classic SVG draw trick — dasharray [L, L] and a full-
  // period offset sweep fills the route end-to-end once per cycle.
  const chargeLength = Math.max(24, Math.ceil(length) || 240);
  // Round line caps turn a near-zero dash into a dot whose diameter is
  // the stroke width, so the spacing alone needs a period here.
  const dotDash = `0.1 ${PERIOD - 0.1}`;
  // Pattern effects scale their whole dash texture by the density
  // slider: higher density = smaller marks, tighter spacing. The
  // texture's px/s velocity is fixed per effect, so density never
  // changes how fast the pattern appears to move.
  const densityScale = 1 / Math.max(0.5, Math.min(2, density ?? 1));
  const scaleDashes = (values: number[]) => values.map((value) => Math.round(value * densityScale * 100) / 100);
  const patternBase = effect === 'binary' ? BINARY_HIGH : PATTERN_DASHES[effect];
  const patternPeriod = patternBase ? patternBase.reduce((total, value) => total + value, 0) * densityScale : 0;
  const patternDash = patternBase ? scaleDashes(patternBase).join(' ') : undefined;
  const binaryLowDash = effect === 'binary' ? scaleDashes(BINARY_LOW).join(' ') : undefined;
  const travelVelocity = TRAVEL_VELOCITY[effect];
  const patternVelocity = PATTERN_VELOCITY[effect];
  const travelPeriod = effect === 'laser' ? laserPeriod : PERIOD;
  const baseDuration = travelVelocity ? travelPeriod / travelVelocity : patternVelocity ? patternPeriod / patternVelocity : effect === 'charging' ? chargeLength / CHARGING_VELOCITY : 1.1;
  const animationDurationSeconds = baseDuration / speed;
  const animationDuration = `${animationDurationSeconds}s`;
  // One shared neon glow for EVERY effect — the lit halo around each
  // travelling object must look identical from effect to effect, so no
  // effect gets a stronger variant. White by default (independent of the
  // line/effect colour), scaled by the size slider and the glow slider
  // (0 turns the halo off entirely).
  const glowLevel = Math.max(0, Math.min(3, glow ?? 1));
  const neonFilter =
    performanceMode || glowLevel === 0 ? undefined : `drop-shadow(0 0 ${Math.max(3, effectSize * 3) * glowLevel}px #ffffff) drop-shadow(0 0 ${Math.max(7, effectSize * 6) * glowLevel}px rgba(255,255,255,0.6))`;
  // A negative delay starts the loop mid-cycle — the standard CSS idiom
  // for a phase offset. During the execution draw-in the delay slot is
  // needed to hold the effect back, so the phase applies afterwards only.
  const phaseFraction = Math.max(0, Math.min(1, phase ?? 0));
  const phaseDelay = phaseFraction > 0 ? `${-(phaseFraction * animationDurationSeconds).toFixed(4)}s` : undefined;
  const animationStyle = {
    animationDuration,
    animationDelay: isDrawing ? drawDuration : phaseDelay,
    animationPlayState: paused ? 'paused' : 'running',
    animationDirection: direction === 'reverse' ? 'reverse' : 'normal',
    animationFillMode: isDrawing ? 'backwards' : undefined,
    filter: neonFilter,
  } as const;
  // Travelling effects shift exactly one dash period per loop. The fixed
  // 100px period maps to the classic `edge-travel` keyframes; a custom
  // period (explicit object count) rides `edge-travel-long`, which reads
  // the period from the `--edge-period` CSS variable instead.
  const travelClass = objectCount ? 'animate-[edge-travel-long_1.2s_linear_infinite]' : 'animate-[edge-travel_1.2s_linear_infinite]';
  const travelStyle = (objectCount ? { ...animationStyle, '--edge-period': `-${PERIOD}px` } : animationStyle) as React.CSSProperties;
  // Pattern textures shift exactly one (density-scaled) period per loop
  // through the same `--edge-period` mechanism, so any density stays
  // seamless — including patterns whose period never matched the old
  // fixed keyframes exactly (marching, heartbeat, rail).
  const patternClass = 'animate-[edge-travel-long_1.2s_linear_infinite]';
  const patternStyle = { ...animationStyle, '--edge-period': `-${patternPeriod}px` } as React.CSSProperties;

  return (
    <>
      {effect === 'flow' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'dash' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'pulse' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={pulseDash} className={travelClass} style={travelStyle} />}
      {effect === 'glow' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={glowDash} className={travelClass} style={travelStyle} />}
      {effect === 'comet' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={cometDash} className={travelClass} style={travelStyle} />}
      {effect === 'dots' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={dotDash} className={travelClass} style={travelStyle} />}
      {effect === 'wave' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'scanner' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={scannerDash} className={travelClass} style={travelStyle} />}
      {effect === 'traffic' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'laser' && (
        <path
          d={d}
          stroke='currentColor'
          strokeWidth={baseWidth}
          strokeLinecap='round'
          fill='none'
          strokeDasharray={laserDash}
          className='animate-[edge-travel-long_1.2s_linear_infinite]'
          style={{ ...animationStyle, '--edge-period': `-${laserPeriod}px` } as React.CSSProperties}
        />
      )}
      {effect === 'meteor' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={meteorDash} className={travelClass} style={travelStyle} />}
      {effect === 'spark' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={dotDash} className={travelClass} style={travelStyle} />}
      {effect === 'marching' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='square' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'binary' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={Math.max(1, baseWidth * 0.4)} strokeOpacity={0.14} fill='none' />
          {/* Byte 10110010: two dasharrays that light up complementary bit
              slots, so a "1" pulses bright and a "0" only pulses dim —
              a high/low signal, the one shape universally read as binary
              data, instead of a single-track dash pattern that just looked
              like generic Morse-style dashes. */}
          <path
            d={d}
            stroke='currentColor'
            strokeWidth={baseWidth * 0.7}
            strokeLinecap='square'
            strokeOpacity={0.35}
            fill='none'
            strokeDasharray={binaryLowDash}
            className={patternClass}
            style={{ ...patternStyle, filter: undefined }}
          />
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='square' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />
        </>
      )}
      {effect === 'heartbeat' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'rail' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeOpacity={0.22} fill='none' />
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='butt' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />
        </>
      )}
      {effect === 'fade' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={fadeDash} className={travelClass} style={{ ...travelStyle, opacity: 0.78 }} />}
      {effect === 'convoy' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={convoyDash} className={travelClass} style={travelStyle} />}
      {effect === 'chase' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={chaseLeadDash} className={travelClass} style={travelStyle} />
          {/* The pursuer runs the same loop ~38% faster, so it laps the
              lead periodically — that speed difference IS the effect. */}
          <path
            d={d}
            stroke='currentColor'
            strokeWidth={baseWidth * 0.8}
            strokeLinecap='round'
            fill='none'
            strokeDasharray={chasePursuerDash}
            className={travelClass}
            style={{ ...travelStyle, animationDuration: `${animationDurationSeconds * 0.62}s` }}
          />
        </>
      )}
      {effect === 'charging' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeOpacity={0.16} fill='none' />
          {/* Keyframes run 0 → ±L; played in reverse that is ±L → 0, which
              grows the lit segment from the source (+L) or, for reversed
              lines, from the target (−L). */}
          <path
            d={d}
            stroke='currentColor'
            strokeWidth={baseWidth}
            strokeLinecap='round'
            fill='none'
            strokeDasharray={`${chargeLength} ${chargeLength}`}
            className='animate-[edge-travel-long_1.2s_linear_infinite]'
            style={{ ...animationStyle, '--edge-period': `${direction === 'reverse' ? -chargeLength : chargeLength}px`, animationDirection: 'reverse', animationTimingFunction: 'ease-in-out' } as React.CSSProperties}
          />
        </>
      )}
      {effect === 'morse' && <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'ants' && <path d={d} stroke='currentColor' strokeWidth={Math.max(1, baseWidth * 0.6)} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className={patternClass} style={patternStyle} />}
      {effect === 'blink' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={Math.max(1, baseWidth * 0.4)} strokeOpacity={0.14} fill='none' />
          {/* Static marks — only their opacity pulses (edge-pulse), so they
              read as checkpoints lighting up rather than moving traffic. */}
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={patternDash} className='animate-[edge-pulse_1.2s_ease-in-out_infinite]' style={animationStyle} />
        </>
      )}
      {effect === 'bidirectional' && (
        <>
          <path d={d} stroke='currentColor' strokeWidth={baseWidth} strokeLinecap='round' fill='none' strokeDasharray={bidirectionalDash} className={travelClass} style={travelStyle} />
          <path
            d={d}
            stroke='currentColor'
            strokeWidth={baseWidth}
            strokeLinecap='round'
            fill='none'
            strokeDasharray={bidirectionalDash}
            className={travelClass}
            style={{
              ...travelStyle,
              // Mirrors the first path exactly — same duration, same delay,
              // only the direction flips — so the two objects start at
              // opposite ends, cross in the middle, and arrive together.
              // No extra delay or opacity here: either one breaks the
              // symmetry (a phase offset makes them cross off-center; a
              // dimmer second object makes them read as unequal).
              animationDirection: direction === 'reverse' ? 'normal' : 'reverse',
            }}
          />
        </>
      )}
    </>
  );
}
