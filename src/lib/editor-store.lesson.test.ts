import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonDocumentOf, selectCanRedo, selectCanUndo, useEditorStore } from './editor-store';
import { saveEditorSession } from './editor-session';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';
import { addStep, removeStep, setOverride, updateStep } from './lesson/lesson-edit';
import { emptyStep, toLessonDocument, type LessonContent, type LessonDocumentJSON } from './lesson/lesson-types';

// Drives the real editor store's lesson branch without React, through its
// actions — the same way `editor-store.test.ts` drives the Diagram side.

const store = () => useEditorStore.getState();
const canUndo = () => selectCanUndo(store());
const canRedo = () => selectCanRedo(store());
const steps = () => store().history.past.length;
const nodeIds = () => store().doc.nodes.map((node) => node.id);

function block(id: string, x: number, y: number): FlowNode {
  return { id, type: 'process', title: id.toUpperCase(), position: { x, y }, width: 120, height: 60 };
}

function line(id: string, from: string, to: string): FlowEdge {
  return { id, from, to };
}

function diagram(): FlowDocumentJSON {
  return { nodes: [block('a', 0, 0), block('b', 300, 0), block('c', 600, 0)], edges: [line('ab', 'a', 'b'), line('bc', 'b', 'c')] };
}

/** Two Lesson steps; `c` and its Line appear from the second, and `c` is muted there. */
function content(): LessonContent {
  const s2 = { ...emptyStep('s2'), short: 'Second', overrides: { c: { effect: 'none' as const } } };
  return {
    meta: { title: 'Caching', summary: '', metrics: [], goals: [] },
    presence: { c: { from: 's2' }, bc: { from: 's2' } },
    steps: [{ ...emptyStep('s1'), short: 'First' }, s2],
  };
}

function lessonDocument(doc: FlowDocumentJSON = diagram(), lesson: LessonContent = content()): LessonDocumentJSON {
  return toLessonDocument(doc, lesson);
}

beforeEach(() => {
  store().closeLesson();
});

describe('editor store lesson branch', () => {
  it('openLesson starts a fresh history on the first step', () => {
    store().onShapeCreate('rounded', { x: 0, y: 0 }, 100, 60);
    expect(canUndo()).toBe(true);

    store().openLesson(lessonDocument());
    expect(store().doc).toEqual(diagram());
    expect(store().lesson).toEqual(content());
    expect(store().lessonStepId).toBe('s1');
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(store().currentDiagramId).toBeNull();
    expect(store().savedSignature).toBeNull();
    expect(store().loadedTemplate).toBeNull();
  });

  it('openLesson clears hydrated, so a Diagram editor mounted later restores its own session', () => {
    useEditorStore.setState({ hydrated: true });
    store().openLesson(lessonDocument());
    expect(store().hydrated).toBe(false);
  });

  it('drawing on a later step stamps presence from that step', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    const id = store().onShapeCreate('rounded', { x: 100, y: 400 }, 120, 60);
    expect(store().lesson!.presence[id]).toEqual({ from: 's2' });
    // Drawing and stamping are one undo step.
    expect(steps()).toBe(1);
    store().undo();
    expect(nodeIds()).not.toContain(id);
    expect(store().lesson!.presence[id]).toBeUndefined();
  });

  it('drawing on the first step stamps nothing', () => {
    store().openLesson(lessonDocument());
    const before = store().lesson;
    const id = store().onShapeCreate('rounded', { x: 100, y: 400 }, 120, 60);
    expect(nodeIds()).toContain(id);
    // Nothing to stamp or prune: the lesson is the very same object.
    expect(store().lesson).toBe(before);
  });

  it('pasting on a later step stamps every pasted element', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    const fragment = { nodes: [block('p', 0, 900), block('q', 300, 900)], edges: [line('pq', 'p', 'q')], edgeStyles: [] };
    const pasted = store().pasteFragment(fragment);
    expect(pasted).toHaveLength(2);
    const pastedLine = store().doc.edges.find((edge) => pasted.includes(edge.from) && pasted.includes(edge.to))!;
    for (const id of [...pasted, pastedLine.id]) expect(store().lesson!.presence[id]).toEqual({ from: 's2' });
  });

  it('a write that sets history itself is not bookkept', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    const before = store().lesson;
    useEditorStore.setState({ doc: { nodes: [block('z', 0, 0)], edges: [] }, history: store().history });
    // Neither `z` stamped nor `c`/`bc` pruned.
    expect(store().lesson).toBe(before);
  });

  it('deleting an element prunes its presence and overrides, and undo restores both', () => {
    store().openLesson(lessonDocument());
    store().selectNode('c');
    store().deleteSelection();
    expect(nodeIds()).not.toContain('c');
    // `c` and its Line are gone, and so is every lesson mention of them.
    expect(store().lesson!.presence).toEqual({});
    expect(store().lesson!.steps[1].overrides).toEqual({});
    expect(steps()).toBe(1);

    store().undo();
    expect(nodeIds()).toContain('c');
    expect(store().lesson!.presence).toEqual({ c: { from: 's2' }, bc: { from: 's2' } });
    expect(store().lesson!.steps[1].overrides).toEqual({ c: { effect: 'none' } });

    store().redo();
    expect(store().lesson!.presence).toEqual({});
  });

  it('editLesson is one undo step and redo re-applies it', () => {
    store().openLesson(lessonDocument());
    store().editLesson((lesson) => updateStep(lesson, 's2', { title: 'Add a cache' }));
    expect(store().lesson!.steps[1].title).toBe('Add a cache');
    expect(steps()).toBe(1);

    store().undo();
    expect(store().lesson!.steps[1].title).toBe('');
    expect(canUndo()).toBe(false);

    store().redo();
    expect(store().lesson!.steps[1].title).toBe('Add a cache');
    expect(canRedo()).toBe(false);
  });

  it('editLesson that changes nothing records nothing', () => {
    store().openLesson(lessonDocument());
    store().editLesson((lesson) => lesson);
    store().editLesson((lesson) => setOverride(lesson, 's2', 'c', { effect: 'none' }));
    expect(canUndo()).toBe(false);
  });

  it('editLesson moves the editor off a removed step', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    store().editLesson((lesson) => removeStep(lesson, 's2'));
    expect(store().lessonStepId).toBe('s1');
  });

  it('editLesson is a no-op outside a lesson', () => {
    store().editLesson((lesson) => updateStep(lesson, 's1', { title: 'x' }));
    expect(store().lesson).toBeNull();
    expect(canUndo()).toBe(false);
  });

  it('replaceLesson is one undo step that restores the previous diagram and lesson', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    const imported = lessonDocument({ nodes: [block('x', 0, 0)], edges: [] }, { meta: { title: 'Imported', summary: '', metrics: [], goals: [] }, presence: {}, steps: [emptyStep('i1')] });

    store().replaceLesson(imported);
    expect(nodeIds()).toEqual(['x']);
    expect(store().lesson!.meta.title).toBe('Imported');
    expect(store().lessonStepId).toBe('i1');
    // Imported as given: bookkeeping neither stamps nor prunes an import.
    expect(store().lesson!.presence).toEqual({});
    expect(steps()).toBe(1);

    store().undo();
    expect(store().doc).toEqual(diagram());
    expect(store().lesson).toEqual(content());
    expect(store().lessonStepId).toBe('s1');
    expect(canUndo()).toBe(false);
  });

  it('undo past a removed step keeps lessonStepId on an existing step', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    let added = '';
    store().editLesson((lesson) => {
      const result = addStep(lesson, 's2');
      added = result.stepId;
      return result.content;
    });
    store().setLessonStep(added);

    store().undo();
    expect(store().lesson!.steps.map((step) => step.id)).toEqual(['s1', 's2']);
    expect(store().lessonStepId).toBe('s1');

    // A step that survives the undo stays the one being edited.
    store().redo();
    store().setLessonStep('s2');
    store().undo();
    expect(store().lessonStepId).toBe('s2');
  });

  it('setLessonStep ignores an id that is not a step of the open lesson', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    store().setLessonStep('nope');
    expect(store().lessonStepId).toBe('s2');
  });

  it('setLessonStep does nothing outside a lesson', () => {
    store().setLessonStep('s1');
    expect(store().lessonStepId).toBeNull();
  });

  it('bookkeeping stamps with an existing step even if lessonStepId went stale', () => {
    store().openLesson(lessonDocument());
    // A stale id slipped in from outside the actions: it is never stamped.
    useEditorStore.setState({ lessonStepId: 'gone' });
    const id = store().onShapeCreate('rounded', { x: 100, y: 400 }, 120, 60);
    // Falls back to the first step, where "from the start" needs no stamp.
    expect(store().lesson!.presence[id]).toBeUndefined();

    store().setLessonStep('s2');
    const later = store().onShapeCreate('rounded', { x: 700, y: 400 }, 120, 60);
    expect(store().lesson!.presence[later]).toEqual({ from: 's2' });
  });

  it('lessonDocumentOf is null outside a lesson and the whole document inside one', () => {
    expect(lessonDocumentOf(store())).toBeNull();
    store().openLesson(lessonDocument());
    expect(lessonDocumentOf(store())).toEqual(lessonDocument());
  });

  it('loadStoredDiagram clears lesson state', () => {
    store().openLesson(lessonDocument());
    store().setLessonStep('s2');
    store().loadStoredDiagram({ id: 'd1', name: 'Diagram', document: diagram(), public: false, createdAt: null, updatedAt: null });
    expect(store().lesson).toBeNull();
    expect(store().lessonStepId).toBeNull();
    // Diagram edits no longer stamp anything.
    store().onShapeCreate('rounded', { x: 0, y: 400 }, 120, 60);
    expect(store().lesson).toBeNull();
  });

  it('openTemplate clears lesson state', () => {
    store().openLesson(lessonDocument());
    store().openTemplate({ name: 'T', category: 'C', description: '', document: diagram() });
    expect(store().lesson).toBeNull();
    expect(store().lessonStepId).toBeNull();
  });

  describe('with a session in localStorage', () => {
    beforeEach(() => {
      const entries = new Map<string, string>();
      const localStorage = {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => void entries.set(key, value),
        removeItem: (key: string) => void entries.delete(key),
        clear: () => entries.clear(),
        key: (index: number) => [...entries.keys()][index] ?? null,
        get length() {
          return entries.size;
        },
      } satisfies Storage;
      vi.stubGlobal('window', { localStorage });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('closeLesson then hydrate restores the diagram session, not the lesson', () => {
      const sessionDoc: FlowDocumentJSON = { nodes: [block('d1', 0, 0)], edges: [] };
      saveEditorSession('u1', { doc: sessionDoc, currentDiagramId: 'd-1', currentDiagramName: 'D', savedSignature: null });

      // The Diagram editor hydrated once already this page load.
      store().hydrate('u1');
      store().openLesson(lessonDocument());
      store().closeLesson();
      expect(store().hydrated).toBe(false);
      expect(store().doc).toEqual({ nodes: [], edges: [] });

      store().hydrate('u1');
      expect(store().doc).toEqual(sessionDoc);
      expect(store().currentDiagramId).toBe('d-1');
      expect(store().lesson).toBeNull();
      expect(store().lessonStepId).toBeNull();
      expect(canUndo()).toBe(false);
    });

    it('hydrate clears lesson state', () => {
      store().openLesson(lessonDocument());
      useEditorStore.setState({ hydrated: false });
      store().hydrate('u1');
      expect(store().lesson).toBeNull();
      expect(store().lessonStepId).toBeNull();
    });
  });
});
