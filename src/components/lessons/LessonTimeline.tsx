import type { LessonStep } from '@/lib/lesson/lesson-types';

/**
 * "In this lesson": every Lesson step as a numbered stop on a rail, its short
 * name underneath — the timeline system-design-tutorials shows under its
 * stage. The rail fills up to the current Lesson step; steps before it read
 * as done. Click a stop to go there. Scrolls sideways when there are more
 * steps than fit.
 */
export function LessonTimeline({ steps, index, onSelect }: { steps: LessonStep[]; index: number; onSelect: (index: number) => void }) {
  const count = steps.length;
  if (count === 0) return null;
  const filled = count > 1 ? (index / (count - 1)) * 100 : 0;
  // The rail runs from the centre of the first stop to the centre of the last.
  const inset = `calc(100% / ${count} / 2)`;

  return (
    <section aria-label='Lesson steps' className='shrink-0 border-t border-border bg-card/40 px-4 pt-2.5 pb-2 sm:px-6'>
      <div className='flex items-baseline justify-between gap-3 font-mono'>
        <span className='text-[11px] font-bold uppercase tracking-[0.14em] text-foreground'>In this lesson</span>
        <span className='text-[11px] font-semibold text-muted-foreground'>{`Lesson step ${index + 1} of ${count}`}</span>
      </div>
      <div className='overflow-x-auto'>
        <div className='relative mt-2' style={{ minWidth: `${count * 3.75}rem` }}>
          <div aria-hidden='true' className='absolute top-[13px] h-px bg-foreground/25' style={{ left: inset, right: inset }}>
            <span className='absolute -inset-y-px left-0 bg-emerald-600/70 transition-[width] duration-700 ease-in-out dark:bg-emerald-400/60' style={{ width: `${filled}%` }} />
          </div>
          <ol className='relative grid' style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {steps.map((step, i) => {
              const current = i === index;
              const done = i < index;
              const label = step.short || step.title || `Lesson step ${i + 1}`;
              const dot = current
                ? 'scale-110 border-emerald-300 bg-emerald-700 text-white shadow-[1px_1.5px_0_rgba(0,0,0,0.35)] dark:border-emerald-200 dark:bg-emerald-800'
                : done
                  ? 'border-emerald-600/60 bg-emerald-500/15 text-foreground dark:border-emerald-400/50'
                  : 'border-border bg-card text-foreground group-hover:-translate-y-px group-hover:bg-accent';
              return (
                <li key={step.id} className='min-w-0'>
                  <button
                    type='button'
                    aria-current={current ? 'step' : undefined}
                    title={step.title || label}
                    onClick={() => onSelect(i)}
                    className='group flex w-full flex-col items-center px-0.5 font-mono focus-visible:outline-none'
                  >
                    <span className={`grid size-[26px] place-items-center rounded-full border text-[11px] font-bold tabular-nums transition group-focus-visible:ring-2 group-focus-visible:ring-ring ${dot}`}>{i + 1}</span>
                    <span className={`mt-1.5 line-clamp-2 min-h-[2.6em] text-center text-[11px] leading-[1.3] ${current ? 'font-bold text-foreground' : done ? 'text-foreground/80' : 'text-muted-foreground'}`}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
