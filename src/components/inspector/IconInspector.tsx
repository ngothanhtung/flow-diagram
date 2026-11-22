'use client';

import { Image as ImageIcon, Shapes } from 'lucide-react';
import { useState } from 'react';
import { IconPicker } from '@/components/IconPicker';
import { LogoPicker } from '@/components/LogoPicker';
import { fitIconNodeSize } from '@/lib/fit-to-content';
import { resolveNodeStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GroupMembershipSection,
  InspectorSection,
  InspectorShell,
  LayoutSection,
  RangeField,
  SegmentedButtons,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a free icon/logo object (`type: 'icon'`) — the graphic
 * counterpart to `TextInspector`. It paints only a glyph, so this panel
 * carries none of the box controls a block has (no shape, fill, border,
 * shadow, alignment) and no Sort order, for the same reason text drops
 * it: the replay skips this node type entirely.
 *
 * Unlike `BlockInspector`, which picks Icon vs. Logo from the node's
 * *type* (`logo` blocks always get `LogoPicker`), this object lets the
 * user switch between a generic icon and a brand logo freely — it's one
 * kind of node either way, just a different picker underneath.
 */
export function IconInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const currentIcon = style.icon;
  const [mode, setMode] = useState<'icon' | 'logo'>(currentIcon?.startsWith('logo:') ? 'logo' : 'icon');
  const isLogo = mode === 'logo';

  return (
    <InspectorShell title='Icon Inspector' nodeId={node.id}>
      {/* The glyph is the whole object, so picking it is its content. */}
      <InspectorSection id='content'>
        <SegmentedButtons
          label='Kind'
          value={mode}
          options={[
            { value: 'icon', label: 'Icon', Icon: Shapes },
            { value: 'logo', label: 'Logo', Icon: ImageIcon },
          ]}
          onChange={setMode}
        />
        {isLogo ? (
          <LogoPicker value={currentIcon} onChange={(icon) => onUpdate(node.id, { icon })} />
        ) : (
          <IconPicker value={currentIcon?.startsWith('logo:') ? null : currentIcon} onChange={(icon) => onUpdate(node.id, { icon })} />
        )}
        <RangeField label={isLogo ? 'Logo size' : 'Icon size'} value={style.iconSize} min={12} max={256} suffix='px' onChange={(iconSize) => onUpdate(node.id, { iconSize })} />
      </InspectorSection>

      <LayoutSection node={node} onUpdate={onUpdate} width={style.width} height={style.height} onFitToContent={() => onUpdate(node.id, fitIconNodeSize(node))} />

      <InspectorSection id='appearance'>
        {/* A brand logo keeps its own colours. */}
        {!isLogo && <ColorField label='Icon colour' value={style.foreground} onChange={(color) => onUpdate(node.id, { color })} />}
        <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />
      </InspectorSection>

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
