'use client';

// Line-vocabulary field primitives, shared by the per-line inspector
// (`EdgeInspector`) and the document-wide style palette
// (`EdgeStylePaletteDialog`). They live here rather than in either of
// those files because both need them and importing one from the other
// would close a cycle.

import { Activity, Ban, BatteryCharging, Bug, CircleDot, GitCompareArrows, HeartPulse, Lightbulb, Rabbit, Radio, ScanLine, Sparkles, Truck, Waves, Zap, type LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import { edgeLineCap, edgeLineDash } from '@/lib/edge-style';
import type { EdgeEffect, EdgeLineStyle, EdgeMarker, EdgeRouting } from '@/lib/flowchart-types';
import { EdgeMarkerSymbol } from './edge-marker';

export const EDGE_EFFECTS: {
  value: EdgeEffect;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  { value: 'none', label: 'None', description: 'No animation — a static line', Icon: Ban },
  { value: 'flow', label: 'Flow', description: 'Continuous data stream', Icon: Waves },
  { value: 'pulse', label: 'Signal', description: 'Single traveling pulse', Icon: Activity },
  { value: 'glow', label: 'Beam', description: 'Traveling energy beam', Icon: Sparkles },
  { value: 'comet', label: 'Comet', description: 'Fast particle traffic', Icon: Zap },
  { value: 'dots', label: 'Dots', description: 'Evenly spaced moving dots', Icon: CircleDot },
  { value: 'scanner', label: 'Scanner', description: 'Focused scanning packet', Icon: ScanLine },
  { value: 'bidirectional', label: 'Two-way', description: 'Traffic in both directions', Icon: GitCompareArrows },
  { value: 'laser', label: 'Laser', description: 'Long luminous energy sweep', Icon: Zap },
  { value: 'meteor', label: 'Meteor', description: 'Single high-energy moving point', Icon: Sparkles },
  { value: 'heartbeat', label: 'Heartbeat', description: 'P-QRS-T waveform, like a real EKG', Icon: HeartPulse },
  { value: 'rail', label: 'Rail', description: 'Framed transport channel', Icon: Radio },
  { value: 'fade', label: 'Energy Fade', description: 'Long fading data envelope', Icon: Waves },
  { value: 'convoy', label: 'Convoy', description: 'Grouped batches with open road between', Icon: Truck },
  { value: 'chase', label: 'Chase', description: 'A pursuer laps the lead object', Icon: Rabbit },
  { value: 'charging', label: 'Charging', description: 'Line fills end-to-end, then resets', Icon: BatteryCharging },
  { value: 'morse', label: 'Morse', description: 'Dot-dash telegraph signal (SOS)', Icon: Radio },
  { value: 'ants', label: 'Ant Trail', description: 'Slow trail of tiny marching dots', Icon: Bug },
  { value: 'blink', label: 'Blink', description: 'Stationary checkpoints pulsing in place', Icon: Lightbulb },
];

export const ROUTING_OPTIONS: Array<{ value: EdgeRouting; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'smooth-step', label: 'Smooth step' },
  { value: 'orthogonal', label: 'Orthogonal' },
  { value: 'curved', label: 'Bezier curve' },
];

export const LINE_STYLE_OPTIONS: Array<{ value: EdgeLineStyle; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export const MARKERS: Array<{ value: EdgeMarker; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'open-arrow', label: 'Open arrow' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'tee', label: 'Tee' },
  { value: 'cross', label: 'Cross' },
  { value: 'circle-cross', label: 'Circle cross' },
  { value: 'arrow-both', label: 'Both ways' },
  { value: 'arrow-bar', label: 'Arrow bar' },
  { value: 'bar', label: 'Bar' },
  { value: 'crow-one', label: 'ERD · one' },
  { value: 'crow-many', label: 'ERD · many' },
  { value: 'crow-one-many', label: 'ERD · one or many' },
  { value: 'crow-zero-one', label: 'ERD · zero or one' },
  { value: 'crow-zero-many', label: 'ERD · zero or many' },
];

export function MarkerPicker({ label, value, onChange }: { label: string; value: EdgeMarker; onChange: (marker: EdgeMarker) => void }) {
  const selected = MARKERS.find((m) => m.value === value) ?? MARKERS[0];
  return (
    <div className='mt-3'>
      <Label className='text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>{label}</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as EdgeMarker);
        }}
      >
        <SelectTrigger className='mt-1.5 h-auto w-full gap-2.5 border-border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'>
          <span className='grid h-7 w-9 shrink-0 place-items-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
            <MarkerSwatch marker={value} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-xs font-semibold'>{selected.label}</span>
          </span>
        </SelectTrigger>
        <SelectContent className='max-h-72 min-w-65 border-cyan-400/25 bg-popover p-1.5'>
          <SelectGroup>
            <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground'>{label}</SelectLabel>
            {MARKERS.map((marker) => (
              <SelectItem key={marker.value} value={marker.value} className='gap-2.5 px-2.5 py-2 pr-9'>
                <span className='grid h-7 w-9 shrink-0 place-items-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
                  <MarkerSwatch marker={marker.value} />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-[11px] font-semibold'>{marker.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * A short line stub feeding into the marker, so the swatch reads as
 * "what the end of a real line looks like" instead of an isolated glyph.
 */
export function MarkerSwatch({ marker }: { marker: EdgeMarker }) {
  return (
    <svg width={28} height={20} viewBox='-30 -12 34 24' className='text-cyan-700 dark:text-cyan-200'>
      <line x1={-28} y1={0} x2={0} y2={0} stroke='currentColor' strokeWidth={1.5} strokeOpacity={0.7} />
      <EdgeMarkerSymbol marker={marker} />
    </svg>
  );
}

/**
 * A whole line at a glance: colour, width, stroke pattern and both end
 * markers, drawn through the same `edgeLineDash` the canvas uses so a
 * sample can't drift from the real thing. Static on purpose — the
 * animated effect is named in words beside it rather than played here,
 * because a row of looping previews is unreadable at list density.
 */
export function EdgeStyleSample({ color, width = 2.5, lineStyle, startMarker = 'none', endMarker = 'none', length = 96 }: { color: string; width?: number; lineStyle?: EdgeLineStyle; startMarker?: EdgeMarker; endMarker?: EdgeMarker; length?: number }) {
  return (
    <svg width={length} height={16} viewBox={`0 -8 ${length} 16`} aria-hidden='true' style={{ color }} className='shrink-0 overflow-visible'>
      <line x1={0} y1={0} x2={length} y2={0} stroke='currentColor' strokeWidth={width} strokeDasharray={edgeLineDash(lineStyle, width)} strokeLinecap={edgeLineCap(lineStyle)} />
      {startMarker !== 'none' && (
        // The marker file's convention is "tip at the origin, body
        // running towards −x", so the start end is turned to face back
        // down the line.
        <g transform='translate(0 0) rotate(180)'>
          <EdgeMarkerSymbol marker={startMarker} />
        </g>
      )}
      {endMarker !== 'none' && (
        <g transform={`translate(${length} 0)`}>
          <EdgeMarkerSymbol marker={endMarker} />
        </g>
      )}
    </svg>
  );
}
