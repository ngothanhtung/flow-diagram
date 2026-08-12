'use client';

import { Shrink, Ungroup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  FillField,
  GeometryFields,
  GroupMembershipSection,
  InspectorShell,
  NumberField,
  PRESET_BACKGROUNDS,
  PRESET_FOREGROUNDS,
  RangeField,
  SectionLabel,
  SelectField,
  TypographyFields,
  useNodeFieldDraft,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

interface GroupInspectorProps extends InspectorPanelProps {
  /** How many blocks this frame holds. */
  memberCount: number;
  onUngroup?: (id: string) => void;
  onFitGroup?: (id: string) => void;
}

/**
 * Inspector for a group frame (`type: 'group'`).
 *
 * A frame paints a translucent wash, a dashed border and a title bar —
 * nothing else — so this panel carries no sub title, icon, shadow or
 * block alignment, and no Sort order (the replay skips frames). What it
 * adds instead is the membership block: how many blocks the frame holds,
 * and the two operations that only make sense on a container.
 */
export function GroupInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null, memberCount, onUngroup, onFitGroup }: GroupInspectorProps) {
  const style = resolveNodeStyle(node);
  const title = useNodeFieldDraft(node, 'title', onUpdate);

  return (
    <InspectorShell title='Group Inspector' nodeId={node.id}>
      <Label htmlFor='node-title' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
        Title
      </Label>
      <Input
        id='node-title'
        value={title.value}
        onChange={(event) => title.setValue(event.target.value)}
        onBlur={title.commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
        className='mt-1 border-white/10 bg-zinc-800/80 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <SectionLabel>Contents</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-zinc-500'>
        {memberCount === 0
          ? 'Empty frame — drag blocks inside to add them. Moving the frame moves everything in it.'
          : `Holds ${memberCount} ${memberCount === 1 ? 'block' : 'blocks'}. Moving the frame moves them with it; deleting it deletes them too.`}
      </p>
      <div className='mt-2 flex flex-wrap gap-1.5'>
        <Button variant='outline' size='sm' disabled={memberCount === 0} onClick={() => onFitGroup?.(node.id)} className='border-white/10 bg-white/5 px-2 text-[10px] text-zinc-300 hover:bg-white/10'>
          <Shrink size={11} /> Fit to contents
        </Button>
        <Button variant='outline' size='sm' disabled={memberCount === 0} onClick={() => onUngroup?.(node.id)} className='border-white/10 bg-white/5 px-2 text-[10px] text-zinc-300 hover:bg-white/10'>
          <Ungroup size={11} /> Ungroup
        </Button>
      </div>

      <GeometryFields node={node} onUpdate={onUpdate} width={style.width} height={style.height} />

      <TypographyFields node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight} />

      <SectionLabel>Colour</SectionLabel>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <ColorField label='Title · Border' value={style.foreground} presets={PRESET_FOREGROUNDS} onChange={(color) => onUpdate(node.id, { color, borderColor: color })} />
        <ColorField label='Wash' value={style.background} presets={PRESET_BACKGROUNDS} onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
        <NumberField label='Border width' value={style.borderWidth} min={0} max={8} step={0.5} onChange={(borderWidth) => onUpdate(node.id, { borderWidth })} />
        <SelectField label='Border style' value={style.borderStyle} options={['solid', 'dashed', 'dotted']} onChange={(borderStyle) => onUpdate(node.id, { borderStyle })} />
      </div>
      <FillField node={node} onUpdate={onUpdate} fill={style.fill} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      {/* A frame can itself sit inside another frame. */}
      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
