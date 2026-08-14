'use client';

import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, PanelLeft, PanelRight, PanelTop } from 'lucide-react';
import { IconPicker } from '@/components/IconPicker';
import { LogoPicker } from '@/components/LogoPicker';
import { TableColumnsEditor } from '@/components/TableColumnsEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { resolveClosestLogoColor } from '@/lib/logo-color';
import { COLORS, SHAPES, resolveNodeStyle, type NodeShape } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  FillField,
  GeometryFields,
  GroupMembershipSection,
  InspectorShell,
  NumberField,
  RangeField,
  SectionLabel,
  SegmentedButtons,
  SelectField,
  ShapeThumb,
  TextAlignField,
  TypographyFields,
  useColorPresets,
  useNodeFieldDraft,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for an ordinary block — every node that paints a body:
 * process/start/decision/output cards, logo blocks and database tables.
 * Text objects and group frames have their own panels, because most of
 * what lives here describes a box those two don't have.
 */
export function BlockInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const { foregrounds, backgrounds } = useColorPresets();
  const title = useNodeFieldDraft(node, 'title', onUpdate);
  const description = useNodeFieldDraft(node, 'description', onUpdate);
  const isLogo = node.type === 'logo';
  const currentShape: NodeShape = style.shape;
  const currentIcon = style.icon;

  return (
    <InspectorShell title='Block Inspector' nodeId={node.id}>
      <Label htmlFor='node-title' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
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
        className='mt-1 border-border bg-muted/30 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <Label htmlFor='node-subtitle' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
        Sub title
      </Label>
      <Textarea
        id='node-subtitle'
        value={description.value}
        onChange={(event) => description.setValue(event.target.value)}
        onBlur={description.commit}
        rows={2}
        className='mt-1 min-h-14 resize-none border-border bg-muted/30 text-xs focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
      />

      <GeometryFields node={node} onUpdate={onUpdate} width={style.width} height={style.height} />
      <NumberField label='Sort order · 0 = auto' value={node.sortOrder ?? 0} min={0} step={1} onChange={(sortOrder) => onUpdate(node.id, { sortOrder: sortOrder > 0 ? sortOrder : undefined })} />

      <TypographyFields node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight} />

      {/* --- Shape ------------------------------------------------- */}
      <label className='mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Shape</label>
      <Select
        value={currentShape}
        onValueChange={(nextValue) => {
          if (nextValue) onUpdate(node.id, { shape: nextValue as NodeShape });
        }}
      >
        <SelectTrigger className='mt-1.5 h-auto w-full gap-2.5 border-border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:border-violet-400/50 focus-visible:ring-violet-400/15'>
          <span className='grid size-7 shrink-0 place-items-center rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-200'>
            <ShapeThumb shape={currentShape} fill={style.background} stroke={style.foreground} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-xs font-semibold'>{SHAPES[currentShape].label}</span>
          </span>
        </SelectTrigger>
        <SelectContent className='max-h-72 min-w-72.5 border-violet-400/25 bg-popover p-1.5'>
          {(Object.keys(SHAPES) as NodeShape[]).map((shapeKey) => (
            <SelectItem key={shapeKey} value={shapeKey} className='gap-2.5 px-2.5 py-2 pr-9'>
              <span className='grid size-7 shrink-0 place-items-center rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-200'>
                <ShapeThumb shape={shapeKey} fill={style.background} stroke={style.foreground} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-[11px] font-semibold'>{SHAPES[shapeKey].label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* --- Color ------------------------------------------------- */}
      {/* Each field is a full colour picker on its own — a preset row for
          quick picks, plus a native picker and hex box for anything else —
          so there is no separate step to reach a custom colour. */}
      <SectionLabel>Color</SectionLabel>
      <div className='mt-1.5 grid grid-cols-2 gap-2'>
        <ColorField label='Text / icon · Border' value={style.foreground} presets={foregrounds} onChange={(color) => onUpdate(node.id, { color, borderColor: color })} />
        <ColorField label='Background' value={style.background} presets={backgrounds} onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
        <NumberField label='Border width' value={style.borderWidth} min={0} max={8} step={0.5} onChange={(borderWidth) => onUpdate(node.id, { borderWidth })} />
      </div>
      <div className='mt-2 grid grid-cols-2 gap-2'>
        <SelectField label='Border style' value={style.borderStyle} options={['solid', 'dashed', 'dotted']} onChange={(borderStyle) => onUpdate(node.id, { borderStyle })} />
        <SelectField label='Shadow' value={style.shadow} options={['none', 'soft', 'glow']} onChange={(shadow) => onUpdate(node.id, { shadow })} />
      </div>
      <FillField node={node} onUpdate={onUpdate} fill={style.fill} />
      <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />

      {/* --- Icon / Logo ------------------------------------------ */}
      <label className='mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>{isLogo ? 'Logo' : 'Icon'}</label>
      <div className='mt-1.5'>
        {isLogo ? (
          <LogoPicker
            value={currentIcon}
            onChange={(icon, name) => {
              const updateColor = async () => {
                const slug = icon?.startsWith('logo:') ? icon.slice('logo:'.length) : null;
                if (!slug) return;
                try {
                  const nearest = await resolveClosestLogoColor(slug);
                  if (nearest) {
                    const spec = COLORS[nearest];
                    onUpdate(node.id, {
                      color: spec.foreground,
                      backgroundColor: spec.background,
                      borderColor: spec.foreground,
                    });
                  }
                } catch {
                  // Ignore colour extraction failures; the logo still applies.
                }
              };

              onUpdate(node.id, { icon });
              if (name && name !== node.title) {
                title.setValue(name);
                onUpdate(node.id, { title: name });
              }
              void updateColor();
            }}
          />
        ) : (
          <IconPicker value={currentIcon} onChange={(icon) => onUpdate(node.id, { icon })} />
        )}
      </div>
      {(isLogo || (currentIcon !== null && !String(currentIcon).startsWith('logo:'))) && (
        <RangeField label={isLogo ? 'Logo size' : 'Icon size'} value={style.iconSize} min={12} max={isLogo ? 256 : 48} suffix='px' onChange={(iconSize) => onUpdate(node.id, { iconSize })} />
      )}

      <SectionLabel>Alignment</SectionLabel>
      {currentIcon !== null && !isLogo && (
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
      <TextAlignField node={node} onUpdate={onUpdate} textAlign={style.textAlign} />

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <SectionLabel>{node.table ? 'Columns' : 'Database table'}</SectionLabel>
      <TableColumnsEditor node={node} onUpdate={onUpdate} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}
