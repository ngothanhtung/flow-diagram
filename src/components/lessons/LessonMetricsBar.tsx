import { stepMetricValue, type LessonMetric, type LessonStep } from '@/lib/lesson/lesson-types';

/**
 * The lesson's metrics as a row of tiles above the drawing — the strip
 * system-design-tutorials shows over its stage. Each tile is the current
 * Lesson step's value ("—" when it has none); a tile whose value changed
 * from the previous Lesson step carries an accent bar, so the learner sees
 * what this step moved. Scrolls sideways when there are more than fit.
 */
export function LessonMetricsBar({ metrics, step, previous }: { metrics: LessonMetric[]; step: LessonStep | undefined; previous: LessonStep | undefined }) {
  if (metrics.length === 0 || !step) return null;
  return (
    <section aria-label='Metrics' className='shrink-0 border-b border-border bg-card/40 px-4 py-2.5 font-reading sm:px-6'>
      <dl className='flex gap-2 overflow-x-auto'>
        {metrics.map((metric) => {
          const value = stepMetricValue(step, metric.id);
          const changed = previous !== undefined && value !== '' && value !== stepMetricValue(previous, metric.id);
          return (
            <div
              key={metric.id}
              data-changed={String(changed)}
              className={`relative min-w-32 shrink-0 rounded-lg bg-card px-3 py-1.5 ring-1 ring-border transition-colors ${changed ? 'ring-emerald-500/40 before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-emerald-500' : ''}`}
            >
              <dt className='whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>{metric.label}</dt>
              <dd className='whitespace-nowrap font-code text-sm font-semibold tabular-nums text-foreground'>{value || '—'}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
