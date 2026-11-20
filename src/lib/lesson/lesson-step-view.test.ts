import { describe, expect, it } from 'vitest';
import type { FlowDocumentJSON, FlowNode } from '../flowchart-types';
import { LOOK_TRANSITION, lookStyle, resolveStepView, stepExportDocument } from './lesson-step-view';
import { emptyStep, type ElementOverride, type ElementPresence, type LessonContent } from './lesson-types';

const node = (id: string, extra: Partial<FlowNode> = {}): FlowNode =>
  ({ id, type: 'process', title: id, position: { x: 0, y: 0 }, ...extra }) as FlowNode;

const diagram: FlowDocumentJSON = {
  nodes: [node('a'), node('b'), node('f', { type: 'group' }), node('c', { parentId: 'f' })],
  edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'bc', from: 'b', to: 'c' }],
};

function content(
  presence: Record<string, ElementPresence> = {},
  overrides: Record<string, Record<string, ElementOverride>> = {},
): LessonContent {
  return {
    meta: { title: 'T', summary: '', metrics: [], goals: [] },
    presence,
    steps: ['s1', 's2', 's3', 's4'].map((id) => ({ ...emptyStep(id), overrides: overrides[id] ?? {} })),
  };
}

const view = (c: LessonContent, step: string, mode: 'editor' | 'viewer' = 'viewer') =>
  resolveStepView(diagram, c, step, mode);

describe('resolveStepView', () => {
  it('elements without presence are visible everywhere', () => {
    for (const s of ['s1', 's2', 's3', 's4']) {
      expect([...view(content(), s).visibleIds].sort()).toEqual(['a', 'ab', 'b', 'bc', 'c', 'f']);
    }
  });

  it('from/until is a half-open range in current step order', () => {
    const c = content({ b: { from: 's2', until: 's4' } });
    expect(view(c, 's1').visibleIds.has('b')).toBe(false);
    expect(view(c, 's2').visibleIds.has('b')).toBe(true);
    expect(view(c, 's3').visibleIds.has('b')).toBe(true);
    expect(view(c, 's4').visibleIds.has('b')).toBe(false);
  });

  it("a step's visible override wins over presence", () => {
    const c = content({ b: { until: 's2' } }, { s3: { b: { visible: true } }, s1: { a: { visible: false } } });
    expect(view(c, 's3').visibleIds.has('b')).toBe(true);
    expect(view(c, 's2').visibleIds.has('b')).toBe(false);
    expect(view(c, 's1').visibleIds.has('a')).toBe(false);
  });

  it('a line needs itself and both ends visible', () => {
    const c = content({ b: { from: 's2' } });
    expect(view(c, 's1').visibleIds.has('ab')).toBe(false);
    expect(view(c, 's2').visibleIds.has('ab')).toBe(true);
  });

  it('hiding a frame hides its members', () => {
    const c = content({ f: { from: 's3' } });
    expect(view(c, 's2').visibleIds.has('c')).toBe(false);
    expect(view(c, 's3').visibleIds.has('c')).toBe(true);
  });

  it('entering elements are emphasised after the first step, the rest muted', () => {
    const c = content({ b: { from: 's2' } });
    const s2 = view(c, 's2');
    expect(s2.looks.b).toBe('emphasis');
    expect(s2.looks.a).toBe('muted');
    expect(s2.enteringIds.has('b')).toBe(true);
    const looks1 = Object.values(view(c, 's1').looks);
    expect(looks1).not.toContain('emphasis');
    expect(looks1).not.toContain('muted');
  });

  it('manual emphasis counts at any step', () => {
    const v = view(content({}, { s1: { a: { emphasis: true } } }), 's1');
    expect(v.looks.a).toBe('emphasis');
    expect(v.looks.b).toBe('muted');
  });

  it('hidden elements are ghost in the editor and gone in the viewer', () => {
    const c = content({ b: { from: 's2' } });
    expect(view(c, 's1', 'editor').looks.b).toBe('ghost');
    expect(view(c, 's1', 'viewer').looks.b).toBe('gone');
  });

  it('overrides change title, label and effect only in that step', () => {
    const c = content({}, { s2: { a: { title: 'X', effect: 'glow' }, ab: { label: 'L', effect: 'none' } } });
    const s2 = view(c, 's2').document;
    expect(s2.nodes.find((n) => n.id === 'a')).toMatchObject({ title: 'X', effect: 'glow' });
    expect(s2.edges.find((e) => e.id === 'ab')).toMatchObject({ label: 'L', effect: 'none' });
    expect(s2.nodes).toHaveLength(diagram.nodes.length);
    const s1 = view(c, 's1').document;
    expect(s1.nodes.find((n) => n.id === 'a')).toMatchObject({ title: 'a' });
    expect(s1.nodes.find((n) => n.id === 'a')?.effect).toBeUndefined();
    expect(s1.edges.find((e) => e.id === 'ab')?.label).toBeUndefined();
  });

  it('editor hints name the step', () => {
    const c = content({ b: { from: 's3' }, a: { until: 's3' } }, { s4: { c: { visible: false } } });
    expect(view(c, 's1', 'editor').hints.b).toBe('From lesson step 3');
    expect(view(c, 's4', 'editor').hints.a).toBe('Until lesson step 3');
    expect(view(c, 's4', 'editor').hints.c).toBe('Hidden in this lesson step');
    expect(view(c, 's1', 'viewer').hints).toEqual({});
  });

  it('stepExportDocument keeps only visible elements and fades muted nodes', () => {
    const c = content({ b: { from: 's2' } });
    const out = stepExportDocument(view(c, 's1'));
    expect(out.nodes.map((n) => n.id)).toEqual(['a', 'f', 'c']);
    expect(out.edges).toEqual([]);
    const faded = stepExportDocument(view(c, 's2'));
    expect(faded.nodes.find((n) => n.id === 'a')?.opacity).toBeCloseTo(0.4);
    expect(faded.nodes.find((n) => n.id === 'b')?.opacity).toBeUndefined();
  });

  it('an unknown stepId resolves like the first step', () => {
    const c = content({ b: { from: 's2' } });
    expect(() => view(c, '')).not.toThrow();
    expect(view(c, '').visibleIds).toEqual(view(c, 's1').visibleIds);
  });
});

describe('lookStyle', () => {
  it('maps looks to opacity', () => {
    expect(lookStyle('normal')).toEqual({ opacity: 1 });
    expect(lookStyle('emphasis')).toEqual({ opacity: 1 });
    expect(lookStyle('muted')).toEqual({ opacity: 0.4 });
    expect(lookStyle('ghost')).toEqual({ opacity: 0.18 });
    expect(lookStyle('gone')).toEqual({ opacity: 0, pointerEvents: 'none' });
    expect(LOOK_TRANSITION).toBe('opacity 350ms ease');
  });
});
