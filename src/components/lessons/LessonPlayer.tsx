'use client';

import { ArrowLeft, ArrowRight, Check, Keyboard, Lock, Maximize, PanelLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlowCanvas } from '@/components/FlowCanvas';
import { LessonMetricsBar } from '@/components/lessons/LessonMetricsBar';
import { LessonTimeline } from '@/components/lessons/LessonTimeline';
import { StepNarration } from '@/components/lessons/StepNarration';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { resolveStepView } from '@/lib/lesson/lesson-step-view';
import { contentOf, lessonNameOf, type LessonDocumentJSON } from '@/lib/lesson/lesson-types';

const noop = () => undefined;

function Kbd({ children }: { children: string }) {
  return <kbd className='rounded border border-border bg-muted px-1 py-px font-mono text-[10px] leading-none text-foreground/80'>{children}</kbd>;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || ['textbox', 'spinbutton', 'combobox', 'slider'].includes(target.getAttribute('role') ?? '');
}

/**
 * Presentation of a Lesson: the Diagram stepped through its Lesson steps
 * beside the Narration. Pure view — owns only the current step, the set of
 * steps visited this session (for goal checkmarks), pause and fit.
 *
 * In the viewer it can also carry the Course sidebar (`sidebar`: docked on
 * wide screens, a drawer below `lg`), a "Next lesson" link shown on the last
 * Lesson step, and `onReachEnd`, called whenever the last step is shown.
 * The editor's Preview passes none of them.
 */
export function LessonPlayer({
  lesson,
  initialStepId,
  onClose,
  headerEnd,
  sidebar,
  nextLessonHref,
  onReachEnd,
}: {
  lesson: LessonDocumentJSON;
  initialStepId?: string;
  onClose?: () => void;
  headerEnd?: ReactNode;
  sidebar?: ReactNode;
  nextLessonHref?: string;
  onReachEnd?: () => void;
}) {
  const content = useMemo(() => contentOf(lesson), [lesson]);
  const steps = lesson.steps;
  const count = steps.length;
  const [nav, setNav] = useState(() => {
    const start = Math.max(0, steps.findIndex((s) => s.id === initialStepId));
    return { index: start, visited: new Set<string>(steps[start] ? [steps[start].id] : []) };
  });
  const [paused, setPaused] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [dockOpen, setDockOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const atEnd = count > 0 && index === count - 1;
  useEffect(() => {
    if (atEnd) onReachEnd?.();
  }, [atEnd, onReachEnd]);

  const toggleCourse = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setDockOpen((open) => !open);
    else setDrawerOpen(true);
  };

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

  return (
    <div className='flex h-dvh flex-col bg-background text-foreground'>
      <header className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-3 font-reading sm:px-6'>
        <div className='flex min-w-0 items-center gap-3'>
          {sidebar && (
            <Button variant='toolbar' size='icon-lg' title='Course' aria-label='Show or hide the course' onClick={toggleCourse}>
              <PanelLeft size={14} />
            </Button>
          )}
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
        {sidebar && dockOpen && <aside className='hidden min-h-0 w-72 shrink-0 flex-col border-r border-border font-reading lg:flex'>{sidebar}</aside>}
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <LessonMetricsBar metrics={meta.metrics} step={step} previous={index > 0 ? steps[index - 1] : undefined} />
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
          <LessonTimeline steps={steps} index={index} onSelect={goTo} />
        </div>

        <aside className='flex max-h-[50%] min-h-0 shrink-0 flex-col border-t border-border font-reading lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l' aria-label='Narration'>
          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto p-4'>
            {step ? (
              <StepNarration step={step} index={index} count={count} />
            ) : (
              <p className='text-sm text-muted-foreground'>This lesson has no steps.</p>
            )}
          </div>

          <div className='space-y-3 border-t border-border p-4'>
            <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-2'>
              <Button variant='outline' size='lg' className='h-11 px-4' disabled={index <= 0} onClick={() => goTo(index - 1)} title='Previous lesson step (Left arrow)'>
                <ArrowLeft size={14} /> Back
              </Button>
              {atEnd && nextLessonHref ? (
                <Button variant='accent' size='lg' className='h-11 justify-between px-4' nativeButton={false} render={<Link href={nextLessonHref} />} title='Next lesson in the course'>
                  <span className='truncate'>Next lesson</span>
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <Button variant='accent' size='lg' className='h-11 justify-between px-4' disabled={atEnd} onClick={() => goTo(index + 1)} title='Next lesson step (Right arrow)'>
                  <span className='truncate'>{atEnd ? 'Last lesson step' : `Next: ${steps[index + 1]?.short || steps[index + 1]?.title || `Lesson step ${index + 2}`}`}</span>
                  <ArrowRight size={14} />
                </Button>
              )}
            </div>
            <p className='flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground'>
              <Keyboard size={13} aria-hidden='true' />
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              <span>lesson step ·</span>
              <Kbd>Space</Kbd>
              <span>pause ·</span>
              <Kbd>0</Kbd>
              <span>fit</span>
            </p>
            {meta.goals.length > 0 && (
              <section aria-label='What you’ll learn' className='rounded-lg bg-card/60 p-3 ring-1 ring-border'>
                <h3 className='mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>What you’ll learn</h3>
                <ul className='space-y-1.5 text-[13px] leading-snug'>
                  {meta.goals.map((goal, i) => {
                    const done = nav.visited.has(goal.step);
                    const target = steps.findIndex((s) => s.id === goal.step);
                    return (
                      <li key={i}>
                        <button
                          type='button'
                          data-done={String(done)}
                          title={target < 0 ? undefined : `Go to lesson step ${target + 1}`}
                          disabled={target < 0}
                          onClick={() => goTo(target)}
                          className='flex w-full items-start gap-2.5 rounded text-left transition hover:text-foreground disabled:cursor-default'
                        >
                          <span aria-hidden='true' className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border transition ${done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-muted-foreground/50 text-transparent'}`}>
                            {target < 0 ? <Lock size={9} className='text-muted-foreground' /> : <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className={done ? 'text-foreground' : 'text-muted-foreground'}>
                            {goal.text}
                            <span className='sr-only'>{done ? ' (done)' : ''}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </main>

      {sidebar && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side='left' className='w-80 border-border p-0 font-reading'>
            <SheetTitle className='sr-only'>Course</SheetTitle>
            {/* A click on a lesson closes the drawer (the page then changes). */}
            <div className='min-h-0 flex-1 overflow-y-auto [&>nav>div:first-child]:pr-12' onClick={(event) => (event.target as HTMLElement).closest('a') && setDrawerOpen(false)}>
              {sidebar}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
