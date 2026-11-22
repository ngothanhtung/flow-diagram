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
    expect(html).toMatch(/aria-current="step"[^>]*>\s*<span[^>]*>2</);
  });
});
