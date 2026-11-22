'use client';

import { NarrationEditor } from '@/components/lessons/NarrationEditor';
import { Textarea } from '@/components/ui/textarea';
import { fitTextNodeSize } from '@/lib/fit-to-content';
import { Plus, X } from 'lucide-react';
import type { FlowNode } from '@/lib/flowchart-types';
import { resolveNodeStyle, textBoxStyle } from '@/lib/node-style';
import {
  ActionsSection,
  ColorField,
  GroupMembershipSection,
  InspectorSection,
  InspectorShell,
  LayoutSection,
  NumberField,
  RangeField,
  SelectField,
  TextAlignField,
  TypographySection,
  useNodeFieldDraft,
  type InspectorPanelProps,
} from './fields';
import { NodeEffectField } from './NodeEffectField';

/**
 * Inspector for a free text object (`type: 'text'`): its words (plain or
 * Markdown), layout and padding, typography, and the optional box it may
 * wear (Appearance). No shape, icon or Replay — the replay skips text.
 */
export function TextInspector({ node, onUpdate, onDuplicate, onDelete, parentTitle = null }: InspectorPanelProps) {
  const style = resolveNodeStyle(node);
  const text = useNodeFieldDraft(node, 'title', onUpdate);
  const isMarkdown = node.markdown === true;
  const box = textBoxStyle(node);

  return (
    <InspectorShell title='Text Inspector' nodeId={node.id}>
      <InspectorSection id='content'>
        {/* Plain or Markdown: the same two kinds of content a Lesson step's Body offers. */}
        <div className='flex gap-0.5 rounded-md bg-muted p-0.5' role='group' aria-label='Text format'>
          {([false, true] as const).map((markdown) => (
            <button
              key={String(markdown)}
              type='button'
              aria-pressed={isMarkdown === markdown}
              onClick={() => {
                text.commit();
                if (isMarkdown !== markdown) onUpdate(node.id, { markdown: markdown ? true : undefined });
              }}
              className={`flex-1 rounded px-2 py-0.5 text-[10px] font-semibold transition ${isMarkdown === markdown ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {markdown ? 'Markdown' : 'Plain'}
            </button>
          ))}
        </div>
        {isMarkdown ? (
          // Edits go straight to the document (its typing gesture makes one stretch one undo step).
          <NarrationEditor
            key={`${node.id}-md`}
            label=''
            value={node.title}
            onChange={(title) => {
              // Keep the draft in step: it flushes on unmount (deselecting), and a stale one would write the old text back.
              text.setValue(title);
              onUpdate(node.id, { title });
            }}
            placeholder='**bold**, `code`, - lists …'
            minLines={5}
            hint='**bold** *italic* `code` · {red|colour} · - list · 1. list · ### heading · ``` code'
          />
        ) : (
          /* The whole content is the title, so this is multi-line: Enter
             inserts a newline instead of committing, and that newline
             survives to the canvas. */
          <Textarea
            id='node-title'
            aria-label='Text'
            value={text.value}
            onChange={(event) => text.setValue(event.target.value)}
            onBlur={text.commit}
            rows={4}
            className='min-h-20 resize-none border-border bg-muted/30 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
          />
        )}
      </InspectorSection>

      <LayoutSection
        node={node}
        onUpdate={onUpdate}
        width={style.width}
        height={style.height}
        // The draft holds whatever's been typed since the last blur, so
        // fitting reads that instead of the possibly-stale committed title.
        onFitToContent={() => onUpdate(node.id, fitTextNodeSize({ ...node, title: text.value }))}
      >
        <div className='grid grid-cols-2 gap-2'>
          <NumberField label='Padding' value={box.padding} min={0} max={64} onChange={(padding) => onUpdate(node.id, { padding })} />
        </div>
      </LayoutSection>

      <TypographySection node={node} onUpdate={onUpdate} fontFamily={style.fontFamily} fontSize={style.fontSize} fontWeight={style.fontWeight}>
        <TextAlignField node={node} onUpdate={onUpdate} textAlign={style.textAlign} />
      </TypographySection>

      {/* The text's own colour, then the box it may wear — no rectangle underneath needed. */}
      <InspectorSection id='appearance'>
        <ColorField label='Text colour' value={style.foreground} onChange={(color) => onUpdate(node.id, { color })} />
        <div className='grid gap-2'>
          <OptionalColorField label='Background' value={box.fill} fallback='#111827' onChange={(backgroundColor) => onUpdate(node.id, { backgroundColor })} />
          <OptionalColorField
            label='Border'
            value={box.stroke}
            fallback='#64748b'
            onChange={(borderColor) => onUpdate(node.id, borderColor ? { borderColor, borderWidth: box.strokeWidth > 0 ? box.strokeWidth : 1 } : { borderColor: undefined, borderWidth: undefined })}
          />
        </div>
        {box.stroke && (
          <div className='grid grid-cols-2 gap-2'>
            <NumberField label='Border width' value={box.strokeWidth} min={0.5} max={8} step={0.5} onChange={(borderWidth) => onUpdate(node.id, { borderWidth })} />
            <SelectField label='Border style' value={box.borderStyle} options={['solid', 'dashed', 'dotted']} onChange={(borderStyle) => onUpdate(node.id, { borderStyle })} />
          </div>
        )}
        <div className='grid grid-cols-2 gap-2'>
          <NumberField label='Corner radius' value={box.radius} min={0} max={48} onChange={(cornerRadius) => onUpdate(node.id, { cornerRadius })} />
        </div>
        <RangeField label='Opacity' value={Math.round(style.opacity * 100)} min={20} max={100} suffix='%' onChange={(opacity) => onUpdate(node.id, { opacity: opacity / 100 })} />
      </InspectorSection>

      <NodeEffectField node={node} onUpdate={onUpdate} foreground={style.foreground} />

      <GroupMembershipSection node={node} onUpdate={onUpdate} parentTitle={parentTitle} />

      <ActionsSection node={node} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
    </InspectorShell>
  );
}

/** A colour the text box may or may not have: "Add" when it has none, else the picker plus a remove button. */
function OptionalColorField({ label, value, fallback, onChange }: { label: string; value: string | null; fallback: `#${string}`; onChange: (value: FlowNode['backgroundColor']) => void }) {
  if (!value) {
    return (
      <button type='button' onClick={() => onChange(fallback)} className='flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground'>
        <Plus size={12} /> {label}
      </button>
    );
  }
  return (
    <div className='relative'>
      <ColorField label={label} value={value as `#${string}`} onChange={onChange} />
      <button type='button' aria-label={`Remove ${label.toLowerCase()}`} title={`Remove ${label.toLowerCase()}`} onClick={() => onChange(undefined)} className='absolute top-1.5 right-1.5 grid size-5 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground'>
        <X size={12} />
      </button>
    </div>
  );
}
