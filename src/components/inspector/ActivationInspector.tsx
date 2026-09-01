'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useEditorStore } from '@/lib/editor-store';
import { nodeSizeLimits, resolveNodeStyle } from '@/lib/node-style';
import { ActionsSection, ColorField, InspectorShell, NumberField, RangeField, SectionLabel, type InspectorPanelProps } from './fields';

/**
 * Inspector for an activation bar (`type: 'activation'`) — the stretch
 * of time a participant is busy.
 *
 * There is no X field and no full `GeometryFields`: the bar's x comes
 * from its lifeline (the store's `onNodeMove` enforces it), so offering
 * a control that silently snaps back would be a lie. What's left is
 * genuinely all of it — when the bar starts, how long it lasts, how wide
 * the bar is drawn, and its colour.
 */
export function ActivationInspector({ node, onUpdate, onDuplicate, onDelete }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const limits = nodeSizeLimits(node);
  const lifeline = useEditorStore((state) => state.doc.nodes.find((other) => other.id === node.lifelineId) ?? null);
  const selectNode = useEditorStore((state) => state.selectNode);
  const top = Math.round(node.position.y - style.height / 2);

  return (
    <InspectorShell title='Activation Inspector' nodeId={node.id}>
      <SectionLabel>Lifeline</SectionLabel>
      {lifeline ? (
        <div className='mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-2 ring-1 ring-border'>
          <span className='min-w-0 truncate text-[11px] font-semibold text-foreground'>{lifeline.title || 'Untitled participant'}</span>
          <Button variant='ghost' size='xs' onClick={() => selectNode(lifeline.id)} className='shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground'>
            Select
          </Button>
        </div>
      ) : (
        <p className='mt-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800 ring-1 ring-amber-400/25 dark:text-amber-200'>
          This bar has no lifeline, so nothing pins its horizontal position. Delete it, or add it again from a lifeline&apos;s inspector.
        </p>
      )}

      <SectionLabel>Timing</SectionLabel>
      <Label className='mt-1 mb-1 block text-[9px] text-muted-foreground'>The bar rides its lifeline&apos;s centre line, so only where it starts and how long it runs are yours to set.</Label>
      <div className='grid grid-cols-2 gap-2'>
        <NumberField label='Starts at Y' value={top} step={8} onChange={(nextTop) => onUpdate(node.id, { position: { x: node.position.x, y: nextTop + style.height / 2 } })} />
        <NumberField
          label='Duration (px)'
          value={Math.round(style.height)}
          min={limits.minHeight}
          max={limits.maxHeight}
          step={8}
          onChange={(height) => {
            const next = Math.max(limits.minHeight, Math.min(limits.maxHeight, height));
            // Grow downwards from the current top: a bar's start is when
            // the call arrived, and stretching its duration shouldn't
            // move that.
            onUpdate(node.id, { height: next, position: { x: node.position.x, y: top + next / 2 } });
          }}
        />
      </div>
      <div className='mt-1.5'>
        <NumberField label='Bar width' value={Math.round(style.width)} min={limits.minWidth} max={limits.maxWidth} step={1} onChange={(width) => onUpdate(node.id, { width: Math.max(limits.minWidth, Math.min(limits.maxWidth, width)) })} />
      </div>

      <SectionLabel>Colour</SectionLabel>
      <ColorField label='Bar fill' value={style.background} onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
      <ColorField label='Border' value={style.borderColor} onChange={(borderColor) => onUpdate(node.id, { borderColor })} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
