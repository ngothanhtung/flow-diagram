'use client';

import { CornerDownLeft, SquarePlus } from 'lucide-react';
import { IconPicker } from '@/components/IconPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEditorStore } from '@/lib/editor-store';
import { LIFELINE_HEADER_HEIGHT, resolveNodeStyle } from '@/lib/node-style';
import { ActionsSection, ColorField, GeometryFields, GroupMembershipSection, InspectorShell, RangeField, SectionLabel, TextAlignField, TypographyFields, useNodeFieldDraft, type InspectorPanelProps } from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a sequence diagram participant (`type: 'lifeline'`).
 *
 * The two buttons are the panel's reason to exist. An activation bar has
 * to know which lifeline it rides, and a self-message can't be drawn by
 * dragging at all — a link needs two different nodes — so both are
 * actions on the participant rather than things you draw.
 *
 * No shape or fill controls: a lifeline paints a fixed header card and a
 * dashed line, and no silhouette choice would mean anything. Its
 * `height` is the *whole* span, header included, which is why the
 * Geometry hint says so out loud.
 */
export function LifelineInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const title = useNodeFieldDraft(node, 'title', onUpdate);
  const { addActivation, addSelfMessage, selectNode, selectEdge } = useEditorStore();
  const barCount = useEditorStore((state) => state.doc.nodes.filter((other) => other.lifelineId === node.id).length);

  return (
    <InspectorShell title='Lifeline Inspector' nodeId={node.id}>
      <SectionLabel>Participant</SectionLabel>
      <Label htmlFor='lifeline-title' className='mt-1 mb-1 block text-[9px] text-muted-foreground'>
        Name
      </Label>
      <Input
        id='lifeline-title'
        value={title.value}
        onChange={(event) => title.setValue(event.target.value)}
        onBlur={title.commit}
        placeholder='Service, actor, system…'
        className='border-border bg-muted/30 text-xs focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/15'
      />

      <div className='mt-3 grid grid-cols-2 gap-2'>
        <Button variant='outline' size='sm' onClick={() => selectNode(addActivation(node.id) ?? node.id)} className='border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'>
          <SquarePlus size={12} /> Activation
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => {
            const id = addSelfMessage(node.id);
            if (id) selectEdge(id);
          }}
          className='border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'
        >
          <CornerDownLeft size={12} /> Self message
        </Button>
      </div>
      <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>
        {barCount === 0 ? 'No activation bars yet.' : `${barCount} activation bar${barCount === 1 ? '' : 's'} on this lifeline.`} Bars stack down the line; a self message loops out and back, since a
        line needs two different ends to be drawn by hand.
      </p>

      <GeometryFields node={node} onUpdate={onUpdate} width={style.width} height={style.height} />
      <p className='mt-1 text-[9px] leading-relaxed text-muted-foreground'>Height is the whole span — the {LIFELINE_HEADER_HEIGHT}px header card plus the dashed line below it, which is how far down this participant lives.</p>

      <SectionLabel>Icon</SectionLabel>
      <div className='mt-1.5'>
        <IconPicker value={style.icon} onChange={(icon) => onUpdate(node.id, { icon })} />
      </div>

      <TypographyFields node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight} />
      <TextAlignField node={node} onUpdate={onUpdate} textAlign={style.textAlign} />

      <SectionLabel>Colour</SectionLabel>
      <ColorField label='Text, line and border' value={style.foreground} onChange={(color) => onUpdate(node.id, { color, borderColor: color })} />
      <ColorField label='Header background' value={style.background} onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
