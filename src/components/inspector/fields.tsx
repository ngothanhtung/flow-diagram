'use client';

// Shared building blocks for the three inspector panels (block, text,
// group). Anything used by more than one panel lives here, so a panel
// file contains only what makes that node kind different.

import { AlignCenter, AlignLeft, AlignRight, Blend, Copy, RotateCcw, Shrink, Square, Trash2, Ungroup, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { FlowNode, NodeFont } from '@/lib/flowchart-types';
import { SHAPES, nodeSizeLimits, type NodeShape } from '@/lib/node-style';
import { useShortcutLabel } from '@/lib/use-is-mac';
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

// 36 presets: three shades of each of the 12 Ant Design hues
// (https://ant.design/docs/spec/colors — Dust Red, Volcano, Sunset Orange,
// Calendula Gold, Sunrise Yellow, Lime, Polar Green, Cyan, Daybreak Blue,
// Geek Blue, Purple, Magenta), each a themed foreground (text / icon /
// border) paired with the background it reads well on. Deliberately three
// shades each, not antd's full 10-step ramp — 120 swatches is nobody
// scanning a picker — and any colour outside the set is still reachable
// through the custom colour picker on every ColorField.
//
// Two theme variants exist because a pairing tuned for one canvas
// background is wrong on the other, and within each variant the "base",
// "deep" and "light" shade of a hue are pulled from different rungs of
// that hue's antd 10-step ramp:
//   dark base:  fg step-3 (pale tint)     / bg step-10 (near-black)
//   dark deep:  fg step-4 (soft pastel)   / bg step-9  (deep, one rung lighter)
//   dark light: fg step-2 (paler tint)    / bg step-8  (softer than base/deep)
//   light base:  fg step-7 (deep)         / bg step-1 (palest tint)
//   light deep:  fg step-9 (near-black)   / bg step-3 (stronger tint)
//   light light: fg step-5 (softer)       / bg step-2 (soft tint)
// `useColorPresets()` below picks the variant matching the app's current
// theme. This only changes what a *new* pick offers — a document's
// already-saved colours are literal data and never get rewritten by a
// theme switch.
type ColorPreset = { name: string; foreground: `#${string}`; background: `#${string}` };

const DARK_COLOR_PRESETS = [
  { name: 'Red', foreground: '#ffa39e', background: '#5c0011' },
  { name: 'Volcano', foreground: '#ffbb96', background: '#610b00' },
  { name: 'Orange', foreground: '#ffd591', background: '#612500' },
  { name: 'Gold', foreground: '#ffe58f', background: '#613400' },
  { name: 'Yellow', foreground: '#fffb8f', background: '#614700' },
  { name: 'Lime', foreground: '#eaff8f', background: '#254000' },
  { name: 'Green', foreground: '#b7eb8f', background: '#092b00' },
  { name: 'Cyan', foreground: '#87e8de', background: '#002329' },
  { name: 'Blue', foreground: '#91caff', background: '#001d66' },
  { name: 'Geekblue', foreground: '#adc6ff', background: '#030852' },
  { name: 'Purple', foreground: '#d3adf7', background: '#120338' },
  { name: 'Magenta', foreground: '#ffadd2', background: '#520339' },
  { name: 'Red · Deep', foreground: '#ff7875', background: '#820014' },
  { name: 'Volcano · Deep', foreground: '#ff9c6e', background: '#871400' },
  { name: 'Orange · Deep', foreground: '#ffc069', background: '#873800' },
  { name: 'Gold · Deep', foreground: '#ffd666', background: '#874d00' },
  { name: 'Yellow · Deep', foreground: '#fff566', background: '#876800' },
  { name: 'Lime · Deep', foreground: '#d3f261', background: '#3f6600' },
  { name: 'Green · Deep', foreground: '#95de64', background: '#135200' },
  { name: 'Cyan · Deep', foreground: '#5cdbd3', background: '#00474f' },
  { name: 'Blue · Deep', foreground: '#69b1ff', background: '#002c8c' },
  { name: 'Geekblue · Deep', foreground: '#85a5ff', background: '#061178' },
  { name: 'Purple · Deep', foreground: '#b37feb', background: '#22075e' },
  { name: 'Magenta · Deep', foreground: '#ff85c0', background: '#780650' },
  { name: 'Red · Light', foreground: '#ffccc7', background: '#a8071a' },
  { name: 'Volcano · Light', foreground: '#ffd8bf', background: '#ad2102' },
  { name: 'Orange · Light', foreground: '#ffe7ba', background: '#ad4e00' },
  { name: 'Gold · Light', foreground: '#fff1b8', background: '#ad6800' },
  { name: 'Yellow · Light', foreground: '#ffffb8', background: '#ad8b00' },
  { name: 'Lime · Light', foreground: '#f4ffb8', background: '#5b8c00' },
  { name: 'Green · Light', foreground: '#d9f7be', background: '#237804' },
  { name: 'Cyan · Light', foreground: '#b5f5ec', background: '#006d75' },
  { name: 'Blue · Light', foreground: '#bae0ff', background: '#003eb3' },
  { name: 'Geekblue · Light', foreground: '#d6e4ff', background: '#10239e' },
  { name: 'Purple · Light', foreground: '#efdbff', background: '#391085' },
  { name: 'Magenta · Light', foreground: '#ffd6e7', background: '#9e1068' },
] as const satisfies ReadonlyArray<ColorPreset>;

const LIGHT_COLOR_PRESETS = [
  { name: 'Red', foreground: '#cf1322', background: '#fff1f0' },
  { name: 'Volcano', foreground: '#d4380d', background: '#fff2e8' },
  { name: 'Orange', foreground: '#d46b08', background: '#fff7e6' },
  { name: 'Gold', foreground: '#d48806', background: '#fffbe6' },
  { name: 'Yellow', foreground: '#d4b106', background: '#feffe6' },
  { name: 'Lime', foreground: '#7cb305', background: '#fcffe6' },
  { name: 'Green', foreground: '#389e0d', background: '#f6ffed' },
  { name: 'Cyan', foreground: '#08979c', background: '#e6fffb' },
  { name: 'Blue', foreground: '#0958d9', background: '#e6f4ff' },
  { name: 'Geekblue', foreground: '#1d39c4', background: '#f0f5ff' },
  { name: 'Purple', foreground: '#531dab', background: '#f9f0ff' },
  { name: 'Magenta', foreground: '#c41d7f', background: '#fff0f6' },
  { name: 'Red · Deep', foreground: '#820014', background: '#ffa39e' },
  { name: 'Volcano · Deep', foreground: '#871400', background: '#ffbb96' },
  { name: 'Orange · Deep', foreground: '#873800', background: '#ffd591' },
  { name: 'Gold · Deep', foreground: '#874d00', background: '#ffe58f' },
  { name: 'Yellow · Deep', foreground: '#876800', background: '#fffb8f' },
  { name: 'Lime · Deep', foreground: '#3f6600', background: '#eaff8f' },
  { name: 'Green · Deep', foreground: '#135200', background: '#b7eb8f' },
  { name: 'Cyan · Deep', foreground: '#00474f', background: '#87e8de' },
  { name: 'Blue · Deep', foreground: '#002c8c', background: '#91caff' },
  { name: 'Geekblue · Deep', foreground: '#061178', background: '#adc6ff' },
  { name: 'Purple · Deep', foreground: '#22075e', background: '#d3adf7' },
  { name: 'Magenta · Deep', foreground: '#780650', background: '#ffadd2' },
  { name: 'Red · Light', foreground: '#ff4d4f', background: '#ffccc7' },
  { name: 'Volcano · Light', foreground: '#ff7a45', background: '#ffd8bf' },
  { name: 'Orange · Light', foreground: '#ffa940', background: '#ffe7ba' },
  { name: 'Gold · Light', foreground: '#ffc53d', background: '#fff1b8' },
  { name: 'Yellow · Light', foreground: '#ffec3d', background: '#ffffb8' },
  { name: 'Lime · Light', foreground: '#bae637', background: '#f4ffb8' },
  { name: 'Green · Light', foreground: '#73d13d', background: '#d9f7be' },
  { name: 'Cyan · Light', foreground: '#36cfc9', background: '#b5f5ec' },
  { name: 'Blue · Light', foreground: '#4096ff', background: '#bae0ff' },
  { name: 'Geekblue · Light', foreground: '#597ef7', background: '#d6e4ff' },
  { name: 'Purple · Light', foreground: '#9254de', background: '#efdbff' },
  { name: 'Magenta · Light', foreground: '#f759ab', background: '#ffd6e7' },
] as const satisfies ReadonlyArray<ColorPreset>;

/** The active theme's colour presets, for a freshly-picked colour. */
export function useColorPresets() {
  const { resolvedTheme } = useTheme();
  return { presets: resolvedTheme === 'light' ? LIGHT_COLOR_PRESETS : DARK_COLOR_PRESETS };
}

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
/**
 * One panel of the docked Inspector: a flat section like the Narration
 * preview's body — the kind as a small tag (the column's header strip
 * already says "Inspector"), the id under it, then the fields.
 */
export function InspectorShell({ title, nodeId, children }: { title: string; nodeId: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className='px-4 pt-3 pb-4'>
      <h2 className='text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-400'>{title.replace(/\s*inspector$/i, '')}</h2>
      <p className='mt-0.5 truncate font-mono text-[10px] text-muted-foreground'>{nodeId}</p>
      {children}
    </section>
  );
}

/**
 * The sections every Inspector panel is split into — one vocabulary, one
 * order. A panel shows only the sections its element has, but never renames
 * or reorders them, so a property sits in the same place whatever is selected.
 */
export const INSPECTOR_SECTIONS = {
  content: 'Content',
  members: 'Members',
  columns: 'Columns',
  relationship: 'Relationship',
  layout: 'Layout',
  typography: 'Typography',
  appearance: 'Appearance',
  icon: 'Icon',
  routing: 'Routing',
  replay: 'Replay',
  effect: 'Effect',
  group: 'Group',
  actions: 'Actions',
} as const;
export type InspectorSectionId = keyof typeof INSPECTOR_SECTIONS;
export const INSPECTOR_SECTION_ORDER = Object.keys(INSPECTOR_SECTIONS) as InspectorSectionId[];

/** A section's title: bright, bold, small caps with a short accent bar before it — the one look of every section heading (Inspector, Lesson panel, line-style palette). */
export const SECTION_TITLE_CLASS =
  'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground before:h-3 before:w-0.5 before:rounded-full before:bg-sky-500 before:content-[""]';

/**
 * One section of a panel: a hairline across the column, its name in the
 * small uppercase of the panel headers, an optional one-line hint and a
 * control on the right (e.g. Layout's Fit), then its fields.
 */
export function InspectorSection({ id, hint, aside, children }: { id: InspectorSectionId; hint?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section data-section={id} aria-label={INSPECTOR_SECTIONS[id]} className='-mx-4 mt-3 border-t border-border px-4 pt-3'>
      <div className='flex min-h-6 items-center justify-between gap-2'>
        <h3 className={SECTION_TITLE_CLASS}>{INSPECTOR_SECTIONS[id]}</h3>
        {aside}
      </div>
      {hint && <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>{hint}</p>}
      <div className='mt-2 flex flex-col gap-2'>{children}</div>
    </section>
  );
}

/** The label over a field — the one style every field in every panel uses. */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className='mb-1 block text-[10px] font-normal text-muted-foreground'>
      {children}
    </Label>
  );
}

/**
 * Position + size, clamped to whatever this node kind allows. `onFitToContent`
 * is only passed by panels whose node paints its own text/glyph (block, text,
 * icon) — a group frame fits to its *members* instead, via its own "Fit to
 * contents" action in `GroupInspector`, so it never sets this.
 */
export function LayoutSection({ node, onUpdate, width, height, onFitToContent, children }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; width: number; height: number; onFitToContent?: () => void; children?: React.ReactNode }) {
  // Same limits the renderer clamps to, so typing an exact size can
  // reach what dragging a corner can.
  const limits = nodeSizeLimits(node);
  return (
    <InspectorSection
      id='layout'
      hint='Drag one of the 4 corner handles, or enter an exact size.'
      aside={
        onFitToContent && (
          <Button variant='outline' size='sm' onClick={onFitToContent} className='h-6 shrink-0 border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'>
            <Shrink size={11} /> Fit
          </Button>
        )
      }
    >
      <div className='grid grid-cols-2 gap-2'>
        <NumberField label='X' value={Math.round(node.position.x)} onChange={(x) => onUpdate(node.id, { position: { ...node.position, x } })} />
        <NumberField label='Y' value={Math.round(node.position.y)} onChange={(y) => onUpdate(node.id, { position: { ...node.position, y } })} />
        <NumberField label='Width' value={width} min={limits.minWidth} max={limits.maxWidth} onChange={(nextWidth) => onUpdate(node.id, { width: nextWidth })} />
        <NumberField label='Height' value={height} min={limits.minHeight} max={limits.maxHeight} onChange={(nextHeight) => onUpdate(node.id, { height: nextHeight })} />
      </div>
      {children}
    </InspectorSection>
  );
}

/** Font family, size and weight (plus whatever the panel adds, e.g. text alignment). */
export function TypographySection({
  node,
  onUpdate,
  fontFamily,
  fontSize,
  fontWeight,
  children,
}: {
  node: FlowNode;
  onUpdate: InspectorPanelProps['onUpdate'];
  fontFamily: NodeFont;
  fontSize: number;
  fontWeight: NonNullable<FlowNode['fontWeight']>;
  children?: React.ReactNode;
}) {
  return (
    <InspectorSection id='typography'>
      <Select
        value={fontFamily}
        onValueChange={(nextValue) => {
          if (nextValue) onUpdate(node.id, { fontFamily: nextValue as NodeFont });
        }}
      >
        <SelectTrigger aria-label='Font' className='h-auto w-full border-border bg-muted/30 px-2.5 py-2 text-left hover:bg-accent focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'>
          <span className='min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground' style={{ fontFamily: NODE_FONT_FAMILIES[fontFamily] }}>
            {NODE_FONT_OPTIONS.find((option) => option.value === fontFamily)?.character}
            <span className='ml-1 font-normal text-muted-foreground'>({NODE_FONT_OPTIONS.find((option) => option.value === fontFamily)?.label})</span>
          </span>
        </SelectTrigger>
        <SelectContent className='border-border bg-popover p-1.5'>
          <SelectGroup>
            <SelectLabel className='px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground'>Typography</SelectLabel>
            {NODE_FONT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className='px-2.5 py-2 pr-8'>
                <span className='truncate text-[11px] font-semibold' style={{ fontFamily: NODE_FONT_FAMILIES[option.value] }}>
                  {option.character}
                  <span className='ml-1 font-normal text-muted-foreground'>({option.label})</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className='grid grid-cols-2 gap-2'>
        <NumberField label='Font size' value={fontSize} min={10} max={28} onChange={(nextSize) => onUpdate(node.id, { fontSize: nextSize })} />
        <div>
          <FieldLabel>Weight</FieldLabel>
          <Select
            value={fontWeight}
            onValueChange={(nextValue) => {
              if (nextValue) onUpdate(node.id, { fontWeight: nextValue as FlowNode['fontWeight'] });
            }}
          >
            <SelectTrigger className='w-full border-border bg-muted/30 text-[11px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-border bg-popover'>
              <SelectItem value='normal'>Normal</SelectItem>
              <SelectItem value='medium'>Medium</SelectItem>
              <SelectItem value='semibold'>Semibold</SelectItem>
              <SelectItem value='bold'>Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {children}
    </InspectorSection>
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
    <InspectorSection
      id='group'
      hint={
        <>
          Inside <span className='text-foreground'>{parentTitle ?? 'a group'}</span>. Drag it out of the frame to leave, or:
        </>
      }
    >
      <div>
        <Button variant='outline' size='sm' onClick={() => onUpdate(node.id, { parentId: undefined })} className='border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'>
          <Ungroup size={11} /> Remove from group
        </Button>
      </div>
    </InspectorSection>
  );
}

/** Duplicate / Reset styling / Delete — identical on every panel. */
export function ActionsSection({ node, onUpdate, onDuplicate, onDelete }: { node: FlowNode; onUpdate: InspectorPanelProps['onUpdate']; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  const duplicateKeys = useShortcutLabel(['mod', 'D']);
  return (
    <InspectorSection id='actions'>
      <div className='grid grid-cols-3 gap-2'>
        <Button variant='outline' size='sm' onClick={() => onDuplicate(node.id)} title={`Duplicate (${duplicateKeys})`} className='border-border bg-muted/30 px-2 text-[10px] text-foreground hover:bg-accent'>
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
          className='border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'
        >
          <RotateCcw size={11} /> Reset
        </Button>
        <Button variant='destructive' size='sm' onClick={() => onDelete(node.id)} title='Delete (Delete key)' className='px-2 text-[10px]'>
          <Trash2 size={12} /> Delete
        </Button>
      </div>
    </InspectorSection>
  );
}

// --- Primitive fields -----------------------------------------------------

/** What a number field should write for the text typed so far: the
 *  number when it is already in range, otherwise nothing yet. Writing an
 *  out-of-range keystroke (the "2" of "210" under a 72 minimum) would get
 *  clamped by the store and echoed back into the box mid-typing, so the
 *  next keystrokes would land on the clamped value instead. */
export function numberFieldLiveValue(text: string, min?: number, max?: number): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return null;
  return parsed;
}

/** What a number field commits on blur: the typed number clamped into
 *  range, or nothing for an empty / unparseable box (it reverts). */
export function numberFieldCommitValue(text: string, min?: number, max?: number): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
}

export function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  // While focused the box shows what the user is typing, not the stored
  // value — see `numberFieldLiveValue` for why those can differ.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type='number'
        value={draft ?? value}
        min={min}
        max={max}
        step={step}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => {
          setDraft(event.target.value);
          const live = numberFieldLiveValue(event.target.value, min, max);
          if (live !== null && live !== value) onChange(live);
        }}
        onBlur={() => {
          const committed = draft === null ? null : numberFieldCommitValue(draft, min, max);
          if (committed !== null && committed !== value) onChange(committed);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className='h-8 border-border bg-muted/30 font-mono text-[11px] text-foreground focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />
    </div>
  );
}

export function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div>
      <span className='flex items-center justify-between text-[10px] text-muted-foreground'>
        <span>{label}</span>
        <span className='font-mono text-muted-foreground'>
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
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as T);
        }}
      >
        <SelectTrigger className='w-full border-border bg-muted/30 text-[11px] capitalize'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className='border-border bg-popover'>
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
    <div className='grid grid-cols-[70px_1fr] items-center gap-2'>
      <span className='text-[10px] text-muted-foreground'>{label}</span>
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
          <ToggleGroupItem key={option} value={option} title={optionLabel} className={['h-7 flex-1 border-border bg-muted/30 p-0', value === option ? 'border-sky-400/60 bg-sky-500/20 text-sky-700 dark:text-sky-100' : 'text-muted-foreground hover:text-foreground'].join(' ')}>
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
 * What a colour field's hex box commits on blur: the typed colour, or
 * `null` when there is nothing to write — unparseable text (the box
 * reverts), or the colour the field already shows. The second case
 * matters: the field shows the *resolved* colour, so committing it
 * unchanged would bake a default the node never set into an explicit
 * value — a document change (and an undo step) that looks like nothing.
 */
export function colorFieldCommit(draft: string, current: string): `#${string}` | null {
  const parsed = parseHex(draft);
  if (!parsed || parsed.toLowerCase() === current.toLowerCase()) return null;
  return parsed;
}

/**
 * A colour: a native colour picker and a hex field so any value is
 * reachable directly. The hex box keeps a local draft so a half-typed
 * value never reaches the document, and reverts if what was typed isn't
 * a colour. Quick presets live one level up, in `ColorPresetRow` — a
 * single shared row that sets a whole pair (foreground + background) at
 * once, rather than a duplicated row of unpaired swatches per field.
 */
export function ColorField({ label, value, onChange }: { label: string; value: `#${string}`; onChange: (value: `#${string}`) => void }) {
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
    const next = colorFieldCommit(draft, value);
    if (next) onChange(next);
    else setDraft(value);
  };

  return (
    <div className='rounded-lg border border-border bg-muted/30 p-2'>
      <Label className='block text-[10px] text-muted-foreground'>{label}</Label>
      <div className='mt-1 flex items-center gap-1.5'>
        <input
          type='color'
          aria-label={`${label} — pick any colour`}
          title='Pick any colour'
          value={toSwatchHex(value)}
          onChange={(event) => onChange(event.target.value as `#${string}`)}
          className='size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0'
        />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
          aria-label={`${label} — hex value`}
          className='h-7 border-border bg-muted/30 px-1.5 font-mono text-[10px] uppercase text-muted-foreground focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
        />
      </div>
    </div>
  );
}

/**
 * One shared row of paired presets: each swatch is a themed
 * foreground/background pair, so picking a hue sets both a `ColorField`
 * pair (Text/icon · Border and Background) in a single click instead of
 * scanning two separate palettes for a pair that actually reads well
 * together. Sits once above the pair it drives, not duplicated per field.
 */
export function ColorPresetRow({ onPick }: { onPick: (preset: { foreground: `#${string}`; background: `#${string}` }) => void }) {
  const { presets } = useColorPresets();
  return (
    <div className='col-span-2 grid grid-cols-12 gap-2'>
      {presets.map((preset) => (
        <button
          key={preset.name}
          type='button'
          onClick={() => onPick(preset)}
          title={preset.name}
          aria-label={preset.name}
          className='size-5 shrink-0 rounded-full transition hover:scale-115'
          style={{ background: preset.background, border: `2px solid ${preset.foreground}` }}
        />
      ))}
    </div>
  );
}

/**
 * The same 36-swatch Ant Design set as `ColorPresetRow` (base + Deep +
 * Light shade of all 12 hues), but as flat, single-colour swatches — for a
 * field with nothing to pair a colour against (a line has no fill behind
 * it the way a block has a background). Any shade outside the set is
 * still reachable through the accompanying `ColorField`.
 */
export function HuePresetRow({ value, onPick }: { value: `#${string}`; onPick: (hex: `#${string}`) => void }) {
  const { presets } = useColorPresets();
  return (
    <div className='grid grid-cols-12 gap-1.5'>
      {presets.map((preset) => (
        <button
          key={preset.name}
          type='button'
          onClick={() => onPick(preset.foreground)}
          title={preset.name}
          aria-label={preset.name}
          className={`size-5 shrink-0 rounded-full border transition hover:scale-115 ${preset.foreground.toLowerCase() === value.toLowerCase() ? 'border-2 border-sky-300' : 'border-border'}`}
          style={{ background: preset.foreground }}
        />
      ))}
    </div>
  );
}

/** Preview uses the same production contour as the canvas node. */
export function ShapeThumb({ shape, fill, stroke }: { shape: NodeShape; fill: string; stroke: string }) {
  const detail = (() => {
    switch (shape) {
      case 'database':
        return <path d='M -56 -34 C -56 -19 56 -19 56 -34 M -56 2 C -56 17 56 17 56 2' />;
      case 'cylinder':
        return <path d='M -56 -44.75 C -56 -29.75 56 -29.75 56 -44.75' />;
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
