'use client';

import { AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, PanelLeft, PanelRight, PanelTop, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconPicker } from '@/components/IconPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ConnectionSide, FlowNode, NodeFont } from '@/lib/flowchart-types';
import { COLORS, SHAPES, resolveNodeStyle, type NodeColor, type NodeIcon, type NodeShape } from '@/lib/node-style';
import { NODE_FONT_FAMILIES, NODE_FONT_OPTIONS } from '@/lib/node-fonts';

interface NodeInspectorProps {
  node: FlowNode | null;
  onUpdate: (id: string, patch: Partial<Omit<FlowNode, 'id'>>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const COLOR_HEX: Record<NodeColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  pink: '#ec4899',
  rose: '#f43f5e',
  brown: '#a97142',
  coral: '#ff6f61',
};

// Text / icon and Border share the same light-tint palette; Background uses deep tones.
// White is the default and always comes first.
const PRESET_FOREGROUNDS: `#${string}`[] = ['#ffffff', ...(Object.keys(COLORS) as NodeColor[]).map((colorKey) => COLORS[colorKey].foreground as `#${string}`)];
const PRESET_BACKGROUNDS = (Object.keys(COLORS) as NodeColor[]).map((colorKey) => COLORS[colorKey].background as `#${string}`);

const SIDES: {
  value: ConnectionSide;
  label: string;
  Icon: typeof ArrowUp;
}[] = [
  { value: 'top', label: 'Top', Icon: ArrowUp },
  { value: 'right', label: 'Right', Icon: ArrowRight },
  { value: 'bottom', label: 'Bottom', Icon: ArrowDown },
  { value: 'left', label: 'Left', Icon: ArrowLeft },
];

export function NodeInspector({ node, onUpdate, onDuplicate, onDelete, onClose }: NodeInspectorProps) {
  // Local draft so the user can type without every keystroke mutating
  // the document. Commit on blur, Enter, or type change.
  const [title, setTitle] = useState(node?.title ?? '');
  const [description, setDescription] = useState(node?.description ?? '');

  // Clicking outside the panel deselects the node, which unmounts this
  // component (see the `key={selectedNode.id}` + conditional render in
  // page.tsx) before the input's blur event has a chance to fire — so
  // the commit-on-blur handlers below never run and the draft is lost.
  // Refs always hold the latest values so this cleanup can flush them
  // on unmount regardless of whether blur fired.
  const nodeRef = useRef(node);
  const onUpdateRef = useRef(onUpdate);
  const titleRef = useRef(title);
  const descriptionRef = useRef(description);

  useEffect(() => {
    nodeRef.current = node;
    onUpdateRef.current = onUpdate;
    titleRef.current = title;
    descriptionRef.current = description;
  });

  useEffect(() => {
    return () => {
      const current = nodeRef.current;
      if (!current) return;
      if (titleRef.current !== current.title) {
        onUpdateRef.current(current.id, { title: titleRef.current });
      }
      if (descriptionRef.current !== (current.description ?? '')) {
        onUpdateRef.current(current.id, { description: descriptionRef.current });
      }
    };
  }, []);

  if (!node) {
    return (
      <Card size='sm' className='gap-0 bg-zinc-900/70 py-3 pr-3 pl-1 ring-0'>
        <h2 className='text-sm font-semibold'>Inspector</h2>
        <p className='mt-1 text-[11px] leading-relaxed text-zinc-500'>Click a node to inspect and edit it. Drag from a node&apos;s output port to another node&apos;s input port to connect them.</p>
      </Card>
    );
  }

  const style = resolveNodeStyle(node);
  const currentShape: NodeShape = style.shape;
  const currentIcon: NodeIcon | null = style.icon;
  const connectionPoints = node.connectionPoints ?? {
    input: 'left' as const,
    output: 'right' as const,
  };

  return (
    <Card size='sm' className='gap-0 bg-zinc-900/70 py-3 pr-3 pl-1 ring-0'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>Inspector</h2>
        <Button variant='ghost' size='xs' onClick={onClose} className='text-[10px] text-zinc-500 hover:text-zinc-200'>
          close
        </Button>
      </div>

      <p className='mt-1 text-[10px] uppercase tracking-wider text-zinc-500'>{node.id}</p>

      <Label htmlFor='node-title' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
        Title
      </Label>
      <Input
        id='node-title'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== node.title) onUpdate(node.id, { title });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className='mt-1 border-white/10 bg-zinc-800/80 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <Label htmlFor='node-subtitle' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
        Sub title
      </Label>
      <Textarea
        id='node-subtitle'
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== (node.description ?? '')) {
            onUpdate(node.id, { description });
          }
        }}
        rows={2}
        className='mt-1 min-h-14 resize-none border-white/10 bg-zinc-800/80 text-xs focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <SectionLabel>Geometry</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-zinc-500'>Drag one of the 4 corner handles, or enter an exact size below.</p>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <NumberField label='X' value={Math.round(node.position.x)} onChange={(x) => onUpdate(node.id, { position: { ...node.position, x } })} />
        <NumberField label='Y' value={Math.round(node.position.y)} onChange={(y) => onUpdate(node.id, { position: { ...node.position, y } })} />
        <NumberField label='Width' value={style.width} min={72} max={320} onChange={(width) => onUpdate(node.id, { width })} />
        <NumberField label='Height' value={style.height} min={72} max={240} onChange={(height) => onUpdate(node.id, { height })} />
      </div>
      <NumberField label='Sort order · 0 = auto' value={node.sortOrder ?? 0} min={0} step={1} onChange={(sortOrder) => onUpdate(node.id, { sortOrder: sortOrder > 0 ? sortOrder : undefined })} />

      <SectionLabel>Typography</SectionLabel>
      <Select
        value={style.fontFamily}
        onValueChange={(nextValue) => {
          if (nextValue) onUpdate(node.id, { fontFamily: nextValue as NodeFont });
        }}
      >
        <SelectTrigger className='mt-1.5 h-auto w-full border-white/10 bg-white/5 px-2.5 py-2 text-left hover:bg-white/8 focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'>
          <span className='min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-200' style={{ fontFamily: NODE_FONT_FAMILIES[style.fontFamily] }}>
            {NODE_FONT_OPTIONS.find((option) => option.value === style.fontFamily)?.character}
            <span className='ml-1 font-normal text-zinc-500'>({NODE_FONT_OPTIONS.find((option) => option.value === style.fontFamily)?.label})</span>
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
        <NumberField label='Font size' value={style.fontSize} min={10} max={28} onChange={(fontSize) => onUpdate(node.id, { fontSize })} />
        <div>
          <Label className='mb-1 block text-[9px] text-zinc-500'>Weight</Label>
          <Select
            value={style.fontWeight}
            onValueChange={(nextValue) => {
              if (nextValue) {
                onUpdate(node.id, { fontWeight: nextValue as FlowNode['fontWeight'] });
              }
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

      {/* --- Shape ------------------------------------------------- */}
      <label className='mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>Shape</label>
      <Select
        value={currentShape}
        onValueChange={(nextValue) => {
          if (nextValue) onUpdate(node.id, { shape: nextValue as NodeShape });
        }}
      >
        <SelectTrigger className='mt-1.5 h-auto w-full gap-2.5 border-white/10 bg-zinc-800 px-3 py-2.5 text-left hover:bg-zinc-700/80 focus-visible:border-violet-400/50 focus-visible:ring-violet-400/15'>
          <span className='grid size-7 shrink-0 place-items-center rounded-md bg-black/20 text-violet-200'>
            <ShapeThumb shape={currentShape} fill={style.background} stroke={style.foreground} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-xs font-semibold'>{SHAPES[currentShape].label}</span>
          </span>
        </SelectTrigger>
        <SelectContent className='max-h-72 min-w-[290px] border-violet-400/25 bg-zinc-950 p-1.5'>
          {(Object.keys(SHAPES) as NodeShape[]).map((shapeKey) => {
            const spec = SHAPES[shapeKey];
            return (
              <SelectItem key={shapeKey} value={shapeKey} className='gap-2.5 px-2.5 py-2 pr-9'>
                <span className='grid size-7 shrink-0 place-items-center rounded-md bg-black/25 text-violet-200'>
                  <ShapeThumb shape={shapeKey} fill={style.background} stroke={style.foreground} />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-[11px] font-semibold'>{spec.label}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* --- Color ------------------------------------------------- */}
      <label className='mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>Color preset</label>
      <div className='mt-1 flex flex-wrap gap-1.5'>
        {(Object.keys(COLORS) as NodeColor[]).map((colorKey) => {
          const spec = COLORS[colorKey];
          const isActive = style.foreground === spec.foreground && style.background === spec.background && style.borderColor === spec.foreground;
          return (
            <Button
              key={colorKey}
              variant='outline'
              size='icon-sm'
              onClick={() =>
                onUpdate(node.id, {
                  color: spec.foreground,
                  backgroundColor: spec.background,
                  borderColor: spec.foreground,
                })
              }
              title={colorKey}
              className={['relative size-7 overflow-hidden rounded-full border-white/15 p-0 transition', isActive ? 'border-2 border-sky-300' : 'hover:scale-110'].join(' ')}
              style={{ background: spec.background }}
            >
              <span className='absolute inset-[7px] rounded-full' style={{ background: COLOR_HEX[colorKey] }} />
            </Button>
          );
        })}
      </div>

      <div className='mt-2 grid grid-cols-2 gap-2'>
        <ColorField label='Text / icon · Border' value={style.foreground} presets={PRESET_FOREGROUNDS} onChange={(color) => onUpdate(node.id, { color, borderColor: color })} />
        <ColorField label='Background' value={style.background} presets={PRESET_BACKGROUNDS} onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
        <NumberField label='Border width' value={style.borderWidth} min={0} max={8} step={0.5} onChange={(borderWidth) => onUpdate(node.id, { borderWidth })} />
      </div>
      <div className='mt-2 grid grid-cols-2 gap-2'>
        <SelectField label='Border style' value={style.borderStyle} options={['solid', 'dashed', 'dotted']} onChange={(borderStyle) => onUpdate(node.id, { borderStyle })} />
        <SelectField label='Shadow' value={style.shadow} options={['none', 'soft', 'glow']} onChange={(shadow) => onUpdate(node.id, { shadow })} />
      </div>
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      {/* --- Icon -------------------------------------------------- */}
      <label className='mt-3 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>Icon</label>
      <IconPicker value={currentIcon} onChange={(icon) => onUpdate(node.id, { icon })} />
      {currentIcon !== null && <RangeField label='Icon size' value={style.iconSize} min={12} max={48} suffix='px' onChange={(iconSize) => onUpdate(node.id, { iconSize })} />}

      <SectionLabel>Alignment</SectionLabel>
      {currentIcon !== null && (
        <SegmentedButtons
          label='Icon'
          value={style.iconPosition}
          options={[
            { value: 'top', label: 'Top', Icon: PanelTop },
            { value: 'left', label: 'Left', Icon: PanelLeft },
            { value: 'right', label: 'Right', Icon: PanelRight },
          ]}
          onChange={(iconPosition) => onUpdate(node.id, { iconPosition })}
        />
      )}
      <SegmentedButtons
        label='Block'
        value={style.blockAlign}
        options={[
          { value: 'left', label: 'Left', Icon: AlignHorizontalJustifyStart },
          { value: 'center', label: 'Center', Icon: AlignHorizontalJustifyCenter },
          { value: 'right', label: 'Right', Icon: AlignHorizontalJustifyEnd },
        ]}
        onChange={(blockAlign) => onUpdate(node.id, { blockAlign })}
      />
      <SegmentedButtons
        label='Text'
        value={style.textAlign}
        options={[
          { value: 'left', label: 'Left', Icon: AlignLeft },
          { value: 'center', label: 'Center', Icon: AlignCenter },
          { value: 'right', label: 'Right', Icon: AlignRight },
        ]}
        onChange={(textAlign) => onUpdate(node.id, { textAlign })}
      />

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
    </Card>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className='mt-4 flex items-center gap-2'>
      <span className='text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/80'>{children}</span>
      <Separator className='flex-1 bg-white/8' />
    </div>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
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

function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className='mt-2'>
      <span className='flex items-center justify-between text-[10px] text-zinc-500'>
        <span>{label}</span>
        <span className='font-mono text-zinc-300'>
          {value}
          {suffix}
        </span>
      </span>
      <Slider value={value} min={min} max={max} onValueChange={(nextValue) => onChange(nextValue as number)} className='mt-2 [&_[data-slot=slider-range]]:bg-sky-400 [&_[data-slot=slider-thumb]]:border-sky-300' />
    </div>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
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

function SegmentedButtons<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; Icon: LucideIcon }[]; onChange: (value: T) => void }) {
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

function ColorField({ label, value, presets, onChange }: { label: string; value: `#${string}`; presets: `#${string}`[]; onChange: (value: `#${string}`) => void }) {
  const isPreset = presets.some((preset) => preset.toLowerCase() === value.toLowerCase());
  return (
    <div className='rounded-lg border border-white/10 bg-white/5 p-2'>
      <Label className='block text-[10px] text-zinc-500'>{label}</Label>
      <Select
        value={isPreset ? value : undefined}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as `#${string}`);
        }}
      >
        <SelectTrigger className='mt-1 h-auto w-full border-white/10 bg-zinc-800/80 px-2 py-1.5 hover:bg-zinc-700/60 focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'>
          <SelectValue placeholder={<span className='text-[10px] text-zinc-500'>Custom</span>}>
            <span className='flex items-center gap-2'>
              <span className='size-4 shrink-0 rounded border border-white/20' style={{ background: value }} />
              <span className='font-mono text-[10px] uppercase text-zinc-300'>{value}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className='border-white/10 bg-zinc-950 p-1.5'>
          {presets.map((preset) => (
            <SelectItem key={preset} value={preset} className='px-2 py-1.5'>
              <span className='flex items-center gap-2'>
                <span className='size-4 shrink-0 rounded border border-white/15' style={{ background: preset }} />
                <span className='font-mono text-[10px] uppercase text-zinc-300'>{preset}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ConnectionSidePicker({ label, value, onChange }: { label: string; value: ConnectionSide; onChange: (value: ConnectionSide) => void }) {
  return (
    <div className='mt-1.5 grid grid-cols-[52px_1fr] items-center gap-2'>
      <span className='text-[10px] text-zinc-500'>{label}</span>
      <ToggleGroup
        value={[value]}
        onValueChange={(nextValue) => {
          const selected = nextValue.at(-1);
          if (selected) onChange(selected as ConnectionSide);
        }}
        spacing={1}
        variant='outline'
        size='sm'
        className='grid w-full grid-cols-4'
      >
        {SIDES.map(({ value: side, label: sideLabel, Icon }) => (
          <ToggleGroupItem
            key={side}
            value={side}
            title={sideLabel}
            aria-label={`${label} connection on ${sideLabel}`}
            className={['h-7 w-full border-white/10 bg-white/5 p-0', value === side ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : 'text-zinc-500 hover:text-zinc-200'].join(' ')}
          >
            <Icon size={13} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Preview uses the same production contour as the canvas node. */
function ShapeThumb({ shape, fill, stroke }: { shape: NodeShape; fill: string; stroke: string }) {
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
