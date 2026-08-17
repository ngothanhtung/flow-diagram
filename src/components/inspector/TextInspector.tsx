'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fitTextNodeSize } from '@/lib/fit-to-content';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GeometryFields,
  GroupMembershipSection,
  InspectorShell,
  RangeField,
  SectionLabel,
  TextAlignField,
  TypographyFields,
  useNodeFieldDraft,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a free text object (`type: 'text'`).
 *
 * A text object paints nothing but words, so this panel deliberately
 * carries none of the box controls a block has — no shape, fill, border,
 * shadow, icon or block alignment. It also drops Sort order: the replay
 * skips text entirely, so an execution position would do nothing.
 */
export function TextInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const text = useNodeFieldDraft(node, 'title', onUpdate);

  return (
    <InspectorShell title='Text Inspector' nodeId={node.id}>
      <Label htmlFor='node-title' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
        Text
      </Label>
      {/* The whole content is the title, so this is multi-line: Enter
          inserts a newline instead of committing, and that newline
          survives to the canvas. */}
      <Textarea
        id='node-title'
        value={text.value}
        onChange={(event) => text.setValue(event.target.value)}
        onBlur={text.commit}
        rows={4}
        className='mt-1 min-h-20 resize-none border-border bg-muted/30 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <GeometryFields
        node={node}
        onUpdate={onUpdate}
        width={style.width}
        height={style.height}
        // The draft holds whatever's been typed since the last blur, so
        // fitting reads that instead of the possibly-stale committed title.
        onFitToContent={() => onUpdate(node.id, fitTextNodeSize({ ...node, title: text.value }))}
      />

      <TypographyFields node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight} />

      <SectionLabel>Colour</SectionLabel>
      <ColorField label='Text colour' value={style.foreground} onChange={(color) => onUpdate(node.id, { color })} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <SectionLabel>Alignment</SectionLabel>
      <TextAlignField node={node} onUpdate={onUpdate} textAlign={style.textAlign} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
