import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { saveEditorSession } from './editor-session';
import { selectCanUndo, useEditorStore } from './editor-store';
import type { FlowDocumentJSON } from './flowchart-types';
import { localCopyOf, restoreDecision, type LocalCopy, type ServerCheck } from './session-restore';
import { saveDecision, type DiagramRole } from './sharing';

describe('localCopyOf', () => {
  it('is none when the editor holds another Diagram (or nothing)', () => {
    expect(localCopyOf({ holdsDiagram: false, dirty: true, canUndo: true })).toBe('none');
  });
  it('is clean only with no unsaved changes and no history', () => {
    expect(localCopyOf({ holdsDiagram: true, dirty: false, canUndo: false })).toBe('clean');
    expect(localCopyOf({ holdsDiagram: true, dirty: true, canUndo: false })).toBe('unsaved');
    // Edits that landed back on the saved document still have undo steps.
    expect(localCopyOf({ holdsDiagram: true, dirty: false, canUndo: true })).toBe('unsaved');
  });
});

describe('restoreDecision — the decision table', () => {
  const opened = (role: DiagramRole, revision: number): ServerCheck => ({ kind: 'opened', role, revision });
  const gone: ServerCheck = { kind: 'gone', reason: 'not-found' };
  const unverified: ServerCheck = { kind: 'gone', reason: 'unverified' };
  const denied: ServerCheck = { kind: 'denied' };
  const unreachable: ServerCheck = { kind: 'unreachable' };
  const decide = (copy: LocalCopy, role: DiagramRole, revision: number, check: ServerCheck) => restoreDecision({ copy, role, revision }, check).action;
  const blockedKind = (copy: LocalCopy, role: DiagramRole, check: ServerCheck) => {
    const result = restoreDecision({ copy, role, revision: 3 }, check);
    return result.action === 'blocked' ? result.kind : result.action;
  };

  it('a clean copy is always replaced by the server, newer or not (the smoke-test repro)', () => {
    expect(decide('clean', 'edit', 3, opened('edit', 4))).toBe('load-latest');
    expect(decide('clean', 'owner', 3, opened('owner', 3))).toBe('load-latest');
  });

  it('a clean copy of a Diagram now Can view goes to the Viewer; one that is gone shows the status screen', () => {
    expect(decide('clean', 'edit', 3, opened('view', 4))).toBe('redirect-view');
    expect(restoreDecision({ copy: 'clean', role: 'edit', revision: 3 }, gone)).toEqual({ action: 'status', status: 'not-found' });
    expect(restoreDecision({ copy: 'clean', role: 'edit', revision: 3 }, unverified)).toEqual({ action: 'status', status: 'unverified' });
  });

  it('a clean copy falls back to itself (with the note) when the server is unreachable', () => {
    expect(decide('clean', 'owner', 3, unreachable)).toBe('local-copy');
    expect(decide('clean', 'edit', 3, unreachable)).toBe('local-copy');
  });

  it('a revoked Collaborator\'s clean copy is not shown; an Owner\'s refused read keeps the copy', () => {
    expect(restoreDecision({ copy: 'clean', role: 'edit', revision: 3 }, denied)).toEqual({ action: 'status', status: 'not-found' });
    expect(decide('clean', 'owner', 3, denied)).toBe('local-copy');
  });

  it('unsaved changes are kept; a newer server revision offers Load latest', () => {
    expect(decide('unsaved', 'edit', 3, opened('edit', 4))).toBe('offer-latest');
    expect(decide('unsaved', 'owner', 3, opened('owner', 9))).toBe('offer-latest');
    expect(decide('unsaved', 'edit', 3, opened('edit', 3))).toBe('keep');
    // Never "newer" just because the numbers differ the other way.
    expect(decide('unsaved', 'owner', 3, opened('owner', 2))).toBe('keep');
  });

  it('unsaved changes that can no longer be saved get the Save path\'s blocked dialog, never a wipe', () => {
    expect(blockedKind('unsaved', 'edit', opened('view', 4))).toBe('revoked');
    expect(blockedKind('unsaved', 'edit', gone)).toBe('revoked');
    expect(blockedKind('unsaved', 'edit', unverified)).toBe('revoked');
    expect(blockedKind('unsaved', 'edit', denied)).toBe('revoked');
    expect(blockedKind('unsaved', 'owner', gone)).toBe('missing');
  });

  it('unsaved changes stay, with the note, when the server is unreachable', () => {
    expect(decide('unsaved', 'edit', 3, unreachable)).toBe('local-copy');
    expect(decide('unsaved', 'owner', 3, denied)).toBe('local-copy');
  });

  it('with no local copy it is a plain open', () => {
    expect(decide('none', 'owner', 0, opened('owner', 4))).toBe('load-latest');
    expect(decide('none', 'owner', 0, opened('view', 4))).toBe('redirect-view');
    expect(restoreDecision({ copy: 'none', role: 'owner', revision: 0 }, gone)).toEqual({ action: 'status', status: 'not-found' });
    expect(restoreDecision({ copy: 'none', role: 'owner', revision: 0 }, denied)).toEqual({ action: 'status', status: 'error' });
    expect(restoreDecision({ copy: 'none', role: 'owner', revision: 0 }, unreachable)).toEqual({ action: 'status', status: 'error' });
  });
});

// The store end of it: a real session in (stubbed) localStorage, restored
// by `hydrate` exactly as a reload does, then the action the decision
// names, performed through the same store actions `DiagramEditor` calls.
describe('restoring a session against a newer server copy (store)', () => {
  const storage = new Map<string, string>();
  const scope = globalThis as unknown as { window?: unknown };
  const hadWindow = 'window' in scope;
  scope.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  };
  afterAll(() => {
    if (!hadWindow) delete scope.window;
  });

  const store = () => useEditorStore.getState();
  const at = (millis: number) => ({ toMillis: () => millis }) as unknown as import('firebase/firestore').Timestamp;
  const doc = (title: string): FlowDocumentJSON => ({ nodes: [{ id: 'n1', type: 'process', title, position: { x: 0, y: 0 }, width: 120, height: 60 }], edges: [] });
  const title = () => store().doc.nodes[0]?.title;
  const copyNow = () => localCopyOf({ holdsDiagram: store().currentDiagramId === 'd1', dirty: JSON.stringify(store().doc) !== store().savedSignature, canUndo: selectCanUndo(store()) });
  // B's Save: revision 4, content "Saved by B".
  const server = () => ({ id: 'd1', name: 'Shared', document: doc('Saved by B'), public: false, createdAt: null, updatedAt: at(1234), lastSavedBy: { uid: 'b', email: 'b@company.com', displayName: 'B' }, revision: 4 });

  /** A's session as A left it: based on revision 3, with or without edits. */
  function reloadWith(current: string) {
    storage.clear();
    saveEditorSession('a', {
      doc: doc(current),
      currentDiagramId: 'd1',
      currentDiagramName: 'Shared',
      currentDiagramPublic: false,
      savedSignature: JSON.stringify(doc('Rev 3')),
      lastSavedAt: 1000,
      lastSavedBy: null,
      currentDiagramOwnerUid: 'owner',
      currentOwnerEmail: 'owner@company.com',
      currentRole: 'edit',
      currentRevision: 3,
    });
    useEditorStore.setState({ hydrated: false });
    store().hydrate('a');
  }

  beforeEach(() => {
    storage.clear();
  });

  it('no unsaved changes: the server copy replaces the session, history empty', () => {
    reloadWith('Rev 3');
    expect(copyNow()).toBe('clean');
    expect(restoreDecision({ copy: copyNow(), role: store().currentRole, revision: store().currentRevision }, { kind: 'opened', role: 'edit', revision: 4 }).action).toBe('load-latest');

    store().loadStoredDiagram(server(), { ownerUid: 'owner', ownerEmail: 'owner@company.com', role: 'edit' });
    expect(title()).toBe('Saved by B');
    expect(store().currentRevision).toBe(4);
    expect(selectCanUndo(store())).toBe(false);
    expect(JSON.stringify(store().doc)).toBe(store().savedSignature);
  });

  it('unsaved changes: kept, then the banner\'s Load latest is exactly one undo step', () => {
    reloadWith('My edit');
    expect(copyNow()).toBe('unsaved');
    expect(title()).toBe('My edit');
    expect(restoreDecision({ copy: copyNow(), role: store().currentRole, revision: store().currentRevision }, { kind: 'opened', role: 'edit', revision: 4 }).action).toBe('offer-latest');

    store().loadLatestSaved(server());
    expect(title()).toBe('Saved by B');
    expect(store().currentRevision).toBe(4);
    expect(store().lastSavedBy?.uid).toBe('b');
    expect(JSON.stringify(store().doc)).toBe(store().savedSignature);
    expect(store().history.past.length).toBe(1);

    // ⌘Z: A's edits come back, unsaved, now based on B's revision — so
    // saving them is a deliberate overwrite, not a conflict.
    store().undo();
    expect(title()).toBe('My edit');
    expect(JSON.stringify(store().doc)).not.toBe(store().savedSignature);
    expect(store().currentRevision).toBe(4);
    expect(selectCanUndo(store())).toBe(false);
  });

  it('Keep mine leaves the base revision alone, so the next Save still conflicts', () => {
    reloadWith('My edit');
    // Keep mine only dismisses the banner — nothing in the store moves.
    expect(store().currentRevision).toBe(3);
    expect(title()).toBe('My edit');
    expect(saveDecision(store().currentRevision, server().revision)).toBe('conflict');
  });
});
