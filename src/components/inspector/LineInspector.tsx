'use client';

import { ArrowDownLeft, ArrowDownRight } from 'lucide-react';
import { MarkerPicker } from '@/components/edge-style-fields';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GeometryFields,
  GroupMembershipSection,
  InspectorShell,
  NumberField,
  RangeField,
  SectionLabel,
  SegmentedButtons,
  SelectField,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a free line (`type: 'line'`) — a straight stroke with
 * optional end markers, drawn in a width×height box like any other free
 * object. `lineFlip` picks which diagonal of that box the visible stroke
 * follows, so this is the one geometry-adjacent control the box model
 * needs beyond the shared `GeometryFields`. No shape/fill/shadow (a line
 * has no body to paint) and no Sort order (the replay skips it, like text
 * and free icons).
 */
export function LineInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);

  return (
    <InspectorShell title='Line Inspector' nodeId={node.id}>
      <GeometryFields node={node} onUpdate={onUpdate} width={style.width} height={style.height} />

      <SectionLabel>Direction</SectionLabel>
      <SegmentedButtons
        label='Diagonal'
        value={node.lineFlip ? 'flipped' : 'normal'}
        options={[
          { value: 'normal', label: 'Top-left to bottom-right', Icon: ArrowDownRight },
          { value: 'flipped', label: 'Top-right to bottom-left', Icon: ArrowDownLeft },
        ]}
        onChange={(next) => onUpdate(node.id, { lineFlip: next === 'flipped' })}
      />

      <SectionLabel>Stroke</SectionLabel>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <ColorField label='Colour' value={style.foreground} onChange={(color) => onUpdate(node.id, { color })} />
        <NumberField label='Width' value={style.borderWidth} min={0.5} max={16} step={0.5} onChange={(borderWidth) => onUpdate(node.id, { borderWidth })} />
        <SelectField label='Style' value={style.borderStyle} options={['solid', 'dashed', 'dotted']} onChange={(borderStyle) => onUpdate(node.id, { borderStyle })} />
      </div>
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <SectionLabel>Markers</SectionLabel>
      <MarkerPicker label='Start' value={node.startMarker ?? 'none'} onChange={(startMarker) => onUpdate(node.id, { startMarker })} />
      <MarkerPicker label='End' value={node.endMarker ?? 'none'} onChange={(endMarker) => onUpdate(node.id, { endMarker })} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
