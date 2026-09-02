'use client';

import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EDGE_EFFECTS, LINE_STYLE_OPTIONS, MarkerPicker, ROUTING_OPTIONS, EdgeStyleSample } from '@/components/edge-style-fields';
import { ColorField, HuePresetRow, NumberField } from '@/components/inspector/fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useEditorStore } from '@/lib/editor-store';
import { edgeStylesOf, nextEdgeStyleId, STARTER_EDGE_STYLES } from '@/lib/edge-style';
import type { EdgeEffect, EdgeLineStyle, EdgeRouting, EdgeStyleClass } from '@/lib/flowchart-types';

/**
 * The document's line vocabulary, editable in one place.
 *
 * The whole point of the feature is that a diagram reads consistently
 * because it uses *few* kinds of line, so this dialog is deliberately
 * about naming kinds rather than exposing every knob a single line has:
 * colour, width, stroke pattern, the two end markers, routing and which
 * animation. Anything finer stays a per-line override in the inspector.
 */
export function EdgeStylePaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const doc = useEditorStore((state) => state.doc);
  const { upsertEdgeStyle, removeEdgeStyle } = useEditorStore();
  const styles = edgeStylesOf(doc.settings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = styles.find((style) => style.id === selectedId) ?? styles[0] ?? null;

  const usageOf = (styleId: string) => doc.edges.filter((edge) => edge.styleRef === styleId).length;
  const patch = (next: Partial<EdgeStyleClass>) => {
    if (selected) upsertEdgeStyle({ ...selected, ...next });
  };

  const addStyle = () => {
    const id = nextEdgeStyleId(styles);
    upsertEdgeStyle({ id, name: `Line kind ${styles.length + 1}`, color: '#94a3b8', width: 2, lineStyle: 'solid', endMarker: 'arrow', effect: 'none' });
    setSelectedId(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[86vh] max-h-200 w-[92vw] max-w-4xl sm:max-w-4xl flex-col gap-0 overflow-hidden border-cyan-400/25 bg-popover p-0 ring-1 ring-cyan-400/25'>
        <DialogHeader className='shrink-0 px-8 pt-6 pb-4'>
          <DialogTitle className='text-base font-semibold text-foreground'>Line styles</DialogTitle>
          <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>Name the kinds of line this diagram uses, then point lines at them. Editing a style here restyles every line following it.</p>
        </DialogHeader>

        {styles.length === 0 ? (
          <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 pb-8 text-center'>
            <p className='max-w-md text-[12px] leading-relaxed text-muted-foreground'>This diagram has no named line styles yet. Start from the four kinds most diagrams turn out to need, then rename or delete what doesn&apos;t apply.</p>
            <div className='flex w-full max-w-md flex-col gap-2 rounded-xl border border-border bg-card p-4'>
              {STARTER_EDGE_STYLES.map((style) => (
                <div key={style.id} className='flex items-center gap-3'>
                  <EdgeStyleSample color={style.color ?? '#94a3b8'} width={style.width} lineStyle={style.lineStyle} endMarker={style.endMarker} length={72} />
                  <span className='text-[11px] font-semibold text-foreground'>{style.name}</span>
                </div>
              ))}
            </div>
            <div className='flex gap-2'>
              <Button
                variant='accent'
                size='sm'
                onClick={() => {
                  for (const style of STARTER_EDGE_STYLES) upsertEdgeStyle(style);
                  setSelectedId(STARTER_EDGE_STYLES[0].id);
                }}
              >
                <Sparkles size={13} /> Add these four
              </Button>
              <Button variant='outline' size='sm' onClick={addStyle} className='border-border bg-muted/30 text-muted-foreground hover:bg-accent'>
                <Plus size={13} /> Start empty
              </Button>
            </div>
          </div>
        ) : (
          <div className='grid min-h-0 flex-1 grid-cols-5 overflow-hidden'>
            <div className='col-span-2 flex min-h-0 flex-col border-r border-border'>
              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-2'>
                {styles.map((style) => {
                  const active = style.id === selected?.id;
                  const usage = usageOf(style.id);
                  return (
                    <button
                      key={style.id}
                      type='button'
                      onClick={() => setSelectedId(style.id)}
                      className={['mb-1.5 flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition', active ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-border bg-card hover:border-ring/40 hover:bg-muted/50'].join(' ')}
                    >
                      <span className='flex items-baseline justify-between gap-2'>
                        <span className='truncate text-[12px] font-semibold text-foreground'>{style.name}</span>
                        <span className='shrink-0 text-[9px] text-muted-foreground'>{usage === 0 ? 'unused' : `${usage} line${usage === 1 ? '' : 's'}`}</span>
                      </span>
                      <EdgeStyleSample color={style.color ?? '#94a3b8'} width={style.width} lineStyle={style.lineStyle} startMarker={style.startMarker} endMarker={style.endMarker} length={120} />
                    </button>
                  );
                })}
              </div>
              <div className='shrink-0 border-t border-border p-3'>
                <Button variant='outline' size='sm' onClick={addStyle} className='w-full border-border bg-muted/30 text-[11px] text-muted-foreground hover:bg-accent'>
                  <Plus size={13} /> Add a line kind
                </Button>
              </div>
            </div>

            {selected && (
              <div className='col-span-3 min-h-0 overflow-y-auto px-6 py-4'>
                <Label htmlFor='edge-style-name' className='block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>
                  Name
                </Label>
                <Input
                  id='edge-style-name'
                  value={selected.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  placeholder='what this kind of line means'
                  className='mt-1.5 border-border bg-muted/30 text-xs focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'
                />
                <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>Shown wherever this style is picked, so write it as the reader should read it.</p>

                <Label className='mt-4 mb-1 block text-[9px] text-muted-foreground'>Colour</Label>
                <HuePresetRow value={selected.color ?? '#94a3b8'} onPick={(color) => patch({ color })} />

                <div className='mt-3 grid grid-cols-2 gap-2'>
                  <ColorField label='Custom' value={selected.color ?? '#94a3b8'} onChange={(color) => patch({ color })} />
                  <NumberField label='Width' value={selected.width ?? 2} min={1} max={6} step={0.5} onChange={(width) => patch({ width })} />
                </div>

                <Label className='mt-4 mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>Stroke</Label>
                <LineStyleToggle value={selected.lineStyle ?? 'solid'} onChange={(lineStyle) => patch({ lineStyle })} />
                <p className='mt-1.5 text-[9px] leading-relaxed text-muted-foreground'>The pattern of the line itself, which stays put whether or not the diagram is playing — unlike an animated effect&apos;s moving marks.</p>

                <MarkerPicker label='Line start' value={selected.startMarker ?? 'none'} onChange={(startMarker) => patch({ startMarker })} />
                <MarkerPicker label='Line end' value={selected.endMarker ?? 'none'} onChange={(endMarker) => patch({ endMarker })} />

                <Label className='mt-3 mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>Routing</Label>
                <Select value={selected.routing ?? 'smooth-step'} onValueChange={(next) => next && patch({ routing: next as EdgeRouting })}>
                  <SelectTrigger className='h-9 w-full border-border bg-muted/30 px-3 text-left hover:bg-accent focus-visible:border-violet-400/50 focus-visible:ring-violet-400/15'>
                    <span className='flex-1 truncate text-[11px] font-semibold text-foreground'>{ROUTING_OPTIONS.find((option) => option.value === (selected.routing ?? 'smooth-step'))?.label}</span>
                  </SelectTrigger>
                  <SelectContent className='border-violet-400/25 bg-popover p-1.5'>
                    <SelectGroup>
                      <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground'>Routing</SelectLabel>
                      {ROUTING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className='px-2 py-1.5 pr-8 text-[11px] font-semibold'>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Label className='mt-3 mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/80'>Animation</Label>
                <Select value={selected.effect ?? 'none'} onValueChange={(next) => next && patch({ effect: next as EdgeEffect })}>
                  <SelectTrigger className='h-9 w-full border-border bg-muted/30 px-3 text-left hover:bg-accent focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'>
                    <span className='flex-1 truncate text-[11px] font-semibold text-foreground'>{EDGE_EFFECTS.find((option) => option.value === (selected.effect ?? 'none'))?.label}</span>
                  </SelectTrigger>
                  <SelectContent className='max-h-72 border-cyan-400/25 bg-popover p-1.5'>
                    <SelectGroup>
                      <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground'>Animation</SelectLabel>
                      {EDGE_EFFECTS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className='gap-2.5 px-2.5 py-2 pr-9'>
                          <span className='grid size-7 shrink-0 place-items-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'>
                            <option.Icon size={13} />
                          </span>
                          <span className='min-w-0 flex-1'>
                            <span className='block text-[11px] font-semibold'>{option.label}</span>
                            <span className='block truncate text-[9px] text-muted-foreground'>{option.description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    removeEdgeStyle(selected.id);
                    setSelectedId(null);
                  }}
                  className='mt-5 w-full border-rose-400/40 bg-rose-500/10 text-[11px] text-rose-700 hover:bg-rose-500/20 dark:text-rose-200'
                >
                  <Trash2 size={12} /> Delete this style
                </Button>
                <p className='mt-1.5 mb-4 text-[9px] leading-relaxed text-muted-foreground'>The {usageOf(selected.id)} line{usageOf(selected.id) === 1 ? '' : 's'} following it keep exactly the look they have now — only the shared name goes away.</p>
              </div>
            )}
          </div>
        )}

        <div className='flex shrink-0 items-center justify-end gap-2 border-t border-border px-8 py-4'>
          <Button type='button' variant='accent' size='xs' onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LineStyleToggle({ value, onChange }: { value: EdgeLineStyle; onChange: (next: EdgeLineStyle) => void }) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const picked = next.at(-1);
        if (picked) onChange(picked as EdgeLineStyle);
      }}
      variant='outline'
      size='sm'
      spacing={1}
      className='grid w-full grid-cols-3 rounded-xl bg-muted/40 p-1.5 ring-1 ring-border'
    >
      {LINE_STYLE_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-pressed={value === option.value}
          className={['h-9 w-full flex-col gap-1 border-border bg-transparent text-[10px] font-semibold', value === option.value ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-700 dark:text-cyan-100' : 'text-muted-foreground hover:bg-accent hover:text-foreground'].join(' ')}
        >
          <EdgeStyleSample color='currentColor' width={2} lineStyle={option.value} length={40} />
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
