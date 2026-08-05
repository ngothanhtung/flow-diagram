'use client';

import { Activity, ArrowLeft, ArrowLeftRight, ArrowRight, CircleDot, Diamond, Gauge, GitCompareArrows, Minus, Palette, Radio, Route, ScanLine, Sparkles, Trash2, Triangle, Undo2, Waves, X, Zap, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { EdgeEffectLayer } from './edge-effect-layer';
import { EdgeMarkerSymbol } from './edge-marker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { EdgeDirection, EdgeEffect, EdgeLabelPosition, EdgeMarker, EdgeRouting, FlowEdge } from '@/lib/flowchart-types';

interface EdgeInspectorProps {
  edge: FlowEdge;
  sourceTitle: string;
  targetTitle: string;
  fallbackColor: `#${string}`;
  onUpdate: (id: string, patch: Partial<Omit<FlowEdge, 'id' | 'from' | 'to'>>) => void;
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

const ROUTING_OPTIONS: Array<{ value: EdgeRouting; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'smooth-step', label: 'Smooth step' },
  { value: 'orthogonal', label: 'Orthogonal' },
  { value: 'curved', label: 'Bezier curve' },
];

const LABEL_POSITION_OPTIONS: Array<{ value: EdgeLabelPosition; label: string }> = [
  { value: 'center', label: 'Center' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

const LINE_COLORS: Array<{ value: `#${string}`; label: string }> = [
  { value: '#f4f4f5', label: 'White' },
  { value: '#38bdf8', label: 'Sky' },
  { value: '#22d3ee', label: 'Cyan' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#71717a', label: 'Zinc' },
];

const MARKERS: Array<{ value: EdgeMarker; label: string }> = [
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
];
export function EdgeInspector({ edge, sourceTitle, targetTitle, fallbackColor, onUpdate, onDelete, onClose }: EdgeInspectorProps) {
  const [label, setLabel] = useState(edge.label ?? '');
  const [draftEffect, setDraftEffect] = useState<EdgeEffect | null>(null);
  const effect = edge.effect ?? 'flow';
  const direction = edge.direction ?? 'forward';
  const isDialogOpen = draftEffect !== null;
  const color = edge.color ?? fallbackColor;
  const width = edge.width ?? 2.5;
  const speed = edge.animationSpeed ?? 1;
  const formattedSpeed = speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const effectSize = edge.effectSize ?? 1;
  const selectedEffect = EFFECTS.find((item) => item.value === effect) ?? EFFECTS[0];
  const SelectedEffectIcon = selectedEffect.Icon;

  return (
    <Card size='sm' className='gap-0 border-cyan-300/10 bg-zinc-900/80 py-0 ring-cyan-400/35 shadow-[0_18px_60px_rgba(0,0,0,.3)]'>
      <CardHeader className='sticky top-0 z-10 grid grid-cols-[1fr_auto] border-b border-white/8 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl'>
        <div className='min-w-0'>
          <CardTitle className='text-sm font-semibold'>Line inspector</CardTitle>
          <CardDescription className='mt-1 max-w-[230px] truncate text-[10px] text-zinc-500'>
            {sourceTitle} → {targetTitle}
          </CardDescription>
        </div>
        <Button variant='ghost' size='icon-sm' onClick={onClose} aria-label='Close line inspector' className='text-zinc-500 hover:bg-white/8 hover:text-zinc-100'>
          <X />
        </Button>
      </CardHeader>

      <CardContent className='px-4 pb-4'>
        <p className='mt-3 rounded-lg bg-cyan-400/8 px-2.5 py-2 text-[9px] leading-relaxed text-cyan-100/70 ring-1 ring-cyan-400/18'>Drag A/B to reconnect. Drag the diamond points to reshape the line; double-click one to remove it.</p>

        <Label htmlFor='edge-label' className='mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>
          Label
        </Label>
        <Input
          id='edge-label'
          value={label}
          placeholder='Add a line label…'
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => onUpdate(edge.id, { label: label.trim() || undefined })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className='mt-1.5 border-white/10 bg-zinc-800/80 text-xs placeholder:text-zinc-600 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'
        />

        <Label htmlFor='edge-label-position' className='mt-3 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>
          Label position
        </Label>
        <Select
          value={edge.labelPosition ?? 'center'}
          onValueChange={(nextValue) => {
            if (nextValue) onUpdate(edge.id, { labelPosition: nextValue as EdgeLabelPosition });
          }}
        >
          <SelectTrigger id='edge-label-position' className='mt-1.5 h-9 w-full border-white/10 bg-white/5 px-3 text-left hover:bg-white/8 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'>
            <span className='flex-1 truncate text-[11px] font-semibold text-zinc-200'>{LABEL_POSITION_OPTIONS.find((option) => option.value === (edge.labelPosition ?? 'center'))?.label}</span>
          </SelectTrigger>
          <SelectContent className='border-cyan-400/25 bg-zinc-950 p-1.5'>
            <SelectGroup>
              <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600'>Label position</SelectLabel>
              {LABEL_POSITION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className='px-2 py-1.5 pr-8 text-[11px] font-semibold'>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <MarkerPicker label='Line start' value={edge.startMarker ?? 'none'} onChange={(startMarker) => onUpdate(edge.id, { startMarker })} />
        <MarkerPicker label='Line end' value={edge.endMarker ?? 'arrow'} onChange={(endMarker) => onUpdate(edge.id, { endMarker })} />

        <div className='mt-3'>
          <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>Routing</p>
          <Select
            value={edge.routing ?? 'orthogonal'}
            onValueChange={(nextValue) => {
              if (nextValue) {
                onUpdate(edge.id, {
                  routing: nextValue as EdgeRouting,
                  bendPoints: undefined,
                });
              }
            }}
          >
            <SelectTrigger className='mt-1.5 h-9 w-full border-white/10 bg-white/5 px-3 text-left hover:bg-white/8 focus-visible:border-violet-400/50 focus-visible:ring-violet-400/15'>
              <span className='flex-1 truncate text-[11px] font-semibold text-zinc-200'>{ROUTING_OPTIONS.find((option) => option.value === (edge.routing ?? 'orthogonal'))?.label}</span>
            </SelectTrigger>
            <SelectContent className='border-violet-400/25 bg-zinc-950 p-1.5'>
              <SelectGroup>
                <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600'>Routing</SelectLabel>
                {ROUTING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className='px-2 py-1.5 pr-8 text-[11px] font-semibold'>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {(edge.routing ?? 'orthogonal') === 'orthogonal' || (edge.routing ?? 'orthogonal') === 'smooth-step' ? (
            <div className='mt-2 flex items-center justify-between rounded-lg bg-white/4 px-2.5 py-2 ring-1 ring-white/8'>
              <span className='text-[9px] text-zinc-500'>{edge.bendPoints?.length ? `${edge.bendPoints.length} custom bend points` : 'Automatic bend points'}</span>
              <Button variant='ghost' size='xs' disabled={!edge.bendPoints?.length} onClick={() => onUpdate(edge.id, { bendPoints: undefined })} className='text-zinc-400 hover:bg-white/8 hover:text-cyan-100'>
                <Undo2 /> Reset route
              </Button>
            </div>
          ) : null}
        </div>

        <Dialog
          open={draftEffect !== null}
          onOpenChange={(open) => {
            if (open) setDraftEffect(effect);
            else setDraftEffect(null);
          }}
        >
          <DialogTrigger
            render={
              <button
                type='button'
                className='mt-1.5 flex h-auto w-full cursor-pointer items-center gap-2.5 rounded-md border border-white/10 bg-zinc-800 px-3 py-2.5 text-left hover:bg-zinc-700/80 focus-visible:border-cyan-400/50 focus-visible:ring-1 focus-visible:ring-cyan-400/15 focus-visible:outline-hidden'
              >
                <span className='grid size-7 shrink-0 place-items-center rounded-md bg-black/20 text-cyan-200'>
                  <SelectedEffectIcon size={14} />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-xs font-semibold'>{selectedEffect.label}</span>
                  <span className='block truncate text-[9px] font-normal text-zinc-500'>{selectedEffect.description}</span>
                </span>
              </button>
            }
          />
          <DialogContent className='flex h-[90vh] max-h-225 w-[92vw] max-w-6xl sm:max-w-6xl flex-col gap-0 overflow-hidden border-cyan-400/25 bg-zinc-950 p-0 ring-1 ring-cyan-400/25'>
            <DialogHeader className='shrink-0 px-8 pt-6 pb-4'>
              <DialogTitle className='text-base font-semibold text-zinc-100'>Line effect</DialogTitle>
            </DialogHeader>
            <div className='grid min-h-0 flex-1 grid-cols-8 overflow-hidden'>
              <div className='col-span-5 grid auto-rows-min grid-cols-3 gap-4 overflow-y-auto pr-4 pb-6 pl-8'>
                {EFFECTS.map((item) => {
                  const Icon = item.Icon;
                  const active = item.value === draftEffect;
                  return (
                    <button
                      key={item.value}
                      type='button'
                      onClick={() => setDraftEffect(item.value)}
                      className={[
                        'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition',
                        active ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-zinc-900/70 text-zinc-300 hover:border-white/20 hover:bg-zinc-800',
                      ].join(' ')}
                    >
                      <span className='flex w-full items-center justify-between gap-2'>
                        <span className='flex items-center gap-2'>
                          <span className='grid size-9 place-items-center rounded-md bg-black/30 text-cyan-200'>
                            <Icon size={16} />
                          </span>
                          <span className='text-[13px] font-semibold'>{item.label}</span>
                        </span>
                        {active && <span className='rounded-full bg-cyan-400/20 px-2 py-0.5 text-[9px] font-semibold text-cyan-200'>Selected</span>}
                      </span>
                      <span className='block text-[11px] leading-relaxed text-zinc-500'>{item.description}</span>
                    </button>
                  );
                })}
              </div>
              <div className='col-span-3 flex flex-col overflow-y-auto pb-6 pr-8 pl-4'>
                <div className='flex h-48 shrink-0 items-center justify-center rounded-xl border border-[#28282A] bg-[#09090B]'>
                  <EffectPreviewLarge effect={draftEffect ?? effect} direction={direction} color={color} effectColor={edge.effectColor} width={width} effectSize={effectSize} speed={speed} />
                </div>

                <div className='mt-4'>
                  <span className='flex items-center justify-between text-[10px] text-zinc-500'>
                    <span className='inline-flex items-center gap-1'>
                      <Palette size={11} /> Effect object color
                    </span>
                    {edge.effectColor ? (
                      <Button variant='ghost' size='xs' onClick={() => onUpdate(edge.id, { effectColor: undefined })} className='text-zinc-400 hover:bg-white/8 hover:text-cyan-100'>
                        <Undo2 /> Use line color
                      </Button>
                    ) : (
                      <span className='text-[8px] uppercase tracking-wider text-zinc-600'>Auto · line color</span>
                    )}
                  </span>
                  <span className='mt-1.5 flex items-center gap-2'>
                    <Input
                      type='color'
                      value={edge.effectColor ?? color}
                      onChange={(event) =>
                        onUpdate(edge.id, {
                          effectColor: event.target.value as `#${string}`,
                        })
                      }
                      className='h-7 w-8 cursor-pointer border-white/10 bg-transparent p-0.5'
                    />
                    <span className='font-mono text-[9px] uppercase text-zinc-300'>{edge.effectColor ?? color}</span>
                  </span>
                  <span className='mt-1 block text-[9px] leading-relaxed text-zinc-600'>Colour of the moving objects. Leave on auto to match the line.</span>
                </div>

                <div className='mt-3'>
                  <span className='flex items-center justify-between text-[10px] text-zinc-500'>
                    <span className='inline-flex items-center gap-1'>
                      <CircleDot size={11} /> Effect object size
                    </span>
                    <span className='font-mono text-zinc-300'>{effectSize.toFixed(1)}×</span>
                  </span>
                  <Slider
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={effectSize}
                    onValueChange={(nextValue) => onUpdate(edge.id, { effectSize: nextValue as number })}
                    className='mt-2 [&_[data-slot=slider-range]]:bg-violet-400 [&_[data-slot=slider-thumb]]:border-violet-300'
                  />
                  <span className='mt-1 flex justify-between text-[8px] uppercase tracking-wider text-zinc-700'>
                    <span>Small</span>
                    <span>Large</span>
                  </span>
                  <span className='mt-1 block text-[9px] leading-relaxed text-zinc-600'>Object count adapts automatically to the routed line length.</span>
                </div>

                <div className='mt-3'>
                  <span className='flex items-center justify-between text-[10px] text-zinc-500'>
                    <span className='inline-flex items-center gap-1'>
                      <Gauge size={11} /> Speed
                    </span>
                    <span className='font-mono text-zinc-300'>{formattedSpeed}×</span>
                  </span>
                  <Slider
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={speed}
                    onValueChange={(nextValue) => onUpdate(edge.id, { animationSpeed: nextValue as number })}
                    className='mt-2 [&_[data-slot=slider-range]]:bg-cyan-400 [&_[data-slot=slider-thumb]]:border-cyan-300'
                  />
                  <span className='mt-1 flex justify-between text-[8px] uppercase tracking-wider text-zinc-700'>
                    <span>0.25×</span>
                    <span>3×</span>
                  </span>
                  <span className='mt-1 block text-[9px] leading-relaxed text-zinc-600'>Traveling effects keep a consistent speed across different line lengths.</span>
                </div>
              </div>
            </div>
            <div className='flex shrink-0 justify-end gap-2 border-t border-white/10 px-8 py-4'>
              <Button type='button' variant='ghost' size='xs' onClick={() => setDraftEffect(null)} className='text-zinc-400 hover:bg-white/8 hover:text-zinc-100'>
                Cancel
              </Button>
              <Button
                type='button'
                size='xs'
                onClick={() => {
                  if (draftEffect) onUpdate(edge.id, { effect: draftEffect });
                  setDraftEffect(null);
                }}
                className='bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50 hover:bg-cyan-500/30'
              >
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {effect !== 'bidirectional' ? (
          <ToggleGroup
            value={[direction]}
            onValueChange={(nextValue) => {
              const nextDirection = nextValue.at(-1);
              if (nextDirection) {
                onUpdate(edge.id, { direction: nextDirection as EdgeDirection });
              }
            }}
            variant='outline'
            size='sm'
            spacing={1}
            className='mt-1.5 grid w-full grid-cols-3 rounded-xl bg-black/30 p-1.5 ring-1 ring-white/10'
          >
            {(
              [
                { value: 'forward', label: 'A → B', Icon: ArrowRight },
                { value: 'reverse', label: 'B → A', Icon: ArrowLeft },
                { value: 'both', label: 'A ↔ B', Icon: ArrowLeftRight },
              ] as const
            ).map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-pressed={direction === option.value}
                aria-label={option.label}
                title={option.label}
                className={['h-9 w-full border-white/8 bg-transparent text-[11px] font-semibold', direction === option.value ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100' : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-200'].join(' ')}
              >
                <option.Icon size={14} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <p className='mt-1.5 rounded-lg bg-cyan-500/8 px-2.5 py-2 text-[10px] text-cyan-200/70 ring-1 ring-cyan-400/15'>Two-way runs simultaneously from A → B and B → A.</p>
        )}

        <div className='mt-4 grid grid-cols-2 gap-2'>
          <div>
            <Label className='mb-1 block text-[9px] text-zinc-500'>Line color</Label>
            <Select
              value={LINE_COLORS.some((item) => item.value === color) ? color : undefined}
              onValueChange={(nextValue) => {
                if (nextValue) onUpdate(edge.id, { color: nextValue as `#${string}` });
              }}
            >
              <SelectTrigger className='h-auto w-full gap-2 border-white/10 bg-white/5 px-2 py-1.5 text-left hover:bg-white/8 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'>
                <span className='size-4 shrink-0 rounded-full ring-1 ring-white/20' style={{ background: color }} />
                <span className='min-w-0 flex-1 truncate font-mono text-[9px] uppercase text-zinc-300'>{LINE_COLORS.find((item) => item.value === color)?.label ?? color}</span>
              </SelectTrigger>
              <SelectContent className='border-cyan-400/25 bg-zinc-950 p-1.5'>
                <SelectGroup>
                  <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600'>Line color</SelectLabel>
                  {LINE_COLORS.map((item) => (
                    <SelectItem key={item.value} value={item.value} className='gap-2 px-2 py-1.5 pr-8'>
                      <span className='size-4 shrink-0 rounded-full ring-1 ring-white/20' style={{ background: item.value }} />
                      <span className='min-w-0 flex-1 text-[11px] font-semibold'>{item.label}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor='edge-width' className='mb-1 block text-[9px] text-zinc-500'>
              Width
            </Label>
            <Input
              id='edge-width'
              type='number'
              min={1}
              max={6}
              step={0.5}
              value={width}
              onChange={(event) => onUpdate(edge.id, { width: event.target.valueAsNumber })}
              className='border-white/10 bg-white/5 font-mono text-xs text-zinc-200 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'
            />
          </div>
        </div>

        <Button variant='destructive' onClick={() => onDelete(edge.id)} className='mt-4 w-full'>
          <Trash2 size={12} /> Delete line
        </Button>
      </CardContent>
    </Card>
  );
}

function MarkerPicker({ label, value, onChange }: { label: string; value: EdgeMarker; onChange: (marker: EdgeMarker) => void }) {
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
        <SelectTrigger className='mt-1.5 h-auto w-full gap-2.5 border-white/10 bg-zinc-800 px-3 py-2.5 text-left hover:bg-zinc-700/80 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'>
          <span className='grid h-7 w-9 shrink-0 place-items-center rounded-md bg-black/20 text-cyan-200'>
            <MarkerSwatch marker={value} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-xs font-semibold'>{selected.label}</span>
          </span>
        </SelectTrigger>
        <SelectContent className='max-h-72 min-w-65 border-cyan-400/25 bg-zinc-950 p-1.5'>
          <SelectGroup>
            <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600'>{label}</SelectLabel>
            {MARKERS.map((marker) => (
              <SelectItem key={marker.value} value={marker.value} className='gap-2.5 px-2.5 py-2 pr-9'>
                <span className='grid h-7 w-9 shrink-0 place-items-center rounded-md bg-black/25 text-cyan-200'>
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
function MarkerSwatch({ marker }: { marker: EdgeMarker }) {
  return (
    <svg width={28} height={20} viewBox='-30 -12 34 24' className='text-cyan-200'>
      <line x1={-28} y1={0} x2={0} y2={0} stroke='currentColor' strokeWidth={1.5} strokeOpacity={0.7} />
      <EdgeMarkerSymbol marker={marker} />
    </svg>
  );
}

/**
 * A straight preview line so the effect and line width/colour render
 * through the exact same `EdgeEffectLayer` used live — no separate CSS
 * approximation to keep in sync.
 */
const PREVIEW_POINTS = [
  { x: 32, y: 90 },
  { x: 368, y: 90 },
];
const PREVIEW_PATH = PREVIEW_POINTS.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

function EffectPreviewLarge({ effect, direction, color, effectColor, width, effectSize, speed }: { effect: EdgeEffect; direction: EdgeDirection; color: string; effectColor?: string; width: number; effectSize: number; speed: number }) {
  return (
    <svg viewBox='0 0 400 180' className='h-auto w-full max-w-96' style={{ color }}>
      <path d={PREVIEW_PATH} stroke='currentColor' strokeWidth={width} strokeOpacity={0.52} fill='none' />
      <g style={effectColor ? { color: effectColor } : undefined}>
        <EdgeEffectLayer d={PREVIEW_PATH} effect={effect} direction={direction} lineWidth={width} effectSize={effectSize} speed={speed} />
      </g>
    </svg>
  );
}
