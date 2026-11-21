import { describe, expect, it } from 'vitest';
import { normalizeLessonDocument } from './lesson-normalize';
import { emptyLessonDocument } from './lesson-types';

const block = (id: string) => ({ id, type: 'process', title: id, position: { x: 0, y: 0 } });
const edge = (id: string, from: string, to: string) => ({ id, from, to });

/** A lesson over nodes a, b and edge e, built from raw JSON so tests can break it. */
function lessonWith(patch: Record<string, unknown> = {}, step: Record<string, unknown> = {}) {
  const base = emptyLessonDocument('T') as unknown as Record<string, unknown>;
  const steps = base.steps as Record<string, unknown>[];
  return {
    ...base,
    diagram: { nodes: [block('a'), block('b')], edges: [edge('e', 'a', 'b')] },
    steps: [{ ...steps[0], ...step }],
    ...patch,
  };
}

function ok(input: unknown) {
  const result = normalizeLessonDocument(input);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('normalizeLessonDocument', () => {
  it('accepts a clean lesson unchanged', () => {
    const input = emptyLessonDocument('A');
    const result = ok(input);
    expect(result.fixes).toEqual([]);
    expect(result.lesson).toEqual(input);
    expect(result.lesson).toBe(input);
  });

  it('refuses non-objects', () => {
    for (const input of [null, 42, []]) expect(normalizeLessonDocument(input).ok).toBe(false);
  });

  it('refuses a diagram that cannot be drawn', () => {
    expect(normalizeLessonDocument({ format: 'x-flow-lesson', version: 1, diagram: { nodes: 'x', edges: [] }, steps: [] }).ok).toBe(false);
  });

  it('imports a plain Diagram JSON as a one-step lesson', () => {
    const result = ok({ nodes: [block('a')], edges: [] });
    expect(result.lesson.steps).toHaveLength(1);
    expect(result.lesson.presence).toEqual({});
    expect(result.lesson.diagram.nodes[0].id).toBe('a');
    expect(result.fixes).toContain('Imported a Diagram as a one-step lesson.');
  });

  it('creates a step when there are none', () => {
    const result = ok(lessonWith({ steps: [] }));
    expect(result.lesson.steps).toHaveLength(1);
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  it('assigns missing and duplicate step ids', () => {
    const base = emptyLessonDocument('A').steps[0];
    const result = ok(lessonWith({ steps: [{ ...base, id: 's1' }, { ...base, id: 's1' }, { ...base, id: undefined }] }));
    const ids = result.lesson.steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(3);
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  it('drops references to missing elements and steps, and non-text change lines', () => {
    const result = ok(
      lessonWith(
        { presence: { ghost: { from: 's1' }, a: { from: 'nope' } }, meta: { title: 'T', summary: '', metrics: [], goals: [{ text: 'g', step: 'nope' }] } },
        { overrides: { ghost: { title: 'x' } }, changes: ['+ a line', 7] },
      ),
    );
    const { lesson } = result;
    expect(lesson.presence.ghost).toBeUndefined();
    expect(lesson.presence.a).toBeUndefined();
    expect(lesson.steps[0].overrides.ghost).toBeUndefined();
    expect(lesson.steps[0].changes).toEqual(['+ a line']);
    expect(lesson.meta.goals).toEqual([]);
  });

  it('drops a presence reference to a missing step but keeps the valid end', () => {
    const { lesson } = ok(lessonWith({ presence: { a: { from: 'nope', until: 's1' } } }));
    expect(lesson.presence.a).toEqual({ until: 's1' });
  });

  it('drops out-of-vocabulary values', () => {
    const { lesson, fixes } = ok(
      lessonWith(
        { meta: { title: 'T', summary: '', level: 'expert', metrics: [], goals: [] } },
        { chapter: 'boss', callout: { kind: 'shout', text: 'x' }, overrides: { a: { effect: 'laser', title: 't' } } },
      ),
    );
    expect(lesson.meta.level).toBeUndefined();
    expect(lesson.steps[0].chapter).toBeUndefined();
    expect(lesson.steps[0].callout).toBeUndefined();
    expect(lesson.steps[0].overrides.a).toEqual({ title: 't' });
    expect(fixes.length).toBeGreaterThan(0);
  });

  it("accepts 'warn' as the warning callout", () => {
    const { lesson } = ok(lessonWith({}, { callout: { kind: 'warn', text: 'x' } }));
    expect(lesson.steps[0].callout?.kind).toBe('warning');
  });

  it('drops metrics with a reserved id (__proto__, constructor, prototype)', () => {
    // JSON.parse keeps "__proto__" as an own key, which is how it arrives from Import.
    const raw = JSON.parse(
      JSON.stringify(lessonWith({ meta: { title: 'T', summary: '', metrics: [{ id: 'trips', label: 'Trips' }], goals: [] } }, { metrics: { trips: '1' } })).replace(
        '[{"id":"trips","label":"Trips"}]',
        '[{"id":"__proto__","label":"P"},{"id":"constructor","label":"C"},{"id":"prototype","label":"Q"},{"id":"trips","label":"Trips"}]',
      ).replace('{"trips":"1"}', '{"__proto__":"x","constructor":"y","trips":"1"}'),
    );
    const { lesson, fixes } = ok(raw);
    expect(lesson.meta.metrics.map((m) => m.id)).toEqual(['trips']);
    expect(Object.keys(lesson.steps[0].metrics)).toEqual(['trips']);
    expect(fixes).toEqual(expect.arrayContaining([expect.stringContaining('reserved id "__proto__"'), expect.stringContaining('reserved id "constructor"'), expect.stringContaining('reserved id "prototype"')]));
  });

  it('coerces metric values to strings and drops unknown metric ids', () => {
    const { lesson } = ok(lessonWith({ meta: { title: 'T', summary: '', metrics: [{ id: 'trips', label: 'Trips' }], goals: [] } }, { metrics: { trips: 3, other: 'x' } }));
    expect(lesson.steps[0].metrics).toEqual({ trips: '3' });
  });

  it('keeps only override fields valid for the element kind', () => {
    const { lesson } = ok(lessonWith({}, { overrides: { a: { label: 'x', title: 't' }, e: { title: 't', label: 'l' } } }));
    expect(lesson.steps[0].overrides.a).toEqual({ title: 't' });
    expect(lesson.steps[0].overrides.e).toEqual({ label: 'l' });
  });

  it('repairs non-string text and bad minutes', () => {
    const { lesson } = ok(lessonWith({ meta: { title: 5, summary: null, minutes: -3, metrics: [], goals: [] } }, { body: 7 }));
    expect(lesson.meta.title).toBe('');
    expect(lesson.meta.summary).toBe('');
    expect(lesson.meta.minutes).toBeUndefined();
    expect(lesson.steps[0].body).toBe('');
  });

  it('does not treat prototype names as ids or vocabulary', () => {
    const { lesson } = ok(lessonWith({}, { chapter: 'constructor', metrics: { constructor: 'x' }, overrides: { constructor: { title: 'x' } } }));
    expect(lesson.steps[0].chapter).toBeUndefined();
    expect(lesson.steps[0].metrics).toEqual({});
    expect(Object.keys(lesson.steps[0].overrides)).toEqual([]);
  });

  it('fills in missing lists instead of returning the input as clean', () => {
    const input = { format: 'x-flow-lesson', version: 1, diagram: { nodes: [], edges: [] }, steps: [{ id: 's1' }] };
    const result = ok(input);
    expect(result.fixes.length).toBeGreaterThan(0);
    const [step] = result.lesson.steps;
    expect([step.changes, step.metrics, step.overrides, step.short, step.title, step.body]).toEqual([[], {}, {}, '', '', '']);
    expect(result.lesson.meta.metrics).toEqual([]);
    expect(result.lesson.presence).toEqual({});
  });

  it('returns a populated, fully valid lesson as the same object with no fixes', () => {
    const lesson = {
      format: 'x-flow-lesson',
      version: 1,
      diagram: { nodes: [block('a'), block('b')], edges: [edge('e', 'a', 'b')] },
      meta: { title: 'T', summary: 'S', minutes: 5, level: 'beginner', metrics: [{ id: 'trips', label: 'Trips' }], goals: [{ text: 'g', step: 's2' }] },
      presence: { a: { from: 's1', until: 's2' }, e: { from: 's2' } },
      steps: [
        { id: 's1', short: 'One', title: 'First', chapter: 'setup', body: 'b', callout: { kind: 'tip', text: 't' }, changes: ['a'], metrics: { trips: '1' }, overrides: { a: { title: 'A', effect: 'glow', emphasis: true } } },
        { id: 's2', short: 'Two', title: 'Second', chapter: 'recap', body: 'b', callout: { kind: 'warning', text: 'w' }, changes: ['b', 'e'], metrics: { trips: '2' }, overrides: { e: { label: 'L', effect: 'comet', visible: false } } },
      ],
    };
    const result = ok(lesson);
    expect(result.fixes).toEqual([]);
    expect(result.lesson).toBe(lesson);
  });

  it('creates an untitled step with a single fix when there are none', () => {
    const result = ok(lessonWith({ steps: [] }));
    expect(result.fixes.filter((fix) => fix.includes('no Lesson steps'))).toHaveLength(1);
    expect(result.lesson.steps).toEqual([{ id: 's1', short: 'Untitled', title: '', body: '', changes: [], metrics: {}, overrides: {} }]);
  });
});
