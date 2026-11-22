'use client';

import { Eye } from 'lucide-react';
import { StepNarration } from '@/components/lessons/StepNarration';
import { useEditorStore } from '@/lib/editor-store';

/**
 * The Lesson editor's live Narration preview: the selected Lesson step as
 * learners read it (the player's own `StepNarration`), updating as you type
 * in the left panel. Sits right of the canvas; the Inspector, when open,
 * stays at the far right and this panel moves in beside it.
 */
export function LessonNarrationPreview() {
  const lesson = useEditorStore((state) => state.lesson);
  const stepId = useEditorStore((state) => state.lessonStepId);
  if (!lesson) return null;
  const index = Math.max(0, lesson.steps.findIndex((s) => s.id === stepId));
  const step = lesson.steps[index];
  return (
    <div className='flex h-full min-h-0 flex-col font-reading'>
      <div className='flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
        <Eye size={12} /> Narration preview
      </div>
      <div className='min-h-0 flex-1 space-y-3 overflow-y-auto p-4'>{step ? <StepNarration step={step} index={index} count={lesson.steps.length} /> : <p className='text-sm text-muted-foreground'>This lesson has no steps.</p>}</div>
    </div>
  );
}
