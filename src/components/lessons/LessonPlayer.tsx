'use client';

import { AlertTriangle, ChevronLeft, ChevronRight, Check, Lightbulb, Lock, Maximize, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlowCanvas } from '@/components/FlowCanvas';
import { NarrationText } from '@/components/lessons/NarrationText';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { parseChangeLine } from '@/lib/lesson/narration';
import { resolveStepView } from '@/lib/lesson/lesson-step-view';
import { CALLOUT_KINDS, LESSON_CHAPTERS, contentOf, lessonNameOf, stepMetricValue, type CalloutKind, type LessonDocumentJSON } from '@/lib/lesson/lesson-types';

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

const noop = () => undefined;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || ['textbox', 'spinbutton', 'combobox', 'slider'].includes(target.getAttribute('role') ?? '');
}

/**
 * Presentation of a Lesson: the Diagram stepped through its Lesson steps
 * beside the Narration. Pure view — owns only the current step, the set of
 * steps visited this session (for goal checkmarks), pause and fit.
 */
export function LessonPlayer({ lesson, initialStepId, onClose, headerEnd }: { lesson: LessonDocumentJSON; initialStepId?: string; onClose?: () => void; headerEnd?: ReactNode }) {
  const content = useMemo(() => contentOf(lesson), [lesson]);
  const steps = lesson.steps;
  const count = steps.length;
  const [nav, setNav] = useState(() => {
    const start = Math.max(0, steps.findIndex((s) => s.id === initialStepId));
    return { index: start, visited: new Set<string>(steps[start] ? [steps[start].id] : []) };
  });
  const [paused, setPaused] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  const index = Math.min(nav.index, Math.max(0, count - 1));
  const step = steps[index];

  const goTo = useCallback(
    (target: number) => {
      if (count === 0) return;
      const next = Math.min(Math.max(target, 0), count - 1);
      setNav((cur) => ({ index: next, visited: new Set(cur.visited).add(steps[next].id) }));
    },
    [count, steps],
  );

  const view = useMemo(() => resolveStepView(lesson.diagram, content, step?.id ?? '', 'viewer'), [lesson.diagram, content, step?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft') { goTo(index - 1); event.preventDefault(); }
      else if (event.key === 'ArrowRight') { goTo(index + 1); event.preventDefault(); }
      else if (event.key === ' ') {
        if (event.repeat) { event.preventDefault(); return; }
        // A focused button keeps its own Space meaning.
        if (event.target instanceof HTMLElement && ['BUTTON', 'A'].includes(event.target.tagName)) return;
        setPaused((p) => !p);
        event.preventDefault();
      } else if (event.key === '0') setFitSignal((n) => n + 1);
      else if (event.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, onClose]);

  const { meta } = lesson;
  const chapter = step?.chapter ? LESSON_CHAPTERS[step.chapter] : null;
  const callout = step?.callout && CALLOUT_KINDS.includes(step.callout.kind) ? step.callout : null;

  return (
    <div className='flex h-dvh flex-col bg-background text-foreground'>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-3 sm:px-6'>
        <div className='flex min-w-0 items-baseline gap-3'>
          <h1 className='truncate text-base font-semibold'>{lessonNameOf(lesson)}</h1>
          {meta.minutes !== undefined && <span className='shrink-0 text-xs text-muted-foreground'>{meta.minutes} min</span>}
          {meta.level && <span className='shrink-0 text-xs capitalize text-muted-foreground'>{meta.level}</span>}
        </div>
        <div className='flex items-center gap-2'>
          {headerEnd}
          <Button variant='toolbar' size='icon-lg' title='Full screen' aria-label='Full screen' onClick={() => void document.documentElement.requestFullscreen?.().catch(noop)}>
            <Maximize size={13} />
          </Button>
          <ThemeToggle variant='toolbar' size='icon-lg' />
          {onClose && (
            <Button variant='toolbar' size='lg' onClick={onClose} title='Close (Esc)'>
              <X size={13} />
              <span className='hidden sm:inline'>Close</span>
            </Button>
          )}
        </div>
      </header>

      <main className='flex min-h-0 flex-1 flex-col lg:flex-row'>
        <section className='relative min-h-0 flex-1 overflow-hidden bg-background'>
          <FlowCanvas
            document={view.document}
            readOnly
            elementLooks={view.looks}
            fitSignal={fitSignal}
            runningEdgeIds={null}
            nodeExecutionStates={undefined}
            effectsPaused={paused}
            infoOpen={false}
            onToggleInfo={noop}
            selectedNodeId={null}
            onSelectNode={noop}
            onNodeMove={noop}
            onNodeResize={noop}
            onNodeDragStart={noop}
            onNodeDragEnd={noop}
            onConnect={noop}
            isDragging={false}
            linkingFromId={null}
            onLinkStart={noop}
            onLinkMove={noop}
            onLinkEnd={noop}
            selectedEdgeId={null}
            onSelectEdge={noop}
            onEdgeReconnect={noop}
            onEdgeUpdate={noop}
            activeShape={null}
            onShapeDrawn={noop}
          />
        </section>

        <aside className='flex max-h-[50%] min-h-0 shrink-0 flex-col border-t border-border lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l' aria-label='Narration'>
          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto p-4'>
            {step ? (
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
                {meta.metrics.length > 0 && (
                  <dl className='grid grid-cols-2 gap-2'>
                    {meta.metrics.map((m) => (
                      <div key={m.id} className='rounded-lg bg-card px-3 py-2 ring-1 ring-border'>
                        <dt className='text-[10px] uppercase tracking-wider text-muted-foreground'>{m.label}</dt>
                        <dd className='text-sm font-semibold'>{stepMetricValue(step, m.id) || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </>
            ) : (
              <p className='text-sm text-muted-foreground'>This lesson has no steps.</p>
            )}
          </div>

          <div className='space-y-3 border-t border-border p-4'>
            <div className='flex items-center justify-between gap-2'>
              <Button variant='toolbar' size='lg' disabled={index <= 0} onClick={() => goTo(index - 1)} title='Previous (Left arrow)'>
                <ChevronLeft size={13} /> Previous
              </Button>
              <div className='flex flex-wrap items-center justify-center gap-1.5'>
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type='button'
                    onClick={() => goTo(i)}
                    title={s.short || s.title}
                    aria-label={`Go to lesson step ${i + 1}`}
                    aria-current={i === index ? 'step' : undefined}
                    className={`size-2.5 rounded-full transition ${i === index ? 'bg-primary' : nav.visited.has(s.id) ? 'bg-primary/40' : 'bg-border'}`}
                  />
                ))}
              </div>
              <Button variant='toolbar' size='lg' disabled={index >= count - 1} onClick={() => goTo(index + 1)} title='Next (Right arrow)'>
                Next <ChevronRight size={13} />
              </Button>
            </div>
            {meta.goals.length > 0 && (
              <ul className='space-y-1 text-xs'>
                {meta.goals.map((goal, i) => {
                  const done = nav.visited.has(goal.step);
                  const target = steps.findIndex((s) => s.id === goal.step);
                  return (
                    <li key={i}>
                      <button type='button' disabled={target < 0} onClick={() => goTo(target)} className='flex w-full items-start gap-2 text-left hover:text-foreground disabled:cursor-default'>
                        <span className={`mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full ring-1 ${done ? 'bg-emerald-500/20 text-emerald-600 ring-emerald-500/50 dark:text-emerald-400' : 'text-transparent ring-border'}`}>
                          {target < 0 ? <Lock size={8} /> : <Check size={9} />}
                        </span>
                        <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{goal.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
