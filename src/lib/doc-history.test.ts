import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, beginGesture, canRedo, canUndo, emptyHistory, endGesture, jsonEqual, recordChange, redo, undo, type DocHistory } from './doc-history';

// Snapshots here are small objects compared structurally, the same way the
// store compares documents.
type Snap = { value: number };
const snap = (value: number): Snap => ({ value });
const same = (a: Snap, b: Snap) => a.value === b.value;

/** Apply a run of plain (non-gesture) changes, returning the history and the final snapshot. */
function applyChanges(history: DocHistory<Snap>, from: Snap, values: number[]) {
  let current = from;
  for (const value of values) {
    const next = snap(value);
    history = recordChange(history, current, next, same);
    current = next;
  }
  return { history, current };
}

describe('doc-history', () => {
  it('records a change and undoes it back to the previous snapshot', () => {
    const before = snap(0);
    const after = snap(1);
    const history = recordChange(emptyHistory<Snap>(), before, after, same);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);

    const undone = undo(history, after, same);
    expect(undone.step).toEqual({ before, after });
    expect(canUndo(undone.history)).toBe(false);
    expect(canRedo(undone.history)).toBe(true);
  });

  it('records nothing for a change that is not a change', () => {
    const before = snap(3);
    expect(recordChange(emptyHistory<Snap>(), before, before, same).past).toHaveLength(0);
    expect(recordChange(emptyHistory<Snap>(), before, snap(3), same).past).toHaveLength(0);
  });

  it('redoes what was undone, in order', () => {
    const start = snap(0);
    const { history, current } = applyChanges(emptyHistory<Snap>(), start, [1, 2]);
    const first = undo(history, current, same);
    expect(first.step?.before.value).toBe(1);
    const second = undo(first.history, first.step!.before, same);
    expect(second.step?.before.value).toBe(0);

    const again = redo(second.history, second.step!.before, same);
    expect(again.step?.after.value).toBe(1);
    const again2 = redo(again.history, again.step!.after, same);
    expect(again2.step?.after.value).toBe(2);
    expect(canRedo(again2.history)).toBe(false);
    expect(redo(again2.history, again2.step!.after, same).step).toBeNull();
  });

  it('a new change after undo drops the redo branch', () => {
    const { history, current } = applyChanges(emptyHistory<Snap>(), snap(0), [1, 2]);
    const undone = undo(history, current, same);
    expect(canRedo(undone.history)).toBe(true);
    const branched = recordChange(undone.history, undone.step!.before, snap(9), same);
    expect(canRedo(branched)).toBe(false);
    expect(branched.past.map((step) => [step.before.value, step.after.value])).toEqual([
      [0, 1],
      [1, 9],
    ]);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps, dropping the oldest`, () => {
    const values = Array.from({ length: HISTORY_LIMIT + 1 }, (_, index) => index + 1);
    let { history, current } = applyChanges(emptyHistory<Snap>(), snap(0), values);
    expect(history.past).toHaveLength(HISTORY_LIMIT);

    let undos = 0;
    for (;;) {
      const result = undo(history, current, same);
      if (!result.step) break;
      history = result.history;
      current = result.step.before;
      undos += 1;
    }
    expect(undos).toBe(HISTORY_LIMIT);
    // The very first state (0) fell off the bottom; undo stops at 1.
    expect(current.value).toBe(1);
  });

  it('redo also respects the cap', () => {
    const values = Array.from({ length: HISTORY_LIMIT }, (_, index) => index + 1);
    const { history, current } = applyChanges(emptyHistory<Snap>(), snap(0), values);
    const undone = undo(history, current, same);
    const redone = redo(undone.history, undone.step!.before, same);
    expect(redone.history.past).toHaveLength(HISTORY_LIMIT);
  });

  describe('gestures', () => {
    it('fold every change inside one gesture into a single step', () => {
      const start = snap(0);
      let history = beginGesture(emptyHistory<Snap>(), start, 1, same);
      let current = start;
      for (const value of [1, 2, 3, 4, 5]) {
        const next = snap(value);
        history = recordChange(history, current, next, same);
        current = next;
      }
      expect(history.past).toHaveLength(0);
      history = endGesture(history, current, same, 1);
      expect(history.gesture).toBeNull();
      expect(history.past).toHaveLength(1);

      const undone = undo(history, current, same);
      expect(undone.step?.before).toBe(start);
      expect(undone.step?.after).toBe(current);
    });

    it('record nothing when the gesture changed nothing', () => {
      const start = snap(0);
      const opened = beginGesture(emptyHistory<Snap>(), start, 1, same);
      expect(endGesture(opened, start, same, 1).past).toHaveLength(0);
      // Moved away and back again: still no step.
      expect(endGesture(opened, snap(0), same, 1).past).toHaveLength(0);
    });

    it('a gesture that changed something clears the redo branch', () => {
      const { history, current } = applyChanges(emptyHistory<Snap>(), snap(0), [1]);
      const undone = undo(history, current, same);
      let gesture = beginGesture(undone.history, undone.step!.before, 7, same);
      gesture = recordChange(gesture, undone.step!.before, snap(5), same);
      const closed = endGesture(gesture, snap(5), same, 7);
      expect(canRedo(closed)).toBe(false);
      expect(closed.past).toHaveLength(1);
    });

    it('only the matching id closes a gesture', () => {
      const start = snap(0);
      const opened = beginGesture(emptyHistory<Snap>(), start, 1, same);
      expect(endGesture(opened, snap(2), same, 99)).toBe(opened);
      expect(endGesture(opened, snap(2), same, 1).past).toHaveLength(1);
      // No id closes whatever is open.
      expect(endGesture(opened, snap(2), same).gesture).toBeNull();
    });

    it('opening a gesture closes (and records) the one still open', () => {
      const first = beginGesture(emptyHistory<Snap>(), snap(0), 1, same);
      const second = beginGesture(first, snap(1), 2, same);
      expect(second.past.map((step) => [step.before.value, step.after.value])).toEqual([[0, 1]]);
      expect(second.gesture?.id).toBe(2);
      expect(second.gesture?.base.value).toBe(1);
    });

    it('undo during a gesture closes it and undoes it', () => {
      const start = snap(0);
      const opened = beginGesture(emptyHistory<Snap>(), start, 1, same);
      const undone = undo(opened, snap(3), same);
      expect(undone.step?.before).toBe(start);
      expect(undone.history.gesture).toBeNull();
      expect(canRedo(undone.history)).toBe(true);
    });

    it('undo with nothing to undo still closes an empty gesture', () => {
      const opened = beginGesture(emptyHistory<Snap>(), snap(0), 1, same);
      const result = undo(opened, snap(0), same);
      expect(result.step).toBeNull();
      expect(result.history.gesture).toBeNull();
    });
  });

  describe('jsonEqual', () => {
    it('treats undefined-valued keys as absent, like JSON.stringify', () => {
      expect(jsonEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
      expect(jsonEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
      expect(jsonEqual({ a: 1 }, { a: 1, b: null })).toBe(false);
    });

    it('compares nested arrays and objects by value', () => {
      expect(jsonEqual({ list: [{ x: 1 }, { y: [2] }] }, { list: [{ x: 1 }, { y: [2] }] })).toBe(true);
      expect(jsonEqual({ list: [{ x: 1 }] }, { list: [{ x: 2 }] })).toBe(false);
      expect(jsonEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(jsonEqual([], {})).toBe(false);
    });
  });
});
