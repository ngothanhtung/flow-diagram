'use client';

// Shared building blocks for the three inspector panels (block, text,
// group). Anything used by more than one panel lives here, so a panel
// file contains only what makes that node kind different.

import { AlignCenter, AlignLeft, AlignRight, Blend, Copy, RotateCcw, Square, Trash2, Ungroup, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { FlowNode, NodeFont } from '@/lib/flowchart-types';
import { SHAPES, nodeSizeLimits, type NodeShape } from '@/lib/node-style';
import { NODE_FONT_FAMILIES, NODE_FONT_OPTIONS } from '@/lib/node-fonts';

/** Every panel takes the same handle on the document. */
export interface InspectorPanelProps {
  node: FlowNode;
  onUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Title of the frame this node sits in, when it sits in one. */
  parentTitle?: string | null;
}

// Ten presets, one per hue: a themed foreground (text / icon / border)
// paired with the deep background it reads well on. Deliberately one
// shade each — three shades of ten hues was thirty swatches nobody
// scanned, and any colour outside the set is now reachable through the
// custom colour picker on every ColorField.
export const COLOR_PRESETS = [
  { name: 'Red', foreground: '#fca5a5', background: '#2a0a0a' },
  { name: 'Orange', foreground: '#fdba74', background: '#2a1005' },
  { name: 'Amber', foreground: '#fde047', background: '#281c04' },
  { name: 'Green', foreground: '#86efac', background: '#052e16' },
  { name: 'Teal', foreground: '#5eead4', background: '#042f2e' },
  { name: 'Cyan', foreground: '#67e8f9', background: '#083344' },
  { name: 'Blue', foreground: '#93c5fd', background: '#0a1f4c' },
  { name: 'Indigo', foreground: '#a5b4fc', background: '#12104a' },
  { name: 'Purple', foreground: '#d8b4fe', background: '#1e0437' },
  { name: 'Pink', foreground: '#f9a8d4', background: '#330515' },
] as const satisfies ReadonlyArray<{ name: string; foreground: `#${string}`; background: `#${string}` }>;

export const PRESET_FOREGROUNDS: `#${string}`[] = ['#ffffff', ...COLOR_PRESETS.map((preset) => preset.foreground)];
export const PRESET_BACKGROUNDS: `#${string}`[] = COLOR_PRESETS.map((preset) => preset.background);

/**
 * Draft state for one text field on the node.
 *
 * Clicking outside the panel deselects the node, which unmounts the panel
 * before the input's blur event fires — so commit-on-blur alone loses the
 * last edit. The ref mirror lets the cleanup flush whatever the user had
 * typed, whether or not blur ever ran.
 */
export function useNodeFieldDraft(node: FlowNode, field: 'title' | 'description', onUpdate: InspectorPanelProps['onUpdate']) {
  const [value, setValue] = useState(node[field] ?? '');

  const nodeRef = useRef(node);
  const onUpdateRef = useRef(onUpdate);
  const valueRef = useRef(value);

  useEffect(() => {
    nodeRef.current = node;
    onUpdateRef.current = onUpdate;
    valueRef.current = value;
  });

  useEffect(() => {
    return () => {
      const current = nodeRef.current;
      if (valueRef.current !== (current[field] ?? '')) {
        onUpdateRef.current(current.id, { [field]: valueRef.current });
      }
    };
  }, [field]);

  const commit = () => {
    if (value !== (node[field] ?? '')) onUpdate(node.id, { [field]: value });
  };

  return { value, setValue, commit };
}

/** Panel shell: the card, the heading and the node id. */
export function InspectorShell({ title, nodeId, children }: { title: string; nodeId: string; children: React.ReactNode }) {
  return (
    <Card size='sm' className='gap-0 bg-zinc-900/70 py-3 pr-3 pl-1 ring-0'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>{title}</h2>
      </div>
      <p className='mt-1 mb-2 text-[10px] uppercase tracking-wider text-zinc-500'>{nodeId}</p>
      <hr />
      {children}
    </Card>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <div className='mt-4 flex items-center gap-2'>
      <span className='text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/80'>{children}</span>
      <Separator className='flex-1 bg-white/8' />
    </div>
  );
}

/** Position + size, clamped to whatever this node kind allows. */
export function GeometryFields({ node, onUpdate, width, height }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; width: number; height: number }) {
  // Same limits the renderer clamps to, so typing an exact size can
  // reach what dragging a corner can.
  const limits = nodeSizeLimits(node);
  return (
    <>
      <SectionLabel>Geometry</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-zinc-500'>Drag one of the 4 corner handles, or enter an exact size below.</p>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <NumberField label='X' value={Math.round(node.position.x)} onChange={(x) => onUpdate(node.id, { position: { ...node.position, x } })} />
        <NumberField label='Y' value={Math.round(node.position.y)} onChange={(y) => onUpdate(node.id, { position: { ...node.position, y } })} />
        <NumberField label='Width' value={width} min={limits.minWidth} max={limits.maxWidth} onChange={(nextWidth) => onUpdate(node.id, { width: nextWidth })} />
        <NumberField label='Height' value={height} min={limits.minHeight} max={limits.maxHeight} onChange={(nextHeight) => onUpdate(node.id, { height: nextHeight })} />
      </div>
    </>
  );
}

/** Font family, size and weight — every panel renders text of some kind. */
export function TypographyFields({
  node,
  onUpdate,
  fontFamily,
  fontSize,
  fontWeight,
}: {
  node: FlowNode;
  onUpdate: InspectorPanelProps['onUpdate'];
  fontFamily: NodeFont;
  fontSize: number;
  fontWeight: NonNullable<FlowNode['fontWeight']>;
}) {
  return (
    <>
      <SectionLabel>Typography</SectionLabel>
      <Select
        value={fontFamily}
        onValueChange={(nextValue) => {
          if (nextValue) onUpdate(node.id, { fontFamily: nextValue as NodeFont });
        }}
      >
        <SelectTrigger className='mt-1.5 h-auto w-full border-white/10 bg-white/5 px-2.5 py-2 text-left hover:bg-white/8 focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'>
          <span className='min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-200' style={{ fontFamily: NODE_FONT_FAMILIES[fontFamily] }}>
            {NODE_FONT_OPTIONS.find((option) => option.value === fontFamily)?.character}
            <span className='ml-1 font-normal text-zinc-500'>({NODE_FONT_OPTIONS.find((option) => option.value === fontFamily)?.label})</span>
          </span>
        </SelectTrigger>
        <SelectContent className='border-white/10 bg-zinc-950 p-1.5'>
          <SelectGroup>
            <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600'>Typography</SelectLabel>
            {NODE_FONT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className='px-2.5 py-2 pr-8'>
                <span className='truncate text-[11px] font-semibold' style={{ fontFamily: NODE_FONT_FAMILIES[option.value] }}>
                  {option.character}
                  <span className='ml-1 font-normal text-zinc-500'>({option.label})</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <NumberField label='Font size' value={fontSize} min={10} max={28} onChange={(nextSize) => onUpdate(node.id, { fontSize: nextSize })} />
        <div>
          <Label className='mb-1 block text-[9px] text-zinc-500'>Weight</Label>
          <Select
            value={fontWeight}
            onValueChange={(nextValue) => {
              if (nextValue) onUpdate(node.id, { fontWeight: nextValue as FlowNode['fontWeight'] });
            }}
          >
            <SelectTrigger className='w-full border-white/10 bg-white/5 text-[11px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-white/10 bg-zinc-950'>
              <SelectItem value='normal'>Normal</SelectItem>
              <SelectItem value='medium'>Medium</SelectItem>
              <SelectItem value='semibold'>Semibold</SelectItem>
              <SelectItem value='bold'>Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}

/**
 * Flat vs sheen body fill. Only offered on the panels whose node paints a
 * body — a text object has none, so it never sees this.
 */
export function FillField({ node, onUpdate, fill }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; fill: 'flat' | 'sheen' }) {
  return (
    <SegmentedButtons
      label='Fill'
      value={fill}
      options={[
        { value: 'flat', label: 'Flat colour', Icon: Square },
        { value: 'sheen', label: 'Gradient sheen', Icon: Blend },
      ]}
      onChange={(nextFill) => onUpdate(node.id, { fill: nextFill })}
    />
  );
}

/** Horizontal alignment of the node's own text. */
export function TextAlignField({ node, onUpdate, textAlign }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; textAlign: 'left' | 'center' | 'right' }) {
  return (
    <SegmentedButtons
      label='Text'
      value={textAlign}
      options={[
        { value: 'left', label: 'Left', Icon: AlignLeft },
        { value: 'center', label: 'Center', Icon: AlignCenter },
        { value: 'right', label: 'Right', Icon: AlignRight },
      ]}
      onChange={(nextAlign) => onUpdate(node.id, { textAlign: nextAlign })}
    />
  );
}

/**
 * Shown on any node that sits inside a group frame — a block, a text
 * object, or a nested frame — so leaving a group works the same
 * everywhere.
 */
export function GroupMembershipSection({ node, onUpdate, parentTitle }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; parentTitle: string | null }) {
  if (!node.parentId) return null;
  return (
    <>
      <SectionLabel>Group</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-zinc-500'>
        Inside <span className='text-zinc-300'>{parentTitle ?? 'a group'}</span>. Drag it out of the frame to leave, or:
      </p>
      <div className='mt-2'>
        <Button variant='outline' size='sm' onClick={() => onUpdate(node.id, { parentId: undefined })} className='border-white/10 bg-white/5 px-2 text-[10px] text-zinc-300 hover:bg-white/10'>
          <Ungroup size={11} /> Remove from group
        </Button>
      </div>
    </>
  );
}

/** Duplicate / Reset styling / Delete — identical on every panel. */
export function ActionsSection({ node, onUpdate, onDuplicate, onDelete }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <>
      <SectionLabel>Actions</SectionLabel>
      <div className='mt-1.5 grid grid-cols-3 gap-2'>
        <Button variant='outline' size='sm' onClick={() => onDuplicate(node.id)} className='border-white/10 bg-white/5 px-2 text-[10px] text-zinc-200 hover:bg-white/10'>
          <Copy size={12} /> Duplicate
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            onUpdate(node.id, {
              width: undefined,
              height: undefined,
              rotation: undefined,
              sortOrder: undefined,
              shape: undefined,
              color: undefined,
              backgroundColor: undefined,
              borderColor: undefined,
              borderWidth: undefined,
              borderStyle: undefined,
              opacity: undefined,
              fill: undefined,
              shadow: undefined,
              icon: undefined,
              iconSize: undefined,
              iconPosition: undefined,
              blockAlign: undefined,
              fontSize: undefined,
              fontFamily: undefined,
              fontWeight: undefined,
              textAlign: undefined,
              portSize: undefined,
              connectionPoints: undefined,
              effect: undefined,
              effectColor: undefined,
              effectSpeed: undefined,
              effectIntensity: undefined,
              // `table` is content, not styling — Reset leaves it alone.
              // So is `parentId`: resetting the look shouldn't eject a
              // node from its frame.
            })
          }
          className='border-white/10 bg-white/5 px-2 text-[10px] text-zinc-300 hover:bg-white/10'
        >
          <RotateCcw size={11} /> Reset
        </Button>
        <Button variant='destructive' size='sm' onClick={() => onDelete(node.id)} className='px-2 text-[10px]'>
          <Trash2 size={12} /> Delete
        </Button>
      </div>
    </>
  );
}

// --- Primitive fields -----------------------------------------------------

export function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return (
    <div>
      <Label className='mb-1 block text-[9px] text-zinc-500'>{label}</Label>
      <Input
        type='number'
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          if (!Number.isNaN(event.target.valueAsNumber)) {
            onChange(event.target.valueAsNumber);
          }
        }}
        className='h-8 border-white/10 bg-white/5 font-mono text-[11px] text-zinc-200 focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />
    </div>
  );
}

export function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className='mt-2'>
      <span className='flex items-center justify-between text-[10px] text-zinc-500'>
        <span>{label}</span>
        <span className='font-mono text-zinc-300'>
          {value}
          {suffix}
        </span>
      </span>
      <Slider value={value} min={min} max={max} onValueChange={(nextValue) => onChange(nextValue as number)} className='mt-2 **:data-[slot=slider-range]:bg-sky-400 [&_[data-slot=slider-thumb]]:border-sky-300' />
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <div>
      <Label className='mb-1 block text-[9px] text-zinc-500'>{label}</Label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as T);
        }}
      >
        <SelectTrigger className='w-full border-white/10 bg-white/5 text-[11px] capitalize'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className='border-white/10 bg-zinc-950'>
          {options.map((option) => (
            <SelectItem key={option} value={option} className='capitalize'>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SegmentedButtons<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; Icon: LucideIcon }[]; onChange: (value: T) => void }) {
  return (
    <div className='mt-2 grid grid-cols-[70px_1fr] items-center gap-2'>
      <span className='text-[10px] text-zinc-500'>{label}</span>
      <ToggleGroup
        value={[value]}
        onValueChange={(nextValue) => {
          const selected = nextValue.at(-1);
          if (selected) onChange(selected as T);
        }}
        spacing={1}
        variant='outline'
        size='sm'
        className='w-full'
      >
        {options.map(({ value: option, label: optionLabel, Icon }) => (
          <ToggleGroupItem key={option} value={option} title={optionLabel} className={['h-7 flex-1 border-white/10 bg-white/5 p-0', value === option ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : 'text-zinc-500 hover:text-zinc-200'].join(' ')}>
            <Icon size={13} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * `<input type="color">` only accepts `#rrggbb`. Node colours are normally
 * that already, but a transparent fill is stored as 8-digit `#rrggbbaa`,
 * so the alpha is dropped for the swatch rather than handing the input a
 * value it silently rejects.
 */
function toSwatchHex(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex.slice(0, 7);
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return '#000000';
}

/** Accepts `#abc`, `#aabbcc`, `#aabbccdd` or the same without the hash. */
function parseHex(raw: string): `#${string}` | null {
  const hex = raw.trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` as `#${string}`;
  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return hex as `#${string}`;
  return null;
}

/**
 * A colour: the ten presets for speed, plus a native colour picker and a
 * hex field so any value at all is reachable. The hex box keeps a local
 * draft so a half-typed value never reaches the document, and reverts if
 * what was typed isn't a colour.
 */
export function ColorField({ label, value, presets, onChange }: { label: string; value: `#${string}`; presets: `#${string}`[]; onChange: (value: `#${string}`) => void }) {
  const [draft, setDraft] = useState<string>(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    // The colour changed underneath us (a preset click, a logo import):
    // resync the draft during render rather than from an effect, so the
    // field never paints a frame of stale text.
    setSyncedValue(value);
    setDraft(value);
  }

  const commit = () => {
    const parsed = parseHex(draft);
    if (parsed) onChange(parsed);
    else setDraft(value);
  };

  return (
    <div className='rounded-lg border border-white/10 bg-white/5 p-2'>
      <Label className='block text-[10px] text-zinc-500'>{label}</Label>
      <div className='mt-1 flex items-center gap-1.5'>
        <input
          type='color'
          aria-label={`${label} — pick any colour`}
          title='Pick any colour'
          value={toSwatchHex(value)}
          onChange={(event) => onChange(event.target.value as `#${string}`)}
          className='size-7 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0'
        />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
          aria-label={`${label} — hex value`}
          className='h-7 border-white/10 bg-zinc-800/80 px-1.5 font-mono text-[10px] uppercase text-zinc-300 focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
        />
      </div>
      <div className='mt-1.5 flex flex-wrap gap-1'>
        {presets.map((preset) => (
          <button
            key={preset}
            type='button'
            onClick={() => onChange(preset)}
            title={preset}
            aria-label={preset}
            className={cn('size-4 rounded-full border transition hover:scale-115', preset.toLowerCase() === value.toLowerCase() ? 'border-2 border-sky-300' : 'border-white/20')}
            style={{ background: preset }}
          />
        ))}
      </div>
    </div>
  );
}

/** Preview uses the same production contour as the canvas node. */
export function ShapeThumb({ shape, fill, stroke }: { shape: NodeShape; fill: string; stroke: string }) {
  const detail = (() => {
    switch (shape) {
      case 'database':
        return <path d='M -56 -34 C -56 -19 56 -19 56 -34 M -56 2 C -56 17 56 17 56 2' />;
      case 'server':
        return <path d='M -56 -19 H 56 M -56 19 H 56' />;
      case 'queue':
        return <path d='M -56 -46 H 46 V 56 M -34 -16 H 34 M -34 0 H 34 M -34 16 H 34' />;
      case 'component':
        return <path d='M -46 -19 H -26 V -8 H -46 Z M -46 8 H -26 V 19 H -46 Z' />;
      case 'predefined-process':
        return <path d='M -38 -56 V 56 M 38 -56 V 56' />;
      case 'internal-storage':
        return <path d='M -38 -56 V 56 M -56 -37 H 56' />;
      case 'note':
        return <path d='M 23 -56 V -23 H 56' />;
      case 'multi-document':
        return <path d='M -44 -56 H 56 V 28 C 28 14 -14 42 -44 30' />;
      case 'delay':
        return <path d='M 27 -56 C 6 -42 6 42 27 56' />;
      case 'circle-x':
        return <path d='M -34 -34 L 34 34 M 34 -34 L -34 34' />;
      case 'circle-plus':
        return <path d='M 0 -40 V 40 M -40 0 H 40' />;
      default:
        return null;
    }
  })();

  return (
    <svg width={30} height={30} viewBox='-68 -68 136 136' aria-hidden='true'>
      <path d={SHAPES[shape].d} fill={fill} stroke={stroke} strokeWidth={5} strokeLinejoin='round' />
      {detail && (
        <g fill='none' stroke={stroke} strokeWidth={4} opacity={0.9}>
          {detail}
        </g>
      )}
    </svg>
  );
}
