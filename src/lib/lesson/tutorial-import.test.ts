import { describe, expect, it } from 'vitest';
import { normalizeLessonDocument } from './lesson-normalize';
import { resolveStepView } from './lesson-step-view';
import { contentOf } from './lesson-types';
import { convertTutorialLesson, narrationFromHtml, type TutorialImportOptions } from './tutorial-import';

const options: TutorialImportOptions = {
  metricLabel: (id) => (id === 'screenMs' ? 'Screen ready' : id),
  formatMetric: (id, value) => (value === null || value === undefined || value === '—' ? '' : id === 'screenMs' ? `${value} ms` : String(value)),
};

const phone = { type: 'device', x: 0, y: -19, form: 'phone', label: 'mobile app', tags: [] };
const api = { type: 'block', x: 0, y: -7, color: 'blue', glyph: 'globe', label: ['REST', 'API'] };
const link = { pa: { from: 'phone', to: 'api', pts: ['phone', 'api'], heads: 'both', label: 'HTTPS + JSON' } };

const raw = {
  id: 'fake',
  title: 'A fake lesson',
  summary: 'Three steps.',
  minutes: 5,
  level: 'beginner',
  metrics: ['screenMs'],
  goals: [{ text: 'Meet the database', step: 1 }],
  steps: [
    {
      short: 'One',
      chapter: 'setup',
      title: 'First',
      body: ['An <span class="term">API</span> is a contract.'],
      metrics: { screenMs: 210 },
      scene: { entities: { phone, api }, links: link, flows: [{ route: ['pa'], rate: 1, bounce: true }] },
    },
    {
      short: 'Two',
      chapter: 'problem',
      title: 'Second',
      body: ['A database <b>joins</b>.'],
      callout: { kind: 'warn', text: 'Careful.' },
      changes: ['+ A database', '− Nothing else'],
      metrics: { screenMs: null },
      scene: { entities: { phone, api, db: { type: 'db', x: 0, y: 5, r: 2, label: 'users' } }, links: link, flows: [] },
    },
    {
      short: 'Three',
      chapter: 'solution',
      title: 'Third',
      body: ['GraphQL now.'],
      metrics: { screenMs: 140 },
      scene: { entities: { phone, api: { ...api, color: 'purple', label: ['GraphQL'] } }, links: link, flows: [{ route: ['pa'], rate: 1 }] },
    },
  ],
};

describe('narrationFromHtml', () => {
  it('maps the inline tags to Narration markup and decodes entities', () => {
    expect(narrationFromHtml('An <span class="term">API</span> is <b>x</b> and <code>GET</code> &amp; <em>y</em>')).toBe('An [[API]] is **x** and `GET` & *y*');
  });

  it('drops other tags, collapses markup whitespace and lists items one per line', () => {
    expect(narrationFromHtml('<ul class="takeaways">\n  <li>An <b>API</b> is a contract.</li>\n  <li>REST &rarr; simple</li>\n</ul>')).toBe('• An **API** is a contract.\n• REST → simple');
  });

  it('reads a table as one line per row, labelled by its header', () => {
    const html = '<table><thead><tr><th></th><th>Best for</th><th>Watch out</th></tr></thead><tbody><tr><td><b>REST</b></td><td>CRUD</td><td>Many calls</td></tr></tbody></table>';
    expect(narrationFromHtml(html)).toBe('• **REST** — Best for: CRUD; Watch out: Many calls');
  });

  it('never nests markers', () => {
    expect(narrationFromHtml('<b>use <code>GET</code></b>')).toBe('**use GET**');
  });
});

describe('convertTutorialLesson', () => {
  const lesson = convertTutorialLesson(raw, options);
  const content = contentOf(lesson);
  const nodeIds = lesson.diagram.nodes.map((n) => n.id);

  it('passes the lesson gate with no fix', () => {
    const result = normalizeLessonDocument(lesson);
    expect(result.ok && result.fixes).toEqual([]);
  });

  it('carries the narration, callout, changes, metrics and goals', () => {
    expect(lesson.meta).toMatchObject({ title: 'A fake lesson', summary: 'Three steps.', minutes: 5, level: 'beginner', metrics: [{ id: 'screenMs', label: 'Screen ready' }] });
    expect(lesson.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(lesson.meta.goals).toEqual([{ text: 'Meet the database', step: 's2' }]);
    expect(lesson.steps[0]).toMatchObject({ short: 'One', chapter: 'setup', title: 'First', body: 'An [[API]] is a contract.', metrics: { screenMs: '210 ms' } });
    expect(lesson.steps[1].callout).toEqual({ kind: 'warning', text: 'Careful.' });
    expect(lesson.steps[1].changes).toEqual(['+ A database', '- Nothing else']);
    expect(lesson.steps[1].metrics).toEqual({});
  });

  it('draws a data store as a cylinder that fills its box', () => {
    expect(lesson.diagram.nodes.find((n) => n.id === 'db')?.shape).toBe('cylinder');
  });

  it('an entity present only in step 2 is present from step 2 until step 3', () => {
    expect(nodeIds).toContain('db');
    expect(lesson.presence.db).toEqual({ from: 's2', until: 's3' });
  });

  it('a relabelled entity becomes two variants with back-to-back presence', () => {
    const variants = lesson.diagram.nodes.filter((n) => n.id === 'api' || n.id.startsWith('api-'));
    expect(variants.map((n) => n.title)).toEqual(['REST API', 'GraphQL']);
    expect(lesson.presence[variants[0].id]).toEqual({ until: 's3' });
    expect(lesson.presence[variants[1].id]).toEqual({ from: 's3' });
    const third = resolveStepView(lesson.diagram, content, 's3', 'viewer');
    const line = lesson.diagram.edges.find((e) => third.visibleIds.has(e.id));
    expect(line).toMatchObject({ from: 'phone', to: variants[1].id });
  });

  it('a line with a flow in step 1 and none in step 2 is static in step 2', () => {
    const pa = lesson.diagram.edges.find((e) => e.id === 'pa');
    expect(pa?.effect).not.toBe('none');
    expect(pa?.direction).toBe('both');
    expect(lesson.steps[1].overrides.pa).toEqual({ effect: 'none' });
    expect(lesson.steps[0].overrides.pa).toBeUndefined();
  });
});
