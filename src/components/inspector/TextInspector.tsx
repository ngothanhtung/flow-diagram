'use client';

import { Label } from '@/components/ui/label';
import { NarrationEditor } from '@/components/lessons/NarrationEditor';
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
  const isMarkdown = node.markdown === true;

  return (
    <InspectorShell title='Text Inspector' nodeId={node.id}>
      <Label htmlFor='node-title' className='mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
        Text
      </Label>
      {/* Plain or Markdown: the same two kinds of content a Lesson step's Body offers. */}
      <div className='mt-1 flex gap-0.5 rounded-md bg-muted p-0.5' role='group' aria-label='Text format'>
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
        <div className='mt-1.5'>
          <NarrationEditor key={`${node.id}-md`} label='' value={node.title} onChange={(title) => onUpdate(node.id, { title })} placeholder='**bold**, `code`, - lists …' minLines={5} hint='**bold** *italic* `code` · - list · 1. list · ### heading · ``` code' />
        </div>
      ) : (
        /* The whole content is the title, so this is multi-line: Enter
           inserts a newline instead of committing, and that newline
           survives to the canvas. */
        <Textarea
          id='node-title'
          value={text.value}
          onChange={(event) => text.setValue(event.target.value)}
          onBlur={text.commit}
          rows={4}
          className='mt-1 min-h-20 resize-none border-border bg-muted/30 text-sm focus-visible:border-sky-400/50 focus-visible:ring-sky-400/15'
        />
      )}

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
