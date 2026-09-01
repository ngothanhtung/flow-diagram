'use client';

import { Minus, MoreHorizontal, MoveHorizontal, MoveVertical, Plus, Slash, Square, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildLegendItemsFromDocument, edgeStylesOf, resolveLegendItem } from '@/lib/edge-style';
import { useEditorStore } from '@/lib/editor-store';
import type { EdgeLineStyle, LegendItem } from '@/lib/flowchart-types';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GeometryFields,
  GroupMembershipSection,
  InspectorShell,
  RangeField,
  SectionLabel,
  SegmentedButtons,
  TypographyFields,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for the legend object (`type: 'legend'`).
 *
 * The rows are the panel: everything else here (geometry, typography,
 * label colour) exists to place them. Like text and free icon objects it
 * has no shape, fill, border or sort order — the replay skips it, so an
 * execution position would do nothing.
 *
 * Rows are hand-written for now. Generating them from the diagram waits
 * for named edge styles: today an edge carries a bare colour with no
 * name, so anything auto-collected would be labelled "Line 1", "Line 2"
 * — worse than nothing.
 */
const SAMPLE_OPTIONS: Array<{ value: 'swatch' | EdgeLineStyle; label: string; Icon: typeof Square }> = [
  { value: 'swatch', label: 'Chip', Icon: Square },
  { value: 'solid', label: 'Solid', Icon: Minus },
  { value: 'dashed', label: 'Dash', Icon: Slash },
  { value: 'dotted', label: 'Dots', Icon: MoreHorizontal },
];

export function LegendInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const doc = useEditorStore((state) => state.doc);
  const styles = edgeStylesOf(doc.settings);
  const generated = buildLegendItemsFromDocument(doc);
  const items = node.legend?.items ?? [];
  const orientation = node.legend?.orientation ?? 'horizontal';

  const writeItems = (nextItems: LegendItem[]) => onUpdate(node.id, { legend: { items: nextItems, orientation } });
  const patchItem = (id: string, patch: Partial<LegendItem>) => writeItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <InspectorShell title='Legend Inspector' nodeId={node.id}>
      <GeometryFields node={node} onUpdate={onUpdate} width={style.width} height={style.height} />

      <SectionLabel>Rows</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>Each row names one colour or line style the diagram uses. A line row draws the rule and arrow head it stands for.</p>

      <Button
        variant='outline'
        size='sm'
        disabled={generated.length === 0}
        onClick={() => writeItems(generated)}
        title={generated.length === 0 ? 'No line follows a named style yet — assign one in the line inspector first' : undefined}
        className='mt-2 w-full border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'
      >
        <Wand2 size={11} /> {generated.length === 0 ? 'No line styles in use yet' : `Generate from diagram · ${generated.length} row${generated.length === 1 ? '' : 's'}`}
      </Button>
      <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>Replaces the rows with one per named line style the diagram actually uses. Generated rows follow their style, so renaming or recolouring it updates the legend too.</p>

      <div className='mt-2 flex flex-col gap-2'>
        {items.map((item) => {
          const resolved = resolveLegendItem(item, styles);
          const linked = item.styleRef ? styles.find((style) => style.id === item.styleRef) : undefined;
          const sample = item.kind === 'swatch' ? 'swatch' : resolved.lineStyle;
          return (
            <div key={item.id} className='rounded-lg border border-border bg-muted/30 p-2'>
              {linked && (
                <p className='mb-1.5 truncate text-[9px] text-muted-foreground'>
                  Follows <span className='font-semibold text-foreground'>{linked.name}</span> — leave a field blank to keep tracking it.
                </p>
              )}
              <div className='flex items-center gap-1.5'>
                <input
                  type='color'
                  aria-label={`${resolved.label || 'Row'} — colour`}
                  value={resolved.color}
                  onChange={(event) => patchItem(item.id, { color: event.target.value as `#${string}` })}
                  className='size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0'
                />
                <Input
                  value={item.label}
                  onChange={(event) => patchItem(item.id, { label: event.target.value })}
                  placeholder={linked?.name ?? 'what it means'}
                  aria-label='Row label'
                  className='h-7 border-border bg-muted/30 px-1.5 text-[11px] focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
                />
                <Button
                  variant='outline'
                  size='icon-sm'
                  onClick={() => writeItems(items.filter((other) => other.id !== item.id))}
                  title='Remove row'
                  aria-label={`Remove ${resolved.label || 'row'}`}
                  className='size-7 shrink-0 border-border bg-muted/30 text-muted-foreground hover:bg-accent'
                >
                  <Minus size={12} />
                </Button>
              </div>
              <div className='mt-1.5 grid grid-cols-[auto_1fr] items-center gap-2'>
                <span className='text-[10px] text-muted-foreground'>Sample</span>
                <div className='flex gap-1'>
                  {SAMPLE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant='outline'
                      size='sm'
                      aria-pressed={sample === option.value}
                      title={option.label}
                      onClick={() => patchItem(item.id, option.value === 'swatch' ? { kind: 'swatch' } : { kind: 'line', lineStyle: option.value, dashed: undefined })}
                      className={['h-7 flex-1 px-1.5 text-[10px]', sample === option.value ? 'border-sky-400/60 bg-sky-500/20 text-sky-700 dark:text-sky-100' : 'border-border bg-muted/30 text-muted-foreground hover:bg-accent'].join(' ')}
                    >
                      <option.Icon size={11} /> {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant='outline'
        size='sm'
        onClick={() => writeItems([...items, { id: `l${Date.now().toString(36)}`, kind: 'line', label: 'new row', color: style.foreground }])}
        className='mt-2 w-full border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'
      >
        <Plus size={11} /> Add row
      </Button>

      <SectionLabel>Layout</SectionLabel>
      <SegmentedButtons
        label='Flow'
        value={orientation}
        options={[
          { value: 'horizontal', label: 'In a row', Icon: MoveHorizontal },
          { value: 'vertical', label: 'Stacked', Icon: MoveVertical },
        ]}
        onChange={(next) => onUpdate(node.id, { legend: { items, orientation: next } })}
      />

      <TypographyFields node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight} />

      <SectionLabel>Colour</SectionLabel>
      <Label className='mb-1 block text-[9px] text-muted-foreground'>Applies to the labels; each row&apos;s sample keeps its own colour.</Label>
      <ColorField label='Label colour' value={style.foreground} onChange={(color) => onUpdate(node.id, { color })} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
