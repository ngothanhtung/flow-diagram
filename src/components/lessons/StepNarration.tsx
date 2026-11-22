import { AlertTriangle, Lightbulb, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { NarrationText } from '@/components/lessons/NarrationText';
import { parseChangeLine } from '@/lib/lesson/narration';
import { CALLOUT_KINDS, LESSON_CHAPTERS, type CalloutKind, type LessonStep } from '@/lib/lesson/lesson-types';

const CHAPTER_TONE = {
  sand: 'bg-amber-700/10 text-amber-800 ring-amber-700/30 dark:bg-amber-200/10 dark:text-amber-200 dark:ring-amber-200/30',
  red: 'bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300',
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  blue: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-300',
  ink: 'bg-accent text-accent-foreground ring-border',
} as const;

const CALLOUT_STYLE: Record<CalloutKind, { icon: ReactNode; box: string }> = {
  insight: { icon: <Zap size={14} />, box: 'bg-violet-500/10 text-violet-800 ring-violet-500/30 dark:text-violet-200' },
  tip: { icon: <Lightbulb size={14} />, box: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200' },
  warning: { icon: <AlertTriangle size={14} />, box: 'bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-200' },
};

const CHANGE_TONE = { '+': 'text-emerald-600 dark:text-emerald-400', '~': 'text-amber-600 dark:text-amber-400', '-': 'text-red-600 dark:text-red-400' } as const;

/**
 * One Lesson step's Narration as learners read it: chapter tag, position,
 * title, body, callout and "what changed" lines. The player's narration
 * column and the Lesson editor's live preview both render this, so the
 * preview can't drift from what learners get.
 */
export function StepNarration({ step, index, count }: { step: LessonStep; index: number; count: number }) {
  const chapter = step.chapter ? LESSON_CHAPTERS[step.chapter] : null;
  const callout = step.callout && CALLOUT_KINDS.includes(step.callout.kind) ? step.callout : null;
  return (
    <>
      <div className='flex items-center gap-2'>
        {chapter && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${CHAPTER_TONE[chapter.tone]}`}>{chapter.label}</span>}
        <span className='text-xs text-muted-foreground'>Lesson step {index + 1}/{count}</span>
      </div>
      <h2 className='text-lg font-semibold leading-snug'>{step.title || step.short}</h2>
      <div className='text-sm leading-relaxed text-foreground/90'>
        <NarrationText source={step.body} />
      </div>
      {callout && (
        <div className={`flex gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${CALLOUT_STYLE[callout.kind].box}`}>
          <span className='mt-0.5 shrink-0'>{CALLOUT_STYLE[callout.kind].icon}</span>
          <div className='min-w-0'>
            <NarrationText source={callout.text} />
          </div>
        </div>
      )}
      {step.changes.length > 0 && (
        <ul className='space-y-1 text-xs'>
          {step.changes.map((line, i) => {
            const { sign, text } = parseChangeLine(line);
            return (
              <li key={i} className='flex gap-2'>
                <span className={`w-3 shrink-0 text-center font-mono font-bold ${sign ? CHANGE_TONE[sign] : 'text-muted-foreground'}`}>{sign ?? '•'}</span>
                <NarrationText source={text} inline />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
