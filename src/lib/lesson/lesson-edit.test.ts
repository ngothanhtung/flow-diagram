import { describe, expect, it } from 'vitest';
import type { FlowDocumentJSON, FlowNode } from '../flowchart-types';
import {
  addStep, duplicateStep, moveStep, presenceWarnings, pruneMissingElements, removeFromStep,
  removeStep, setOverride, setPresence, stampNewElements, updateMeta, updateStep,
} from './lesson-edit';
import { resolveStepView } from './lesson-step-view';
import { emptyStep, type ElementPresence, type LessonContent } from './lesson-types';

const node = (id: string): FlowNode => ({ id, type: 'process', title: id, position: { x: 0, y: 0 } }) as FlowNode;
const diagram: FlowDocumentJSON = { nodes: [node('x'), node('y')], edges: [{ id: 'xy', from: 'x', to: 'y' }] };

function make(presence: Record<string, ElementPresence> = {}, ids = ['s1', 's2', 's3']): LessonContent {
  return {
    meta: { title: 'T', summary: '', metrics: [], goals: [] },
    presence,
    steps: ids.map((id) => emptyStep(id)),
  };
}
const ids = (c: LessonContent) => c.steps.map((s) => s.id);

describe('lesson-edit', () => {
  it('addStep inserts after the given step with a fresh id', () => {
    const r = addStep(make(), 's1');
    expect(r.stepId).toBe('s4');
    expect(ids(r.content)).toEqual(['s1', 's4', 's2', 's3']);
  });

  it('addStep(null) appends at the end', () => {
    const r = addStep(make(), null);
    expect(ids(r.content)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('duplicateStep copies narration and overrides under a new id', () => {
    let c = make();
    c = updateStep(c, 's2', { short: 'Cache', body: 'Hello', changes: ['a'] });
    c = setOverride(c, 's2', 'x', { emphasis: true });
    const r = duplicateStep(c, 's2');
    expect(ids(r.content)).toEqual(['s1', 's2', 's4', 's3']);
    const copy = r.content.steps[2];
    expect(copy).toMatchObject({ id: 's4', short: 'Cache copy', body: 'Hello', changes: ['a'], overrides: { x: { emphasis: true } } });
    expect(copy.overrides).not.toBe(c.steps[1].overrides);
  });

  it('removeStep moves from/until and goals to the next step', () => {
    const c = updateMeta(make({ x: { from: 's2' }, y: { until: 's2' } }), { goals: [{ text: 'g', step: 's2' }] });
    const r = removeStep(c, 's2');
    expect(ids(r)).toEqual(['s1', 's3']);
    expect(r.presence.x.from).toBe('s3');
    expect(r.presence.y.until).toBe('s3');
    expect(r.meta.goals[0].step).toBe('s3');
  });

  it('removeStep of the last step moves from back and drops until', () => {
    const r = removeStep(make({ x: { from: 's3' }, y: { until: 's3' } }), 's3');
    expect(r.presence.x.from).toBe('s2');
    expect(r.presence.y).toBeUndefined();
  });

  it('removeStep refuses to remove the only step', () => {
    const c = make({}, ['s1']);
    expect(removeStep(c, 's1')).toBe(c);
  });

  it('moveStep reorders without touching references', () => {
    const c = make({ x: { from: 's2', until: 's3' } });
    const r = moveStep(c, 's1', 2);
    expect(ids(r)).toEqual(['s2', 's3', 's1']);
    expect(r.presence).toBe(c.presence);
  });

  it('presenceWarnings flags until-before-from after a move', () => {
    const c = moveStep(make({ x: { from: 's2', until: 's3' } }), 's3', 0);
    expect(presenceWarnings(c, diagram)).toContainEqual({ elementId: 'x', kind: 'never-visible' });
    for (const s of ids(c)) {
      const v = resolveStepView(diagram, c, s, 'viewer');
      expect(v.visibleIds.has('x')).toBe(false);
    }
  });

  it('presenceWarnings respects visible overrides', () => {
    let c = make({ x: { from: 's3', until: 's2' } });
    expect(presenceWarnings(c, diagram)).toHaveLength(1);
    c = setOverride(c, 's1', 'x', { visible: true });
    expect(presenceWarnings(c, diagram)).toEqual([]);
  });

  it('removeFromStep sets until on every id', () => {
    const r = removeFromStep(make({ x: { from: 's1' } }), ['x', 'y'], 's3');
    expect(r.presence).toEqual({ x: { from: 's1', until: 's3' }, y: { until: 's3' } });
  });

  it('setPresence deletes the entry for null or an empty presence', () => {
    const c = make({ x: { from: 's2' } });
    expect(setPresence(c, 'x', null).presence).toEqual({});
    expect(setPresence(c, 'x', {}).presence).toEqual({});
    expect(setPresence(c, 'x', { until: 's3' }).presence).toEqual({ x: { until: 's3' } });
  });

  it('setOverride merges, deletes undefined keys and drops empty overrides', () => {
    let c = setOverride(make(), 's1', 'x', { title: 'A', emphasis: true });
    c = setOverride(c, 's1', 'x', { label: 'L' });
    expect(c.steps[0].overrides.x).toEqual({ title: 'A', emphasis: true, label: 'L' });
    c = setOverride(c, 's1', 'x', { title: undefined, label: undefined });
    expect(c.steps[0].overrides.x).toEqual({ emphasis: true });
    c = setOverride(c, 's1', 'x', { emphasis: undefined });
    expect(c.steps[0].overrides).toEqual({});
  });

  it('stampNewElements marks only new ids, and nothing on the first step', () => {
    const after: FlowDocumentJSON = { nodes: [...diagram.nodes, node('z')], edges: diagram.edges };
    const c = make();
    expect(stampNewElements(c, diagram, after, 's2').presence).toEqual({ z: { from: 's2' } });
    expect(stampNewElements(c, diagram, after, 's1')).toBe(c);
    expect(stampNewElements(c, diagram, after, null)).toBe(c);
  });

  it('pruneMissingElements drops entries for deleted ids', () => {
    let c = make({ x: { from: 's2' }, gone: { from: 's2' } });
    c = setOverride(c, 's1', 'gone', { emphasis: true });
    c = setOverride(c, 's1', 'x', { emphasis: true });
    const r = pruneMissingElements(c, diagram);
    expect(Object.keys(r.presence)).toEqual(['x']);
    expect(Object.keys(r.steps[0].overrides)).toEqual(['x']);
    expect(pruneMissingElements(r, diagram)).toBe(r);
  });
});
