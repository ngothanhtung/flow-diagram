'use client';

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  Gauge,
  GitCompareArrows,
  Minus,
  Radio,
  Route,
  ScanLine,
  Sparkles,
  Trash2,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type {
  EdgeDirection,
  EdgeEffect,
  EdgeMarker,
  EdgeRouting,
  FlowEdge,
} from '@/lib/flowchart-types';

interface EdgeInspectorProps {
  edge: FlowEdge;
  sourceTitle: string;
  targetTitle: string;
  fallbackColor: `#${string}`;
  onUpdate: (
    id: string,
    patch: Partial<Omit<FlowEdge, 'id' | 'from' | 'to'>>,
  ) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const EFFECTS: {
  value: EdgeEffect;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  { value: 'flow', label: 'Flow', description: 'Continuous data stream', Icon: Waves },
  { value: 'dash', label: 'Packets', description: 'Moving packet stream', Icon: Minus },
  { value: 'pulse', label: 'Signal', description: 'Single traveling pulse', Icon: Activity },
  { value: 'glow', label: 'Beam', description: 'Traveling energy beam', Icon: Sparkles },
  { value: 'comet', label: 'Comet', description: 'Fast particle traffic', Icon: Zap },
  { value: 'dots', label: 'Dots', description: 'Evenly spaced moving dots', Icon: CircleDot },
  { value: 'wave', label: 'Wave', description: 'Mixed rhythm data wave', Icon: Radio },
  { value: 'scanner', label: 'Scanner', description: 'Focused scanning packet', Icon: ScanLine },
  { value: 'traffic', label: 'Traffic', description: 'Dense service traffic', Icon: Route },
  { value: 'bidirectional', label: 'Two-way', description: 'Traffic in both directions', Icon: GitCompareArrows },
  { value: 'laser', label: 'Laser', description: 'Long luminous energy sweep', Icon: Zap },
  { value: 'meteor', label: 'Meteor', description: 'Single high-energy moving point', Icon: Sparkles },
  { value: 'spark', label: 'Spark', description: 'Dense glowing micro-particles', Icon: CircleDot },
  { value: 'marching', label: 'Marching', description: 'Structured marching segments', Icon: Minus },
  { value: 'binary', label: 'Binary', description: 'Short and long digital packets', Icon: Route },
  { value: 'heartbeat', label: 'Heartbeat', description: 'Rhythmic telemetry signal', Icon: Activity },
  { value: 'rail', label: 'Rail', description: 'Framed transport channel', Icon: Radio },
  { value: 'fade', label: 'Energy Fade', description: 'Long fading data envelope', Icon: Waves },
];

const MARKERS: Array<{ value: EdgeMarker; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'open-arrow', label: 'Open arrow' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
];

export function EdgeInspector({
  edge,
  sourceTitle,
  targetTitle,
  fallbackColor,
  onUpdate,
  onDelete,
  onClose,
}: EdgeInspectorProps) {
  const [label, setLabel] = useState(edge.label ?? '');
  const [effectMenuOpen, setEffectMenuOpen] = useState(false);
  const effect = edge.effect ?? 'flow';
  const direction = edge.direction ?? 'forward';
  const color = edge.color ?? fallbackColor;
  const width = edge.width ?? 2.5;
  const speed = edge.animationSpeed ?? 1;
  const formattedSpeed = speed
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  const effectSize = edge.effectSize ?? 1;
  const selectedEffect = EFFECTS.find((item) => item.value === effect) ?? EFFECTS[0];
  const SelectedEffectIcon = selectedEffect.Icon;

  return (
    <div className="rounded-xl bg-zinc-900/80 p-4 ring-1 ring-cyan-400/35">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Line inspector</h2>
          <p className="mt-1 max-w-[230px] truncate text-[10px] text-zinc-500">
            {sourceTitle} → {targetTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-zinc-500 hover:text-zinc-200"
        >
          close
        </button>
      </div>

      <p className="mt-3 rounded-lg bg-cyan-400/8 px-2.5 py-2 text-[9px] leading-relaxed text-cyan-100/70 ring-1 ring-cyan-400/18">
        Drag handle A or B on the canvas, then drop it onto any highlighted node port.
      </p>

      <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
        Label
      </label>
      <input
        value={label}
        placeholder="Add a line label…"
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() =>
          onUpdate(edge.id, { label: label.trim() || undefined })
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="mt-1.5 w-full rounded-md bg-zinc-800/80 px-2.5 py-2 text-xs text-zinc-100 ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-cyan-400/60"
      />

      <MarkerPicker
        label="Line start"
        value={edge.startMarker ?? 'none'}
        onChange={(startMarker) => onUpdate(edge.id, { startMarker })}
      />
      <MarkerPicker
        label="Line end"
        value={edge.endMarker ?? 'arrow'}
        onChange={(endMarker) => onUpdate(edge.id, { endMarker })}
      />

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
          Routing
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1.5 ring-1 ring-white/10">
          {([
            { value: 'straight', label: 'Straight' },
            { value: 'smooth-step', label: 'Smooth step' },
            { value: 'orthogonal', label: 'Orthogonal' },
            { value: 'curved', label: 'Bezier curve' },
          ] as const).map((option) => {
            const active = (edge.routing ?? 'orthogonal') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onUpdate(edge.id, { routing: option.value as EdgeRouting })
                }
                aria-pressed={active}
                className={[
                  'h-8 rounded-lg text-[10px] font-semibold transition',
                  active
                    ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/55'
                    : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-200',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
        Effect
      </p>
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setEffectMenuOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={effectMenuOpen}
          className="flex w-full items-center gap-2.5 rounded-lg bg-zinc-800 px-3 py-2.5 text-left text-zinc-100 ring-1 ring-white/10 transition hover:bg-zinc-700/80 hover:ring-white/20 focus:outline-none focus:ring-cyan-400/60"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-black/20 text-cyan-200">
            <SelectedEffectIcon size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">{selectedEffect.label}</span>
            <span className="block truncate text-[9px] text-zinc-500">
              {selectedEffect.description}
            </span>
          </span>
          <ChevronDown
            size={15}
            className={[
              'shrink-0 text-zinc-500 transition-transform',
              effectMenuOpen ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>

        {effectMenuOpen && (
          <div
            role="listbox"
            aria-label="Line effect"
            className="mt-1.5 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-zinc-950 p-1.5 ring-1 ring-cyan-400/30 shadow-[0_18px_50px_rgba(0,0,0,.45)]"
          >
            {EFFECTS.map((item) => {
              const Icon = item.Icon;
              const active = item.value === effect;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onUpdate(edge.id, { effect: item.value });
                    setEffectMenuOpen(false);
                  }}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                    active
                      ? 'bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/40'
                      : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-100',
                  ].join(' ')}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-black/25">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold">{item.label}</span>
                    <span className="block truncate text-[9px] text-zinc-600">
                      {item.description}
                    </span>
                  </span>
                  {active && <Check size={14} className="shrink-0 text-cyan-300" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {effect !== 'bidirectional' ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1.5 ring-1 ring-white/10">
          {([
            { value: 'forward', label: 'A → B', Icon: ArrowRight },
            { value: 'reverse', label: 'B → A', Icon: ArrowLeft },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onUpdate(edge.id, { direction: option.value as EdgeDirection })
              }
              aria-pressed={direction === option.value}
              className={[
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition',
                direction === option.value
                  ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/60'
                  : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-200',
              ].join(' ')}
            >
              <option.Icon size={14} />
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 rounded-lg bg-cyan-500/8 px-2.5 py-2 text-[10px] text-cyan-200/70 ring-1 ring-cyan-400/15">
          Two-way runs simultaneously from A → B and B → A.
        </p>
      )}
      <p className="mt-1.5 truncate text-[9px] text-zinc-600">
        A: {sourceTitle} · B: {targetTitle}
      </p>
      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-cyan-500/8 px-2.5 py-2.5 text-cyan-100 ring-1 ring-cyan-400/20">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/20">
          <SelectedEffectIcon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold">{selectedEffect.label}</span>
          <span className="block truncate text-[9px] text-zinc-500">{selectedEffect.description}</span>
        </span>
        <EffectPreview effect={effect} active direction={direction} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="rounded-md bg-white/5 p-2 ring-1 ring-white/10">
          <span className="block text-[9px] text-zinc-500">Line color</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(event) =>
                onUpdate(edge.id, {
                  color: event.target.value as `#${string}`,
                })
              }
              className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="font-mono text-[9px] uppercase text-zinc-300">
              {color}
            </span>
          </span>
        </label>
        <label className="rounded-md bg-white/5 p-2 ring-1 ring-white/10">
          <span className="block text-[9px] text-zinc-500">Width</span>
          <input
            type="number"
            min={1}
            max={6}
            step={0.5}
            value={width}
            onChange={(event) =>
              onUpdate(edge.id, { width: event.target.valueAsNumber })
            }
            className="mt-1 w-full bg-transparent font-mono text-xs text-zinc-200 outline-none"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="flex items-center justify-between text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <CircleDot size={11} /> Effect object size
          </span>
          <span className="font-mono text-zinc-300">{effectSize.toFixed(1)}×</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={effectSize}
          onChange={(event) =>
            onUpdate(edge.id, { effectSize: event.target.valueAsNumber })
          }
          className="mt-1.5 h-1.5 w-full cursor-pointer accent-violet-400"
        />
        <span className="mt-1 flex justify-between text-[8px] uppercase tracking-wider text-zinc-700">
          <span>Small</span><span>Large</span>
        </span>
        <span className="mt-1 block text-[9px] leading-relaxed text-zinc-600">
          Object count adapts automatically to the routed line length.
        </span>
      </label>

      <label className="mt-3 block">
        <span className="flex items-center justify-between text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1"><Gauge size={11} /> Speed</span>
          <span className="font-mono text-zinc-300">{formattedSpeed}×</span>
        </span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={speed}
          onChange={(event) =>
            onUpdate(edge.id, { animationSpeed: event.target.valueAsNumber })
          }
          className="mt-1.5 h-1.5 w-full cursor-pointer accent-cyan-400"
        />
        <span className="mt-1 flex justify-between text-[8px] uppercase tracking-wider text-zinc-700">
          <span>0.25×</span><span>3×</span>
        </span>
        <span className="mt-1 block text-[9px] leading-relaxed text-zinc-600">
          Traveling effects keep a consistent speed across different line lengths.
        </span>
      </label>

      <button
        type="button"
        onClick={() => onDelete(edge.id)}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
      >
        <Trash2 size={12} /> Delete line
      </button>
    </div>
  );
}

function MarkerPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EdgeMarker;
  onChange: (marker: EdgeMarker) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
        {label}
      </p>
      <div className="mt-1.5 grid grid-cols-6 gap-1 rounded-xl bg-black/30 p-1.5 ring-1 ring-white/10">
        {MARKERS.map((marker) => {
          const active = marker.value === value;
          return (
            <button
              key={marker.value}
              type="button"
              title={marker.label}
              aria-label={`${label}: ${marker.label}`}
              aria-pressed={active}
              onClick={() => onChange(marker.value)}
              className={[
                'grid h-9 place-items-center rounded-lg transition',
                active
                  ? 'bg-violet-500 text-white shadow-[0_5px_16px_rgba(139,92,246,.35)]'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <MarkerPreview marker={marker.value} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MarkerPreview({ marker }: { marker: EdgeMarker }) {
  const markerShape = (() => {
    switch (marker) {
      case 'none':
        return null;
      case 'arrow':
        return <path d="M 17 6 L 23 10 L 17 14 Z" fill="currentColor" />;
      case 'open-arrow':
        return <path d="M 17 5 L 23 10 L 17 15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />;
      case 'triangle':
        return <path d="M 17 5 L 23 10 L 17 15 Z" fill="#18181b" stroke="currentColor" strokeWidth={1.6} />;
      case 'circle':
        return <circle cx={19.5} cy={10} r={3.8} fill="#18181b" stroke="currentColor" strokeWidth={1.6} />;
      case 'diamond':
        return <path d="M 15 10 L 19 6 L 23 10 L 19 14 Z" fill="#18181b" stroke="currentColor" strokeWidth={1.6} />;
    }
  })();

  return (
    <svg width={28} height={20} viewBox="0 0 28 20" aria-hidden="true">
      <path d={marker === 'none' ? 'M 4 10 H 24' : 'M 4 10 H 20'} stroke="currentColor" strokeWidth={1.7} />
      {markerShape}
    </svg>
  );
}

function EffectPreview({
  effect,
  active,
  direction,
}: {
  effect: EdgeEffect;
  active: boolean;
  direction: EdgeDirection;
}) {
  return (
    <span className="relative h-3 w-12 overflow-hidden rounded-full bg-black/20">
      <span
        className={[
          'absolute left-1 right-1 top-[5px] h-px bg-current',
          active ? `edge-preview-${effect}` : '',
        ].join(' ')}
        style={{ animationDirection: direction === 'reverse' ? 'reverse' : 'normal' }}
      />
    </span>
  );
}
