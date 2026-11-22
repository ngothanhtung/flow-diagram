// Server render of the Lesson player with hostile metric ids. The player
// takes a LessonDocumentJSON by prop; the normalizer drops reserved ids, but
// the player must not crash even on a document that skipped it.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonPlayer } from '@/components/lessons/LessonPlayer';
import { emptyLessonDocument, stepMetricValue, type LessonDocumentJSON } from './lesson-types';

function lessonWithMetrics(ids: string[], values: Record<string, string>): LessonDocumentJSON {
  const base = emptyLessonDocument('Metrics');
  return {
    ...base,
    meta: { ...base.meta, metrics: ids.map((id) => ({ id, label: id.toUpperCase() })) },
    steps: [{ ...base.steps[0], callout: { kind: 'tip', text: 'First paragraph.\n\nSecond paragraph.' }, metrics: values }],
  };
}

describe('stepMetricValue', () => {
  it('reads only own values', () => {
    const step = lessonWithMetrics([], { trips: '3' }).steps[0];
    expect(stepMetricValue(step, 'trips')).toBe('3');
    for (const id of ['__proto__', 'constructor', 'prototype', 'toString', 'missing']) expect(stepMetricValue(step, id)).toBe('');
  });
});

describe('LessonPlayer server render', () => {
  it('renders reserved metric ids as an empty value instead of crashing', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: lessonWithMetrics(['__proto__', 'constructor', 'toString', 'trips'], { trips: '3' }) }));
    expect(html).toContain('TRIPS');
    expect(html).toContain('>3<');
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders every callout paragraph', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: lessonWithMetrics([], {}) }));
    expect(html).toContain('First paragraph.');
    expect(html).toContain('Second paragraph.');
  });
});

describe('LessonPlayer step timeline', () => {
  function threeSteps(): LessonDocumentJSON {
    const base = emptyLessonDocument('Timeline');
    return {
      ...base,
      steps: [
        { ...base.steps[0], id: 's1', short: 'Hit Enter', title: 'You press Enter' },
        { ...base.steps[0], id: 's2', short: 'Find address', title: 'DNS' },
        { ...base.steps[0], id: 's3', short: '', title: 'Connect to the server' },
      ],
    };
  }

  it('lists every Lesson step, numbered, with its short name under it', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: threeSteps(), initialStepId: 's2' }));
    expect(html).toContain('In this lesson');
    expect(html).toContain('Lesson step 2 of 3');
    for (const label of ['Hit Enter', 'Find address']) expect(html).toContain(`>${label}<`);
    // A Lesson step without a short name falls back to its title.
    expect(html).toContain('>Connect to the server<');
    expect(html).toMatch(/aria-current="step"[\s\S]*?<span[^>]*>2</);
  });
});

describe('LessonPlayer Narration blocks', () => {
  it('renders lists, a small heading and a raw code block', () => {
    const base = emptyLessonDocument('Blocks');
    const body = 'Intro.\n\n### Steps\n- one\n- two\n\n1. first\n\n```sql\nSELECT **x** [[y]] <b>\n```';
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: { ...base, steps: [{ ...base.steps[0], body }] } }));
    expect(html).toMatch(/<h4[^>]*>Steps<\/h4>/);
    expect(html).toMatch(/<ul[^>]*><li[^>]*>one<\/li><li[^>]*>two<\/li><\/ul>/);
    expect(html).toMatch(/<ol[^>]*><li[^>]*>first<\/li><\/ol>/);
    expect(html).toMatch(/<pre[^>]*><code[^>]*>SELECT \*\*x\*\* \[\[y\]\] &lt;b&gt;<\/code><\/pre>/);
  });
});

describe('LessonPlayer metrics bar', () => {
  function twoSteps(): LessonDocumentJSON {
    const base = emptyLessonDocument('Metrics bar');
    return {
      ...base,
      meta: { ...base.meta, metrics: [{ id: 'dns', label: 'DNS lookup' }, { id: 'total', label: 'Total' }] },
      steps: [
        { ...base.steps[0], id: 's1', metrics: { dns: '20 ms' } },
        { ...base.steps[0], id: 's2', metrics: { dns: '20 ms', total: '155 ms' } },
      ],
    };
  }

  it('shows the metrics above the drawing, not in the narration column', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: twoSteps(), initialStepId: 's2' }));
    const bar = html.indexOf('aria-label="Metrics"');
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(html.indexOf('aria-label="Narration"'));
    expect(html.slice(html.indexOf('aria-label="Narration"'))).not.toContain('155 ms');
  });

  it('marks the metrics this Lesson step changed', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: twoSteps(), initialStepId: 's2' }));
    expect(html).toMatch(/data-changed="true"[^>]*>(?:(?!data-changed).)*155 ms/);
    expect(html).toMatch(/data-changed="false"[^>]*>(?:(?!data-changed).)*20 ms/);
  });
});

describe('LessonPlayer controls', () => {
  function lesson(): LessonDocumentJSON {
    const base = emptyLessonDocument('Controls');
    return {
      ...base,
      meta: { ...base.meta, goals: [{ text: 'What DNS does', step: 's2' }] },
      steps: [
        { ...base.steps[0], id: 's1', short: 'Hit Enter' },
        { ...base.steps[0], id: 's2', short: 'Find address' },
      ],
    };
  }

  it('names the next Lesson step on the Next button', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: lesson() }));
    expect(html).toContain('Next: Find address');
    expect(html).toContain('Back');
  });

  it('lists the keyboard keys under the buttons', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: lesson() }));
    for (const key of ['←', '→', 'Space', '0']) expect(html).toContain(`>${key}</kbd>`);
  });

  it('shows the goals as a "What you\'ll learn" checklist', () => {
    const html = renderToStaticMarkup(createElement(LessonPlayer, { lesson: lesson() }));
    expect(html).toContain('What you’ll learn');
    // Not visited yet: an empty box. Each goal is a button to its Lesson step.
    expect(html).toMatch(/data-done="false"[^>]*title="Go to lesson step 2"/);
  });
});
