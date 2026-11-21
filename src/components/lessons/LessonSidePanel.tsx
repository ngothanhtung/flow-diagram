'use client';

import { useHistoryGestureScope } from '@/components/editor/use-history-gesture-scope';
import { EDGE_EFFECTS as EDGE_EFFECT_OPTIONS } from '@/components/edge-style-fields';
import { LabeledSelect, PanelHeading, SwitchRow, TextAreaField, TextField, type SelectOption } from '@/components/lessons/lesson-fields';
import { Button } from '@/components/ui/button';
import { NODE_EFFECTS } from '@/lib/document-vocabulary';
import { useEditorStore } from '@/lib/editor-store';
import { removeFromStep, setOverride, setPresence, updateStep } from '@/lib/lesson/lesson-edit';
import { CALLOUT_KINDS, LESSON_CHAPTERS, type CalloutKind, type LessonChapter, type LessonContent, type LessonStep } from '@/lib/lesson/lesson-types';

const NONE = '__none';
const SAME = '__same';
const END = '__end';

const CHAPTER_OPTIONS: SelectOption[] = [{ value: NONE, label: 'None' }, ...(Object.entries(LESSON_CHAPTERS) as [LessonChapter, { label: string }][]).map(([value, { label }]) => ({ value, label }))];
const CALLOUT_OPTIONS: SelectOption[] = [{ value: NONE, label: 'None' }, ...CALLOUT_KINDS.map((kind) => ({ value: kind, label: kind.charAt(0).toUpperCase() + kind.slice(1) }))];
const NODE_EFFECT_OPTIONS: SelectOption[] = [{ value: SAME, label: 'Same as diagram' }, ...[...NODE_EFFECTS].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))];
const EDGE_EFFECT_SELECT: SelectOption[] = [{ value: SAME, label: 'Same as diagram' }, ...EDGE_EFFECT_OPTIONS.map(({ value, label }) => ({ value, label }))];

const BODY_HINT = '**bold** *italic* `code` [[term]] — blank line = new paragraph';
const CHANGES_HINT = 'One per line. Start with + added, ~ changed or - removed.';

function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '');
}

function NarrationSection({ step, content, keyPrefix }: { step: LessonStep; content: LessonContent; keyPrefix: string }) {
  const edit = useEditorStore((state) => state.editLesson);
  const patch = (next: Partial<Omit<LessonStep, 'id'>>) => edit((c) => updateStep(c, step.id, next));
  const k = (name: string) => `${keyPrefix}:${name}`;

  return (
    <>
      <PanelHeading>Narration</PanelHeading>
      <div className='space-y-2.5'>
        <TextField key={k('short')} label='Short name' value={step.short} onChange={(short) => patch({ short })} />
        <TextField key={k('title')} label='Title' value={step.title} onChange={(title) => patch({ title })} />
        <LabeledSelect label='Chapter' value={step.chapter ?? NONE} options={CHAPTER_OPTIONS} onChange={(value) => patch({ chapter: value === NONE ? undefined : (value as LessonChapter) })} />
        <TextAreaField key={k('body')} label='Body' rows={6} value={step.body} hint={BODY_HINT} onChange={(body) => patch({ body })} />
        <LabeledSelect
          label='Callout'
          value={step.callout?.kind ?? NONE}
          options={CALLOUT_OPTIONS}
          onChange={(value) => patch({ callout: value === NONE ? undefined : { kind: value as CalloutKind, text: step.callout?.text ?? '' } })}
        />
        {step.callout && (
          <TextAreaField key={k('callout')} label='' value={step.callout.text} placeholder='Callout text' rows={2} onChange={(text) => patch({ callout: { kind: step.callout?.kind ?? 'insight', text } })} />
        )}
        <TextAreaField
          key={k('changes')}
          label='Changes'
          rows={3}
          value={step.changes.join('\n')}
          placeholder={'+ Added a cache\n~ Reads now hit the cache\n- Removed the sync call'}
          hint={CHANGES_HINT}
          onChange={(text) => patch({ changes: splitLines(text) })}
        />
        {content.meta.metrics.map((metric) => (
          <TextField
            key={k(`metric:${metric.id}`)}
            label={metric.label || metric.id}
            value={step.metrics[metric.id] ?? ''}
            onChange={(value) => {
              const { [metric.id]: _old, ...rest } = step.metrics;
              void _old;
              patch({ metrics: value === '' ? rest : { ...rest, [metric.id]: value } });
            }}
          />
        ))}
      </div>
    </>
  );
}

function ThisStepSection({ step, content, elementId, kind, keyPrefix }: { step: LessonStep; content: LessonContent; elementId: string; kind: 'node' | 'edge'; keyPrefix: string }) {
  const edit = useEditorStore((state) => state.editLesson);
  const diagramTitle = useEditorStore((state) => {
    if (kind === 'node') return state.doc.nodes.find((n) => n.id === elementId)?.title ?? '';
    return state.doc.edges.find((e) => e.id === elementId)?.label ?? '';
  });
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);

  const override = step.overrides[elementId] ?? {};
  const presence = content.presence[elementId] ?? {};
  const order = content.steps.map((s) => s.id);
  const fromIndex = Math.max(0, presence.from ? order.indexOf(presence.from) : 0);
  const untilIndex = presence.until ? order.indexOf(presence.until) : -1;
  const stepOptions: SelectOption[] = content.steps.map((s, i) => ({ value: s.id, label: `Lesson step ${i + 1} — ${s.short || 'Untitled'}` }));
  const untilOptions: SelectOption[] = [{ value: END, label: 'End' }, ...stepOptions.slice(1)];
  const appears = `Appears: lesson step ${fromIndex + 1} → ${untilIndex > 0 ? untilIndex : 'end'}`;

  const setOver = (patch: Parameters<typeof setOverride>[3]) => edit((c) => setOverride(c, step.id, elementId, patch));
  const removeIds = kind === 'node' ? selectedNodeIds : [elementId];
  const k = (name: string) => `${keyPrefix}:${elementId}:${name}`;
  const effectValue = override.effect ?? SAME;

  return (
    <>
      <PanelHeading>This lesson step</PanelHeading>
      <p className='text-[11px] text-foreground' data-testid='presence-line'>
        {appears}
      </p>
      <div className='mt-2 grid grid-cols-2 gap-2'>
        <LabeledSelect label='From' value={content.steps[fromIndex].id} options={stepOptions} onChange={(value) => edit((c) => setPresence(c, elementId, { ...presence, from: value === c.steps[0].id ? undefined : value }))} />
        <LabeledSelect
          label='Until'
          value={untilIndex > 0 ? presence.until! : END}
          options={untilOptions}
          onChange={(value) => edit((c) => setPresence(c, elementId, { ...presence, until: value === END ? undefined : value }))}
        />
      </div>
      <Button type='button' variant='outline' size='sm' className='mt-2 w-full text-[11px]' onClick={() => edit((c) => removeFromStep(c, removeIds, step.id))}>
        Remove from this lesson step
      </Button>
      <SwitchRow label='Hidden in this lesson step' checked={override.visible === false} onChange={(on) => setOver({ visible: on ? false : undefined })} />
      <SwitchRow label='Emphasize in this lesson step' checked={override.emphasis === true} onChange={(on) => setOver({ emphasis: on ? true : undefined })} />
      <div className='mt-3 space-y-2.5'>
        {kind === 'node' ? (
          <TextField key={k('title')} label='Title in this lesson step' value={override.title ?? ''} placeholder={diagramTitle || 'Same as diagram'} onChange={(title) => setOver({ title: title === '' ? undefined : title })} />
        ) : (
          <TextField key={k('label')} label='Label in this lesson step' value={override.label ?? ''} placeholder={diagramTitle || 'Same as diagram'} onChange={(label) => setOver({ label: label === '' ? undefined : label })} />
        )}
        <LabeledSelect
          label='Effect in this lesson step'
          value={effectValue}
          options={kind === 'node' ? NODE_EFFECT_OPTIONS : EDGE_EFFECT_SELECT}
          onChange={(value) => setOver({ effect: value === SAME ? undefined : (value as NonNullable<typeof override.effect>) })}
        />
      </div>
    </>
  );
}

/**
 * The Lesson editor's left panel: the Narration of the current Lesson step,
 * then, when exactly one Element is selected, how that Element behaves in
 * this Lesson step. Text fields write on every change; the gesture scope
 * folds a stretch of typing into one undo step, and fields are keyed by
 * `historyRevision` and the Lesson step so undo, redo and switching steps
 * always show the stored text.
 */
export function LessonSidePanel() {
  const lesson = useEditorStore((state) => state.lesson);
  const lessonStepId = useEditorStore((state) => state.lessonStepId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selectedEdgeId = useEditorStore((state) => state.selectedEdgeId);
  const historyRevision = useEditorStore((state) => state.historyRevision);
  const historyGestures = useHistoryGestureScope();

  if (!lesson) return null;
  const step = lesson.steps.find((s) => s.id === lessonStepId) ?? lesson.steps[0];
  const keyPrefix = `${step.id}:${historyRevision}`;

  const selected = selectedEdgeId ? { id: selectedEdgeId, kind: 'edge' as const } : selectedNodeIds.length === 1 ? { id: selectedNodeIds[0], kind: 'node' as const } : null;

  return (
    <div {...historyGestures} className='p-3'>
      <NarrationSection step={step} content={lesson} keyPrefix={keyPrefix} />
      {selected && <ThisStepSection step={step} content={lesson} elementId={selected.id} kind={selected.kind} keyPrefix={keyPrefix} />}
    </div>
  );
}
