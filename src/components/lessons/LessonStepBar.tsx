'use client';

import { ChevronDown, Copy, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditorStore } from '@/lib/editor-store';
import type { FlowDocumentJSON } from '@/lib/flowchart-types';
import { addStep, duplicateStep, moveStep, presenceWarnings, removeStep } from '@/lib/lesson/lesson-edit';
import type { LessonContent } from '@/lib/lesson/lesson-types';

/** How a warning names an Element: its title / label, else something readable. */
function elementName(diagram: FlowDocumentJSON, id: string): string {
  const node = diagram.nodes.find((entry) => entry.id === id);
  if (node) return node.title?.trim() || id;
  const edge = diagram.edges.find((entry) => entry.id === id);
  if (!edge) return id;
  if (edge.label?.trim()) return edge.label.trim();
  const end = (nodeId: string) => diagram.nodes.find((entry) => entry.id === nodeId)?.title?.trim() || nodeId;
  return `Line ${end(edge.from)} → ${end(edge.to)}`;
}

/** Runs a lesson-edit operation that also yields a step id, and shows that step. */
function editAndShow(operation: (content: LessonContent) => { content: LessonContent; stepId: string }) {
  const store = useEditorStore.getState();
  let shown: string | null = null;
  store.editLesson((content) => {
    const result = operation(content);
    shown = result.stepId;
    return result.content;
  });
  if (shown !== null) useEditorStore.getState().setLessonStep(shown);
}

/**
 * The Lesson editor's bottom bar: one chip per Lesson step in order
 * (click to show it, drag to reorder, its menu to duplicate or delete),
 * Add lesson step, and a warning when some Element is never shown.
 * Reads and writes the store directly; every change is one undo step.
 */
export function LessonStepBar() {
  const lesson = useEditorStore((state) => state.lesson);
  const lessonStepId = useEditorStore((state) => state.lessonStepId);
  const doc = useEditorStore((state) => state.doc);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const neverShown = useMemo(() => (lesson ? presenceWarnings(lesson, doc).map((warning) => elementName(doc, warning.elementId)) : []), [lesson, doc]);

  if (!lesson) return <footer className='h-12 shrink-0 border-t border-border' />;
  const steps = lesson.steps;
  const currentId = steps.some((step) => step.id === lessonStepId) ? lessonStepId : steps[0]?.id;

  const endDrag = () => {
    setDragging(null);
    setDropIndex(null);
  };
  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    const id = dragging ?? event.dataTransfer.getData('text/plain');
    endDrag();
    if (id) useEditorStore.getState().editLesson((content) => moveStep(content, id, index));
  };

  return (
    <footer className='flex shrink-0 items-center gap-2 border-t border-border bg-background px-3 py-2 sm:px-6' aria-label='Lesson steps'>
      <ol className='flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:thin]'>
        {steps.map((step, index) => {
          const selected = step.id === currentId;
          const label = `${index + 1}. ${step.short.trim() || 'Untitled'}`;
          return (
            <li
              key={step.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', step.id);
                setDragging(step.id);
              }}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (dropIndex !== index) setDropIndex(index);
              }}
              onDragLeave={() => {
                if (dropIndex === index) setDropIndex(null);
              }}
              onDrop={(event) => onDrop(event, index)}
              onDragEnd={endDrag}
              data-lesson-step={step.id}
              className={[
                'flex shrink-0 items-center rounded-md ring-1 transition',
                selected ? 'bg-sky-500/15 text-sky-700 ring-sky-400/60 dark:text-sky-200' : 'bg-muted/40 text-muted-foreground ring-border hover:bg-accent hover:text-accent-foreground',
                dragging === step.id ? 'opacity-50' : '',
                dropIndex === index && dragging !== step.id ? 'ring-2 ring-sky-500' : '',
              ].join(' ')}
            >
              <button
                type='button'
                onClick={() => useEditorStore.getState().setLessonStep(step.id)}
                aria-current={selected ? 'step' : undefined}
                title={step.title.trim() ? `${label} — ${step.title.trim()}` : label}
                className={['h-7 max-w-48 cursor-grab truncate pr-1 pl-2.5 text-xs active:cursor-grabbing', selected ? 'font-semibold' : ''].join(' ')}
              >
                {label}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<button type='button' />} className='grid h-7 w-5 place-items-center rounded-r-md opacity-70 transition hover:opacity-100' aria-label={`Lesson step ${index + 1} actions`}>
                  <ChevronDown size={11} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' side='top' className='w-48 border-border bg-popover'>
                  <DropdownMenuItem className='text-xs' onClick={() => editAndShow((content) => duplicateStep(content, step.id))}>
                    <Copy size={13} />
                    Duplicate lesson step
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant='destructive'
                    className='text-xs'
                    disabled={steps.length <= 1}
                    onClick={() => useEditorStore.getState().editLesson((content) => removeStep(content, step.id))}
                  >
                    <Trash2 size={13} />
                    Delete lesson step
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ol>
      <Button variant='toolbar' size='sm' className='h-7 shrink-0' onClick={() => editAndShow((content) => addStep(content, currentId ?? null))} title='Add a lesson step after the one shown'>
        <Plus size={13} />
        Add lesson step
      </Button>
      {neverShown.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={<span role='img' tabIndex={0} />}
            aria-label={`Not shown in any lesson step: ${neverShown.join(', ')}`}
            className='grid size-7 shrink-0 place-items-center rounded-md text-amber-700 ring-1 ring-amber-400/40 dark:text-amber-300'
            data-testid='presence-warning'
          >
            <TriangleAlert size={14} />
          </TooltipTrigger>
          <TooltipContent side='top' align='end' className='max-w-72'>
            Not shown in any lesson step: {neverShown.join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </footer>
  );
}
