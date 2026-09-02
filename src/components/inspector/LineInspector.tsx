'use client';

import { ArrowLeftRight } from 'lucide-react';
import { MarkerPicker } from '@/components/edge-style-fields';
import { endpointsOfLine, lineGeometryFromEndpoints, type Point } from '@/lib/line-geometry';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GroupMembershipSection,
  InspectorShell,
  NumberField,
  RangeField,
  SectionLabel,
  SelectField,
  type InspectorPanelProps,
} from './fields';
import { Button } from '@/components/ui/button';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a free line (`type: 'line'`) — a straight stroke with
 * optional end markers.
 *
 * It shows the **two endpoints**, not the shared `GeometryFields` X/Y/W/H:
 * a free line is a segment, and its bounding box is a storage detail
 * (see `lib/line-geometry.ts`) rather than something the user positions.
 * Typing a coordinate here goes through the same conversion dragging an
 * endpoint handle on the canvas does, so the two can't disagree.
 *
 * No shape/fill/shadow (a line has no body to paint) and no Sort order
 * (the replay skips it, like text and free icons).
 */
export function LineInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const { start, end } = endpointsOfLine(node, style.width, style.height);

  const setEndpoints = (nextStart: Point, nextEnd: Point) => onUpdate(node.id, lineGeometryFromEndpoints(nextStart, nextEnd));

  return (
    <InspectorShell title='Line Inspector' nodeId={node.id}>
      <SectionLabel>Endpoints</SectionLabel>
      <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>Each end moves on its own — drag its handle on the canvas, or set an exact point here. The start end is the one the start marker sits on.</p>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <NumberField label='Start X' value={Math.round(start.x)} onChange={(x) => setEndpoints({ ...start, x }, end)} />
        <NumberField label='Start Y' value={Math.round(start.y)} onChange={(y) => setEndpoints({ ...start, y }, end)} />
        <NumberField label='End X' value={Math.round(end.x)} onChange={(x) => setEndpoints(start, { ...end, x })} />
        <NumberField label='End Y' value={Math.round(end.y)} onChange={(y) => setEndpoints(start, { ...end, y })} />
      </div>
      {/* Swapping is not the same as re-drawing the line the other way:
          the segment stays exactly where it is and only which end counts
          as the start changes, so the two markers trade places. */}
      <Button variant='outline' size='sm' onClick={() => setEndpoints(end, start)} className='mt-2 border-border bg-muted/30 px-2 text-[10px] text-muted-foreground hover:bg-accent'>
        <ArrowLeftRight size={11} /> Swap ends
      </Button>

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
