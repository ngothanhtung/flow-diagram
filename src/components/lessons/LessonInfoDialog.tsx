'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useHistoryGestureScope } from '@/components/editor/use-history-gesture-scope';
import { DraftInput, LabeledSelect, PanelHeading, TextAreaField, TextField, FieldLabel, type SelectOption } from '@/components/lessons/lesson-fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/lib/editor-store';
import { updateMeta } from '@/lib/lesson/lesson-edit';
import { LESSON_LEVELS, RESERVED_METRIC_IDS, type LessonContent, type LessonLevel } from '@/lib/lesson/lesson-types';

const NO_LEVEL = '__none';
const LEVEL_OPTIONS: SelectOption[] = [{ value: NO_LEVEL, label: 'Not set' }, ...LESSON_LEVELS.map((level) => ({ value: level, label: level.charAt(0).toUpperCase() + level.slice(1) }))];
const INPUT_CLASS = 'h-8 border-border bg-muted/30 text-[11px] text-foreground';

/** Renaming a metric moves every Lesson step's value to the new id. */
function renameMetric(content: LessonContent, index: number, id: string): LessonContent {
  const old = content.meta.metrics[index];
  if (!old || old.id === id) return content;
  const metrics = content.meta.metrics.map((m, i) => (i === index ? { ...m, id } : m));
  const steps = content.steps.map((step) => {
    if (!Object.hasOwn(step.metrics, old.id)) return step;
    const { [old.id]: value, ...rest } = step.metrics;
    return { ...step, metrics: { ...rest, [id]: value } };
  });
  return { ...content, meta: { ...content.meta, metrics }, steps };
}

function nextMetricId(existing: readonly string[]): string {
  let n = 1;
  while (existing.includes(`metric${n}`)) n += 1;
  return `metric${n}`;
}

/** A metric id commits on blur: an id that is empty, taken or reserved is not applied. */
function MetricIdField({ id, taken, onCommit }: { id: string; taken: (id: string) => boolean; onCommit: (id: string) => void }) {
  const [draft, setDraft] = useState(id);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== id && !taken(next) && !RESERVED_METRIC_IDS.has(next)) onCommit(next);
    else setDraft(id);
  };
  return (
    <Input
      aria-label='Metric id'
      value={draft}
      placeholder='id'
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      className={`${INPUT_CLASS} w-24 shrink-0 font-mono`}
    />
  );
}

function InfoForm() {
  const lesson = useEditorStore((state) => state.lesson);
  const historyRevision = useEditorStore((state) => state.historyRevision);
  const edit = useEditorStore((state) => state.editLesson);
  if (!lesson) return null;
  const { meta, steps } = lesson;
  const patchMeta = (patch: Parameters<typeof updateMeta>[1]) => edit((c) => updateMeta(c, patch));
  const stepOptions: SelectOption[] = steps.map((s, i) => ({ value: s.id, label: `Lesson step ${i + 1} — ${s.short || 'Untitled'}` }));
  const rev = String(historyRevision);

  return (
    <div className='max-h-[70vh] space-y-2.5 overflow-y-auto pr-1'>
      <TextField key={`title:${rev}`} label='Title' value={meta.title} onChange={(title) => patchMeta({ title })} />
      <TextAreaField key={`summary:${rev}`} label='Summary' rows={3} value={meta.summary} onChange={(summary) => patchMeta({ summary })} />
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <FieldLabel>Minutes</FieldLabel>
          <DraftInput
            key={`minutes:${rev}`}
            type='number'
            min={1}
            aria-label='Minutes'
            value={String(meta.minutes ?? '')}
            onChange={(text) => {
              const minutes = Number.parseInt(text, 10);
              if (text === '') patchMeta({ minutes: undefined });
              else if (Number.isFinite(minutes) && minutes > 0) patchMeta({ minutes });
            }}
            className={INPUT_CLASS}
          />
        </div>
        <LabeledSelect label='Level' value={meta.level ?? NO_LEVEL} options={LEVEL_OPTIONS} onChange={(value) => patchMeta({ level: value === NO_LEVEL ? undefined : (value as LessonLevel) })} />
      </div>

      <PanelHeading>Metrics</PanelHeading>
      <p className='text-[9px] leading-relaxed text-muted-foreground'>Each metric gets a box in the Narration of every lesson step.</p>
      {meta.metrics.map((metric, index) => (
        <div key={`${index}:${meta.metrics.length}:${metric.id}:${rev}`} className='flex items-center gap-2'>
          <MetricIdField id={metric.id} taken={(id) => meta.metrics.some((m) => m.id === id)} onCommit={(id) => edit((c) => renameMetric(c, index, id))} />
          <DraftInput
            aria-label='Metric label'
            value={metric.label}
            placeholder='Label'
            onChange={(label) => patchMeta({ metrics: meta.metrics.map((m, i) => (i === index ? { ...m, label } : m)) })}
            className={INPUT_CLASS}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label={`Remove metric ${metric.id}`}
            onClick={() =>
              edit((c) => ({
                ...c,
                meta: { ...c.meta, metrics: c.meta.metrics.filter((_, i) => i !== index) },
                steps: c.steps.map((step) => {
                  const { [metric.id]: _gone, ...rest } = step.metrics;
                  void _gone;
                  return { ...step, metrics: rest };
                }),
              }))
            }
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <Button type='button' variant='outline' size='sm' className='text-[11px]' onClick={() => patchMeta({ metrics: [...meta.metrics, { id: nextMetricId(meta.metrics.map((m) => m.id)), label: '' }] })}>
        <Plus size={12} /> Add metric
      </Button>

      <PanelHeading>Goals</PanelHeading>
      <p className='text-[9px] leading-relaxed text-muted-foreground'>What the learner should be able to do, and the lesson step that delivers it.</p>
      {meta.goals.map((goal, index) => (
        <div key={`${index}:${meta.goals.length}:${rev}`} className='flex items-center gap-2'>
          <DraftInput
            aria-label='Goal'
            value={goal.text}
            placeholder='Goal'
            onChange={(text) => patchMeta({ goals: meta.goals.map((g, i) => (i === index ? { ...g, text } : g)) })}
            className={INPUT_CLASS}
          />
          <div className='w-44 shrink-0'>
            <LabeledSelect hideLabel label='Lesson step' value={goal.step} options={stepOptions} onChange={(step) => patchMeta({ goals: meta.goals.map((g, i) => (i === index ? { ...g, step } : g)) })} />
          </div>
          <Button type='button' variant='ghost' size='icon-sm' aria-label='Remove goal' onClick={() => patchMeta({ goals: meta.goals.filter((_, i) => i !== index) })}>
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <Button type='button' variant='outline' size='sm' className='text-[11px]' onClick={() => patchMeta({ goals: [...meta.goals, { text: '', step: steps[0].id }] })}>
        <Plus size={12} /> Add goal
      </Button>
    </div>
  );
}

/** Lesson-wide details: title, summary, minutes, level, metrics and goals.
 *  Every change goes through `editLesson(updateMeta…)`; a stretch of typing
 *  is one undo step. */
export function LessonInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const historyGestures = useHistoryGestureScope();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl border border-border bg-popover'>
        <div {...historyGestures} className='contents'>
          <DialogHeader>
            <DialogTitle>Lesson info</DialogTitle>
            <DialogDescription>Details about the whole lesson, shown to learners before and after the lesson steps.</DialogDescription>
          </DialogHeader>
          <InfoForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
