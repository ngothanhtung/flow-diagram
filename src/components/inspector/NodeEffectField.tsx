'use client';

import { Activity, Ban, Circle, CircleDot, Move3d, RadioTower, Sparkles, Sun, Vibrate, Waves, Wind, Zap, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NodeEffectLayer, nodeMotionStyle, resolveEffectKnobs } from '@/components/node-effect-layer';
import type { FlowNode, NodeEffect } from '@/lib/flowchart-types';
import { nodeOutline } from '@/lib/node-style';
import { ColorField, RangeField, SectionLabel, type InspectorPanelProps } from './fields';

interface EffectOption {
  value: NodeEffect;
  label: string;
  description: string;
  Icon: LucideIcon;
}

/**
 * The two families are listed separately because they behave differently:
 * a motion effect moves the block, a decoration effect paints something
 * extra around it. Saying so up front stops "why does nothing move?" when
 * someone picks Glow.
 */
const MOTION_EFFECTS: EffectOption[] = [
  { value: 'float', label: 'Float', description: 'Drifts gently up and down', Icon: Wind },
  { value: 'breathe', label: 'Breathe', description: 'Scales in and out slowly', Icon: Activity },
  { value: 'bounce', label: 'Bounce', description: 'Hops and settles, on a loop', Icon: Move3d },
  { value: 'wobble', label: 'Wobble', description: 'Rocks side to side', Icon: Vibrate },
  { value: 'shake', label: 'Shake', description: 'Fast nervous jitter — good for alerts', Icon: Zap },
  { value: 'blink', label: 'Blink', description: 'Fades out and back, drawing the eye', Icon: CircleDot },
];

const DECORATION_EFFECTS: EffectOption[] = [
  { value: 'glow', label: 'Glow', description: 'Steady halo around the outline', Icon: Sun },
  { value: 'pulse', label: 'Pulse', description: 'Halo swelling in and out', Icon: RadioTower },
  { value: 'ripple', label: 'Ripple', description: 'Rings radiating outwards', Icon: Circle },
  { value: 'trace', label: 'Trace', description: 'Dashes marching around the border', Icon: Waves },
  { value: 'sheen', label: 'Sheen', description: 'Band of light sweeping across the body', Icon: Sparkles },
];

const NONE_EFFECT: EffectOption = { value: 'none', label: 'None', description: 'Completely static — the default', Icon: Ban };

const ALL_EFFECTS = [NONE_EFFECT, ...MOTION_EFFECTS, ...DECORATION_EFFECTS];

/**
 * Effect picker for a node, built to feel like the line effect picker:
 * a trigger showing the current choice, a dialog of cards, a live preview
 * rendered through the real effect layer, and the knobs underneath.
 *
 * Shared by all three panels, because a block, a frame and a text object
 * animate identically — only what they paint underneath differs.
 */
export function NodeEffectField({ node, onUpdate, foreground }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; foreground: `#${string}` }) {
  const [draft, setDraft] = useState<NodeEffect | null>(null);
  const effect = node.effect ?? 'none';
  const selected = ALL_EFFECTS.find((item) => item.value === effect) ?? NONE_EFFECT;
  const SelectedIcon = selected.Icon;
  const preview = draft ?? effect;
  const knobs = resolveEffectKnobs(node.effectSpeed, node.effectIntensity);
  // Every decoration effect traces the node's outline — a halo, a ring, a
  // dashed border. Free text, free icon/logo objects and free lines have
  // no outline to trace (none of them paints a body), so decoration would
  // draw exactly the border they're defined not to have. Only motion —
  // the content itself moving — makes sense on them.
  const isText = node.type === 'text' || node.type === 'icon' || node.type === 'line';
  const motionSubject = node.type === 'text' ? 'text' : node.type === 'icon' ? 'icon' : node.type === 'line' ? 'line' : 'block';

  return (
    <>
      <SectionLabel>Effect</SectionLabel>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          setDraft(open ? effect : null);
        }}
      >
        <DialogTrigger
          render={
            <button
              type='button'
              className='mt-1.5 flex h-auto w-full cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:border-cyan-400/50 focus-visible:ring-1 focus-visible:ring-cyan-400/15 focus-visible:outline-hidden'
            >
              <span className='grid size-7 shrink-0 place-items-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
                <SelectedIcon size={14} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-xs font-semibold'>{selected.label}</span>
                <span className='block truncate text-[9px] font-normal text-muted-foreground'>{selected.description}</span>
              </span>
            </button>
          }
        />
        <DialogContent className='flex h-[90vh] max-h-225 w-[92vw] max-w-5xl sm:max-w-5xl flex-col gap-0 overflow-hidden border-cyan-400/25 bg-popover p-0 ring-1 ring-cyan-400/25'>
          <DialogHeader className='shrink-0 px-8 pt-6 pb-4'>
            <DialogTitle className='text-base font-semibold text-foreground'>Block effect</DialogTitle>
          </DialogHeader>
          <div className='grid min-h-0 flex-1 grid-cols-8 overflow-hidden'>
            <div className='col-span-5 space-y-5 overflow-y-auto pr-4 pb-6 pl-8'>
              <EffectGroup title='Off' options={[NONE_EFFECT]} draft={draft} onPick={setDraft} />
              <EffectGroup title={`Motion · the ${motionSubject} itself moves`} options={MOTION_EFFECTS} draft={draft} onPick={setDraft} />
              {!isText && <EffectGroup title='Decoration · an extra layer is painted' options={DECORATION_EFFECTS} draft={draft} onPick={setDraft} />}
            </div>

            <div className='col-span-3 flex flex-col overflow-y-auto pb-6 pr-8 pl-4'>
              <div className='flex h-56 shrink-0 items-center justify-center rounded-xl border border-[#28282A] bg-[#09090B]'>
                <NodeEffectPreview effect={preview} color={node.effectColor ?? foreground} speed={knobs.speed} intensity={knobs.intensity} />
              </div>

              {preview === 'none' ? (
                <p className='mt-5 text-[11px] leading-relaxed text-muted-foreground'>The block stays completely still and paints nothing extra. This is how every new block, frame and text object starts.</p>
              ) : (
                <div className='mt-5 space-y-1'>
                  <RangeField label='Speed' value={Math.round(knobs.speed * 100)} min={25} max={300} suffix='%' onChange={(value) => onUpdate(node.id, { effectSpeed: value / 100 })} />
                  <RangeField label='Intensity' value={Math.round(knobs.intensity * 100)} min={25} max={300} suffix='%' onChange={(value) => onUpdate(node.id, { effectIntensity: value / 100 })} />
                  <div className='pt-2'>
                    <ColorField label='Effect colour' value={node.effectColor ?? foreground} onChange={(effectColor) => onUpdate(node.id, { effectColor })} />
                  </div>
                  <p className='pt-2 text-[10px] leading-relaxed text-muted-foreground'>Speed and intensity mean the same thing for every effect: how fast the cycle runs, and how far it travels or how bright it burns.</p>
                </div>
              )}
            </div>
          </div>

          <div className='flex shrink-0 items-center justify-end gap-2 border-t border-border px-8 py-4'>
            <Button type='button' variant='ghost' size='xs' onClick={() => setDraft(null)} className='text-muted-foreground hover:bg-accent hover:text-foreground'>
              Cancel
            </Button>
            <Button
              type='button'
              variant='accent'
              size='xs'
              onClick={() => {
                if (draft) onUpdate(node.id, { effect: draft === 'none' ? undefined : draft });
                setDraft(null);
              }}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EffectGroup({ title, options, draft, onPick }: { title: string; options: EffectOption[]; draft: NodeEffect | null; onPick: (effect: NodeEffect) => void }) {
  return (
    <div>
      <p className='mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>{title}</p>
      <div className='grid grid-cols-3 gap-3'>
        {options.map((item) => {
          const Icon = item.Icon;
          const active = item.value === draft;
          return (
            <button
              key={item.value}
              type='button'
              onClick={() => onPick(item.value)}
              className={['flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition', active ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-100' : 'border-border bg-card text-muted-foreground hover:border-ring/40 hover:bg-muted/50'].join(' ')}
            >
              <span className='flex w-full items-center justify-between gap-2'>
                <span className='flex items-center gap-2'>
                  <span className='grid size-8 place-items-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
                    <Icon size={15} />
                  </span>
                  <span className='text-[12px] font-semibold'>{item.label}</span>
                </span>
                {active && <span className='rounded-full bg-cyan-400/20 px-2 py-0.5 text-[9px] font-semibold text-cyan-700 dark:text-cyan-200'>Selected</span>}
              </span>
              <span className='block text-[10px] leading-relaxed text-muted-foreground'>{item.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PREVIEW_WIDTH = 150;
const PREVIEW_HEIGHT = 84;

/**
 * A sample block rendered through the exact layer the canvas uses, so the
 * preview can't drift from the real thing.
 */
function NodeEffectPreview({ effect, color, speed, intensity }: { effect: NodeEffect; color: string; speed: number; intensity: number }) {
  const outline = nodeOutline('rounded', PREVIEW_WIDTH, PREVIEW_HEIGHT);
  return (
    <svg width={230} height={150} viewBox='-115 -75 230 150' aria-hidden='true'>
      <g style={nodeMotionStyle(effect, speed, intensity)}>
        <path d={outline.d} transform={outline.transform} fill='#1e293b' stroke='#c7d2fe' strokeWidth={1.5} strokeLinejoin='round' />
        <text x={0} y={5} textAnchor='middle' fill='#c7d2fe' fontSize={13} fontFamily='var(--font-geist-mono, monospace)'>
          Block
        </text>
        <NodeEffectLayer d={outline.d} transform={outline.transform} effect={effect} color={color} speed={speed} intensity={intensity} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} clipId='node-fx-preview' />
      </g>
    </svg>
  );
}
