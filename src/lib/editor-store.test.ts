import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT } from './doc-history';
import { selectCanRedo, selectCanUndo, useEditorStore } from './editor-store';
import type { FlowDocumentJSON, FlowEdge, FlowNode } from './flowchart-types';

// Drives the real editor store without React, the way the UI does: through
// its actions. `dirty` is computed exactly like `DiagramEditor` does.

const store = () => useEditorStore.getState();
const dirty = () => JSON.stringify(store().doc) !== store().savedSignature;
const canUndo = () => selectCanUndo(store());
const canRedo = () => selectCanRedo(store());
const steps = () => store().history.past.length;
const nodeById = (id: string) => store().doc.nodes.find((node) => node.id === id)!;

function block(id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode {
  return { id, type: 'process', title: id.toUpperCase(), position: { x, y }, width: 120, height: 60, ...extra };
}

function line(id: string, from: string, to: string): FlowEdge {
  return { id, from, to };
}

/** A frame with five members, two lines inside it, one line leaving it, and a loose block. */
function fixture(): FlowDocumentJSON {
  return {
    nodes: [
      block('frame', 400, 300, { type: 'group', width: 800, height: 400 }),
      block('m1', 100, 200, { parentId: 'frame' }),
      block('m2', 250, 200, { parentId: 'frame' }),
      block('m3', 400, 200, { parentId: 'frame' }),
      block('m4', 550, 200, { parentId: 'frame' }),
      block('m5', 700, 200, { parentId: 'frame' }),
      block('loose', 400, 900, { color: '#bae6fd', backgroundColor: '#172554' }),
    ],
    edges: [line('e1', 'm1', 'm2'), line('e2', 'm2', 'm3'), line('e3', 'm5', 'loose')],
    settings: { runMode: 'sequential', edgeStyles: [{ id: 'primary', name: 'Primary', color: '#38bdf8', width: 2 }] },
  };
}

function openDiagram(id = 'd1', document: FlowDocumentJSON = fixture()) {
  store().loadStoredDiagram({ id, name: `Diagram ${id}`, document, public: false, createdAt: null, updatedAt: null });
}

/** A drag the way the canvas does it: one gesture around many moves and the drop. */
function drag(id: string, positions: { x: number; y: number }[]) {
  const gesture = store().beginHistoryGesture();
  for (const position of positions) store().onNodeMove(id, position);
  store().onNodeDrop(id);
  store().endHistoryGesture(gesture);
}

beforeEach(() => {
  openDiagram();
});

describe('editor store undo / redo', () => {
  it('starts a freshly opened diagram with nothing to undo or redo', () => {
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
    expect(dirty()).toBe(false);
  });

  it('a whole drag through many positions is one step', () => {
    drag('loose', [
      { x: 410, y: 910 },
      { x: 480, y: 950 },
      { x: 700, y: 1100 },
    ]);
    expect(nodeById('loose').position).toEqual({ x: 700, y: 1100 });
    expect(steps()).toBe(1);

    store().undo();
    expect(nodeById('loose').position).toEqual({ x: 400, y: 900 });
    expect(canUndo()).toBe(false);
  });

  it('dragging a frame with five members undoes frame and members in one step', () => {
    const before = store().doc;
    store().selectNode('frame');
    drag('frame', [
      { x: 450, y: 320 },
      { x: 520, y: 380 },
    ]);
    expect(nodeById('m3').position).toEqual({ x: 520, y: 280 });
    expect(steps()).toBe(1);

    store().undo();
    expect(store().doc).toEqual(before);
  });

  it('a drag that ends where it started records nothing', () => {
    drag('loose', [
      { x: 500, y: 900 },
      { x: 400, y: 900 },
    ]);
    expect(steps()).toBe(0);
    // A click (gesture with no move) records nothing either.
    drag('loose', []);
    expect(steps()).toBe(0);
  });

  it('a committed title is one step, and undo restores the old title', () => {
    store().onNodeUpdate('loose', { title: 'Hello' });
    expect(steps()).toBe(1);
    store().undo();
    expect(nodeById('loose').title).toBe('LOOSE');
  });

  it('a field writing on every keystroke, inside a typing gesture, is one step', () => {
    const gesture = store().beginHistoryGesture();
    for (const width of [1, 14, 140]) store().onNodeUpdate('loose', { width });
    store().endHistoryGesture(gesture);
    expect(steps()).toBe(1);
    store().undo();
    expect(nodeById('loose').width).toBe(120);
  });

  it('committing the value a field already had records nothing', () => {
    store().onNodeUpdate('loose', { title: 'LOOSE' });
    store().onEdgeUpdate('e1', { label: undefined });
    expect(steps()).toBe(0);
  });

  it('deleting a frame, then undo, restores the frame, its contents and their lines', () => {
    const before = store().doc;
    store().onNodeDelete('frame');
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['loose']);
    expect(store().doc.edges).toHaveLength(0);

    store().undo();
    expect(store().doc).toEqual(before);
  });

  it('editing a line style, then undo, restores the style every line follows', () => {
    store().assignEdgeStyle('e1', 'primary');
    store().assignEdgeStyle('e2', 'primary');
    const styled = store().doc;
    store().upsertEdgeStyle({ id: 'primary', name: 'Primary', color: '#f43f5e', width: 5 });
    expect(store().doc.settings?.edgeStyles?.[0].color).toBe('#f43f5e');

    store().undo();
    expect(store().doc).toEqual(styled);
    expect(store().doc.settings?.edgeStyles?.[0]).toEqual({ id: 'primary', name: 'Primary', color: '#38bdf8', width: 2 });
  });

  it('picking a template over unsaved work is undoable, back to the exact previous diagram', () => {
    store().onNodeUpdate('loose', { title: 'unsaved' });
    const unsaved = store().doc;
    const loadedBefore = store().loadedTemplate;

    store().loadRemoteTemplate({ name: 'ERD', category: 'Data', description: '', document: { nodes: [block('t', 0, 0)], edges: [] } });
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['t']);

    store().undo();
    expect(store().doc).toBe(unsaved);
    expect(store().loadedTemplate).toBe(loadedBefore);
    store().redo();
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['t']);
  });

  it('starters, mermaid, pasted JSON (all loadRemoteTemplate), reset and colour conversion are undoable steps', () => {
    store().onNodeUpdate('loose', { title: 'changed' });
    store().resetToTemplate();
    expect(nodeById('loose').title).toBe('LOOSE');
    store().convertColorTheme();
    expect(steps()).toBe(3);
    store().undo();
    store().undo();
    expect(nodeById('loose').title).toBe('changed');
  });

  it(`${HISTORY_LIMIT + 1} changes leave exactly ${HISTORY_LIMIT} undos`, () => {
    for (let index = 1; index <= HISTORY_LIMIT + 1; index += 1) store().onNodeUpdate('loose', { width: 100 + index });
    let undos = 0;
    while (canUndo()) {
      store().undo();
      undos += 1;
    }
    expect(undos).toBe(HISTORY_LIMIT);
    // The oldest step fell off: undo stops one change short of the original.
    expect(nodeById('loose').width).toBe(101);
  });

  it('a new change after undo disables redo', () => {
    store().onNodeUpdate('loose', { title: 'one' });
    store().onNodeUpdate('loose', { title: 'two' });
    store().undo();
    expect(canRedo()).toBe(true);
    store().onNodeUpdate('loose', { title: 'three' });
    expect(canRedo()).toBe(false);
  });

  it('run mode, repeat and selection never create a step', () => {
    store().applySettings({ runMode: 'concurrent' });
    store().applySettings({ repeatEnabled: true });
    store().selectNode('m1');
    store().toggleNodeSelection('m2');
    store().selectNodes(['m3', 'm4']);
    store().selectEdge('e1');
    store().replay();
    store().advanceStep();
    store().renameDiagram('Renamed');
    store().setDiagramPublic(true);
    expect(canUndo()).toBe(false);
  });

  it('undo and redo keep the current run mode and repeat flag', () => {
    store().onNodeUpdate('loose', { title: 'edited' });
    store().applySettings({ runMode: 'static', repeatEnabled: true });

    store().undo();
    expect(nodeById('loose').title).toBe('LOOSE');
    expect(store().doc.settings?.runMode).toBe('static');
    expect(store().doc.settings?.repeatEnabled).toBe(true);
    // Line styles in the same settings object do come back from the snapshot.
    expect(store().doc.settings?.edgeStyles).toHaveLength(1);

    store().applySettings({ runMode: 'manual' });
    store().redo();
    expect(nodeById('loose').title).toBe('edited');
    expect(store().doc.settings?.runMode).toBe('manual');
  });

  it('save keeps history, and undoing back to the saved document clears dirty', () => {
    store().onNodeUpdate('loose', { title: 'saved title' });
    store().markDiagramSaved('d1', 'Diagram d1', store().doc);
    expect(dirty()).toBe(false);
    expect(canUndo()).toBe(true);

    store().onNodeUpdate('loose', { title: 'after save' });
    expect(dirty()).toBe(true);
    store().undo();
    expect(nodeById('loose').title).toBe('saved title');
    expect(dirty()).toBe(false);

    // Still undoable past the save point.
    store().undo();
    expect(nodeById('loose').title).toBe('LOOSE');
    expect(dirty()).toBe(true);
  });

  it('undoing a template pick brings back the run mode the template replaced — unless the user switched it since', () => {
    store().loadRemoteTemplate({ name: 'Static', category: '', description: '', document: { nodes: [], edges: [], settings: { runMode: 'static' } } });
    store().undo();
    expect(store().doc.settings?.runMode).toBe('sequential');

    store().redo();
    expect(store().doc.settings?.runMode).toBe('static');
    store().applySettings({ runMode: 'manual' });
    store().undo();
    expect(store().doc.settings?.runMode).toBe('manual');
  });

  it('undoing a template pick back to the saved diagram clears dirty', () => {
    store().loadRemoteTemplate({ name: 'ERD', category: 'Data', description: '', document: { nodes: [], edges: [] } });
    expect(dirty()).toBe(true);
    store().undo();
    expect(dirty()).toBe(false);
  });

  it('regression: title edit, template pick, undo twice lands on the saved diagram and clears dirty', () => {
    // The exact sequence of the browser walk-through.
    store().onNodeUpdate('loose', { title: 'Unsaved' });
    store().loadRemoteTemplate({ name: 'T', category: '', description: '', document: { nodes: [block('t1', 0, 0)], edges: [], settings: { runMode: 'manual' } } });
    store().undo();
    expect(nodeById('loose').title).toBe('Unsaved');
    expect(dirty()).toBe(true);
    store().undo();
    expect(dirty()).toBe(false);
    expect(JSON.stringify(store().doc)).toBe(store().savedSignature);
  });

  it('regression: a run mode the user switched away and back keeps the saved key order (not dirty)', () => {
    store().applySettings({ runMode: 'concurrent' });
    store().onNodeUpdate('loose', { title: 'edited' });
    store().undo();
    // Their own choice survives undo, so the document honestly differs from the cloud copy...
    expect(store().doc.settings?.runMode).toBe('concurrent');
    expect(dirty()).toBe(true);
    // ...and switching back makes it stringify exactly as saved again.
    store().applySettings({ runMode: 'sequential' });
    expect(dirty()).toBe(false);
  });

  it('regression: a no-op commit of a resolved default would be a real change — the store records it', () => {
    // Documents why the colour field must not commit the colour it merely
    // displays (see colorFieldCommit): an unset colour made explicit is a
    // content change, so it is both an undo step and "unsaved".
    store().onNodeUpdate('loose', { borderColor: '#ffffff' }); // unset in the fixture
    expect(steps()).toBe(1);
    expect(dirty()).toBe(true);
  });

  it('undo back to saved stays clean when only the run mode changed in between', () => {
    store().onNodeUpdate('loose', { title: 'edited' });
    store().applySettings({ runMode: 'sequential' });
    store().undo();
    expect(dirty()).toBe(false);
  });

  it('opening another diagram clears history', () => {
    store().onNodeUpdate('loose', { title: 'edited' });
    store().undo();
    store().onNodeUpdate('loose', { title: 'again' });
    store().undo();
    expect(canUndo() || canRedo()).toBe(true);

    openDiagram('d2');
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });

  it('opening a template in the template editor clears history', () => {
    store().onNodeUpdate('loose', { title: 'edited' });
    store().openTemplate({ name: 'T', category: 'C', description: '', document: { nodes: [], edges: [] } });
    expect(canUndo()).toBe(false);
    expect(store().currentDiagramId).toBeNull();
  });

  it('a gesture left open is closed by undo, and loading a diagram discards it', () => {
    store().beginHistoryGesture();
    store().onNodeMove('loose', { x: 0, y: 0 });
    store().undo();
    expect(nodeById('loose').position).toEqual({ x: 400, y: 900 });
    expect(store().history.gesture).toBeNull();

    store().beginHistoryGesture();
    openDiagram('d3');
    expect(store().history.gesture).toBeNull();
    store().onNodeUpdate('loose', { title: 'recorded normally' });
    expect(steps()).toBe(1);
  });

  it('undo drops a selection that no longer exists', () => {
    store().onShapeCreate('rectangle', { x: 0, y: 0 }, 100, 60);
    const created = store().doc.nodes.at(-1)!.id;
    store().selectNode(created);
    store().undo();
    expect(store().selectedNodeId).toBeNull();
    expect(store().selectedNodeIds).toEqual([]);
  });

  it('even a raw setState that replaces the document is recorded', () => {
    useEditorStore.setState({ doc: { nodes: [], edges: [] } });
    expect(canUndo()).toBe(true);
    store().undo();
    expect(store().doc.nodes).toHaveLength(7);
  });
});

describe('editor store selection actions (shortcuts and clipboard)', () => {
  it('deleteSelection removes every selected element and the lines touching them as one step; undo restores all', () => {
    const before = store().doc;
    store().selectNodes(['m1', 'm2', 'loose']);
    store().deleteSelection();
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['frame', 'm3', 'm4', 'm5']);
    expect(store().doc.edges).toEqual([]);
    expect(store().selectedNodeIds).toEqual([]);
    expect(steps()).toBe(1);

    store().undo();
    expect(store().doc).toEqual(before);
  });

  it('deleteSelection of a frame takes its contents with it', () => {
    store().selectNode('frame');
    store().deleteSelection();
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['loose']);
    expect(steps()).toBe(1);
  });

  it('deleteSelection with only a line selected deletes that line', () => {
    store().selectEdge('e2');
    store().deleteSelection();
    expect(store().doc.edges.map((edge) => edge.id)).toEqual(['e1', 'e3']);
    expect(store().doc.nodes).toHaveLength(7);
    expect(store().selectedEdgeId).toBeNull();
    expect(steps()).toBe(1);
  });

  it('deleteSelection with nothing selected records nothing', () => {
    store().selectNode(null);
    store().deleteSelection();
    expect(steps()).toBe(0);
  });

  it('duplicateSelection copies the selection with its inner lines as one step and selects the copies', () => {
    store().selectNodes(['m1', 'm2']);
    const ids = store().duplicateSelection();
    expect(ids).toHaveLength(2);
    expect(store().selectedNodeIds).toEqual(ids);
    expect(store().selectedNodeId).toBe(ids[1]);
    const copiedLine = store().doc.edges.at(-1)!;
    expect(copiedLine).toMatchObject({ from: ids[0], to: ids[1] });
    expect(nodeById(ids[0]).position).toEqual({ x: 136, y: 236 });
    // Still inside the frame its originals live in.
    expect(nodeById(ids[0]).parentId).toBe('frame');
    expect(steps()).toBe(1);

    store().undo();
    expect(store().doc.nodes).toHaveLength(7);
    expect(store().selectedNodeIds).toEqual([]);
  });

  it('the inspector Duplicate (onNodeDuplicate) still copies a frame with its contents and names the copy', () => {
    const id = store().onNodeDuplicate('frame')!;
    expect(nodeById(id).title).toBe('FRAME copy');
    expect(store().doc.nodes.filter((node) => node.parentId === id)).toHaveLength(5);
    expect(store().doc.edges).toHaveLength(5);
    expect(steps()).toBe(1);
  });

  it('selectAll selects every element and is not an undo step', () => {
    store().selectAll();
    expect(store().selectedNodeIds).toEqual(store().doc.nodes.map((node) => node.id));
    expect(steps()).toBe(0);
  });

  it('nudgeSelection moves the selection (and a selected frame’s contents) by the delta', () => {
    store().selectNodes(['frame', 'loose']);
    store().nudgeSelection(10, -1);
    expect(nodeById('frame').position).toEqual({ x: 410, y: 299 });
    expect(nodeById('m3').position).toEqual({ x: 410, y: 199 });
    expect(nodeById('loose').position).toEqual({ x: 410, y: 899 });
    expect(steps()).toBe(1);
  });

  it('a held arrow key — many nudges inside one gesture — is one undo step', () => {
    store().selectNode('loose');
    const gesture = store().beginHistoryGesture();
    for (let index = 0; index < 30; index += 1) store().nudgeSelection(1, 0);
    store().endHistoryGesture(gesture);
    expect(nodeById('loose').position).toEqual({ x: 430, y: 900 });
    expect(steps()).toBe(1);
    store().undo();
    expect(nodeById('loose').position).toEqual({ x: 400, y: 900 });
  });

  it('nudge with nothing selected records nothing', () => {
    store().selectNode(null);
    store().nudgeSelection(1, 0);
    expect(steps()).toBe(0);
  });

  it('pasteFragment adds the fragment as one step and selects what was pasted', () => {
    openDiagram('other', { nodes: [block('x', 0, 0)], edges: [], settings: { runMode: 'manual' } });
    const fragment = { nodes: [block('a', 10, 10), block('b', 200, 10)], edges: [line('ab', 'a', 'b'), line('ax', 'a', 'gone')], edgeStyles: [] };
    const ids = store().pasteFragment(fragment);
    expect(ids).toHaveLength(2);
    expect(store().doc.nodes).toHaveLength(3);
    expect(store().doc.edges).toHaveLength(1);
    expect(store().selectedNodeIds).toEqual(ids);
    expect(steps()).toBe(1);
    store().undo();
    expect(store().doc.nodes.map((node) => node.id)).toEqual(['x']);
  });
});

describe('editor store — restoring a Version (PRD v0.3 §4.1)', () => {
  /** What an older Save looked like: the fixture with one block renamed and no edge styles. */
  function olderVersion(): FlowDocumentJSON {
    const document = fixture();
    return {
      ...document,
      nodes: document.nodes.map((node) => (node.id === 'loose' ? { ...node, title: 'Yesterday' } : node)),
      settings: { runMode: 'manual' },
    };
  }

  it('puts the Version on the canvas as an unsaved change, in exactly one undo step', () => {
    expect(dirty()).toBe(false);
    store().restoreVersion(olderVersion());
    expect(nodeById('loose').title).toBe('Yesterday');
    expect(dirty()).toBe(true);
    expect(steps()).toBe(1);

    // One ⌘Z → the content from before the restore, clean again.
    store().undo();
    expect(nodeById('loose').title).toBe('LOOSE');
    expect(dirty()).toBe(false);
    expect(canUndo()).toBe(false);

    store().redo();
    expect(nodeById('loose').title).toBe('Yesterday');
  });

  it('undo brings back unsaved work that the restore replaced', () => {
    store().onNodeUpdate('loose', { title: 'Unsaved edit' });
    store().restoreVersion(olderVersion());
    expect(steps()).toBe(2);
    store().undo();
    expect(nodeById('loose').title).toBe('Unsaved edit');
    expect(dirty()).toBe(true);
  });

  it('keeps the diagram identity, the saved signature and the Reset target', () => {
    const before = store();
    store().restoreVersion(olderVersion());
    expect(store().currentDiagramId).toBe(before.currentDiagramId);
    expect(store().currentDiagramName).toBe(before.currentDiagramName);
    expect(store().savedSignature).toBe(before.savedSignature);
    expect(store().loadedTemplate).toBe(before.loadedTemplate);
  });

  it('a Save after restoring marks that content saved; the restore stays undoable', () => {
    store().restoreVersion(olderVersion());
    store().markDiagramSaved('d1', 'Diagram d1', store().doc, { uid: 'u', email: null, displayName: null }, 123);
    expect(dirty()).toBe(false);
    expect(store().lastSavedBy?.uid).toBe('u');
    expect(store().lastSavedAt).toBe(123);
    store().undo();
    expect(dirty()).toBe(true);
  });

  it('brings the Version\'s run mode, and undo hands back the previous one (T1 rules)', () => {
    store().restoreVersion(olderVersion());
    expect(store().doc.settings?.runMode).toBe('manual');
    store().undo();
    expect(store().doc.settings?.runMode).toBe('sequential');

    // A run mode the user picks after the restore survives undoing it.
    store().redo();
    store().applySettings({ runMode: 'static' });
    store().undo();
    expect(store().doc.settings?.runMode).toBe('static');
  });

  it('normalises the Version on the way in, like every other document', () => {
    const broken = { nodes: [{ ...block('n', 0, 0), lineStart: 'top-left' }], edges: [] } as unknown as FlowDocumentJSON;
    store().restoreVersion(broken);
    // Repaired (the crash value from the v0.2 report), not passed through.
    expect(store().doc.nodes[0].lineStart).not.toBe('top-left');
  });

  it('resets the run cursor and the selection', () => {
    store().selectNode('loose');
    store().advanceStep();
    store().restoreVersion(olderVersion());
    expect(store().runStep).toBe(0);
    expect(store().selectedNodeIds).toEqual([]);
  });

  it('opening a diagram reads who last saved it; a pre-Versions diagram has only the time', () => {
    const at = { toMillis: () => 42 } as unknown as import('firebase/firestore').Timestamp;
    store().loadStoredDiagram({ id: 'x', name: 'X', document: fixture(), public: false, createdAt: null, updatedAt: at, lastSavedBy: { uid: 'b', email: 'b@x.io', displayName: 'Bob' } });
    expect(store().lastSavedAt).toBe(42);
    expect(store().lastSavedBy?.displayName).toBe('Bob');
    store().loadStoredDiagram({ id: 'y', name: 'Y', document: fixture(), public: false, createdAt: null, updatedAt: at });
    expect(store().lastSavedBy).toBeNull();
    expect(store().lastSavedAt).toBe(42);
  });
});

describe('editor store — Share and Save conflicts (PRD v0.3 §4.2)', () => {
  const at = (millis: number) => ({ toMillis: () => millis }) as unknown as import('firebase/firestore').Timestamp;
  const theirs = () => {
    const document = fixture();
    document.nodes = document.nodes.map((node) => (node.id === 'loose' ? { ...node, title: 'Saved by A' } : node));
    return document;
  };

  it('opening someone else\'s Diagram records the Owner, the role and the revision it was loaded at', () => {
    store().loadStoredDiagram({ id: 'd2', name: 'Shared', document: fixture(), public: false, createdAt: null, updatedAt: null, revision: 7 }, { ownerUid: 'alice', ownerEmail: 'alice@company.com', role: 'edit' });
    expect(store().currentDiagramOwnerUid).toBe('alice');
    expect(store().currentOwnerEmail).toBe('alice@company.com');
    expect(store().currentRole).toBe('edit');
    expect(store().currentRevision).toBe(7);
  });

  it('a Diagram from before Share opens as the user\'s own at revision 0', () => {
    expect(store().currentRole).toBe('owner');
    expect(store().currentDiagramOwnerUid).toBeNull();
    expect(store().currentRevision).toBe(0);
  });

  it('a Save moves the base revision on; a Save without one keeps it', () => {
    store().markDiagramSaved('d1', 'Diagram d1', store().doc, null, 1, 4);
    expect(store().currentRevision).toBe(4);
    store().markDiagramSaved('d1', 'Diagram d1', store().doc, null, 2);
    expect(store().currentRevision).toBe(4);
  });

  it('Load latest replaces the canvas as one undo step and becomes the saved baseline', () => {
    store().onNodeUpdate('loose', { title: 'My unsaved edit' });
    const stepsBefore = steps();
    store().loadLatestSaved({ id: 'd1', name: 'Renamed by A', document: theirs(), public: true, createdAt: null, updatedAt: at(99), lastSavedBy: { uid: 'a', email: 'a@company.com', displayName: 'A' }, revision: 5 });

    expect(nodeById('loose').title).toBe('Saved by A');
    expect(dirty()).toBe(false);
    expect(store().currentRevision).toBe(5);
    expect(store().currentDiagramName).toBe('Renamed by A');
    expect(store().currentDiagramPublic).toBe(true);
    expect(store().lastSavedBy?.uid).toBe('a');
    expect(store().lastSavedAt).toBe(99);
    expect(steps()).toBe(stepsBefore + 1);

    // ⌘Z: my edits come back, unsaved — saving them now is a deliberate
    // overwrite of the latest revision, not a conflict.
    store().undo();
    expect(nodeById('loose').title).toBe('My unsaved edit');
    expect(dirty()).toBe(true);
    expect(store().currentRevision).toBe(5);
  });

  it('opening a template clears the ownership', () => {
    store().loadStoredDiagram({ id: 'd2', name: 'Shared', document: fixture(), public: false, createdAt: null, updatedAt: null, revision: 2 }, { ownerUid: 'alice', ownerEmail: null, role: 'edit' });
    store().openTemplate({ name: 'T', category: 'C', description: '', document: fixture() });
    expect(store().currentDiagramOwnerUid).toBeNull();
    expect(store().currentRole).toBe('owner');
    expect(store().currentRevision).toBe(0);
  });
});
