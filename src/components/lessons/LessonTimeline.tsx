import type { LessonStep } from '@/lib/lesson/lesson-types';

/**
 * "In this lesson": every Lesson step as a numbered stop on a rail, its short
 * name underneath — the timeline system-design-tutorials shows under its
 * stage. The rail fills up to the current Lesson step; steps before it read
 * as done (solid green), the current one is green (#52c41a) with a soft ripple.
 * Click a stop to go there. Scrolls sideways when there are more steps than fit.
 */
export function LessonTimeline({ steps, index, onSelect }: { steps: LessonStep[]; index: number; onSelect: (index: number) => void }) {
  const count = steps.length;
  if (count === 0) return null;
  const filled = count > 1 ? (index / (count - 1)) * 100 : 0;
  // The rail runs from the centre of the first stop to the centre of the last.
  const inset = `calc(100% / ${count} / 2)`;

  return (
    <section aria-label='Lesson steps' className='shrink-0 border-t border-border bg-card/40 px-4 pt-1.5 pb-2 font-reading sm:px-6'>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>In this lesson</span>
        <span className='text-xs font-medium tabular-nums text-muted-foreground'>{`Lesson step ${index + 1} of ${count}`}</span>
      </div>
      {/* pt-1: room for the current stop's ripple, which this scroller would otherwise clip. */}
      <div className='overflow-x-auto pt-1'>
        <div className='relative mt-2' style={{ minWidth: `${count * 3.75}rem` }}>
          <div aria-hidden='true' className='absolute top-[13px] h-px bg-foreground/25' style={{ left: inset, right: inset }}>
            <span className='absolute -inset-y-px left-0 bg-emerald-600/70 transition-[width] duration-700 ease-in-out dark:bg-emerald-400/60' style={{ width: `${filled}%` }} />
          </div>
          <ol className='relative grid' style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {steps.map((step, i) => {
              const current = i === index;
              const done = i < index;
              const label = step.short || step.title || `Lesson step ${i + 1}`;
              // Seen = solid green; the step on screen stands out in green (#52c41a).
              const dot = current
                ? 'scale-110 border-[#95de64] bg-[#52c41a] text-white shadow-[0_0_0_3px_rgba(82,196,26,0.25)]'
                : done
                  ? 'border-emerald-300 bg-emerald-700 text-white dark:border-emerald-200 dark:bg-emerald-800 group-hover:-translate-y-px'
                  : 'border-border bg-card text-foreground group-hover:-translate-y-px group-hover:bg-accent';
              return (
                <li key={step.id} className='min-w-0'>
                  <button
                    type='button'
                    aria-current={current ? 'step' : undefined}
                    title={step.title || label}
                    onClick={() => onSelect(i)}
                    className='group flex w-full flex-col items-center px-0.5 focus-visible:outline-none'
                  >
                    <span className='relative grid size-[26px] place-items-center'>
                      {/* A soft green ring pulses out of the current stop (none when the OS asks for less motion). */}
                      {current && <span aria-hidden='true' className='absolute inset-0 rounded-full bg-[#52c41a] motion-safe:animate-[lesson-step-ripple_2s_ease-out_infinite] motion-reduce:hidden' />}
                      <span className={`relative grid size-[26px] place-items-center rounded-full border text-xs font-semibold tabular-nums transition group-focus-visible:ring-2 group-focus-visible:ring-ring ${dot}`}>{i + 1}</span>
                    </span>
                    <span className={`mt-1.5 line-clamp-2 min-h-[2.7em] text-center text-xs leading-[1.35] ${current ? 'font-semibold text-foreground' : done ? 'text-foreground/85' : 'text-muted-foreground'}`}>{label}</span>
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
