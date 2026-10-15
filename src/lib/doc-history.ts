// Undo / redo history for the editor — pure data, no React, no zustand.
//
// A history is two stacks of *steps* (`past` and `future`) plus at most
// one open *gesture*. A step is the snapshot before a change and the one
// after it. Snapshots are whatever the caller hands in; the editor store
// passes `{ doc, loadedTemplate }` references. Documents are immutable
// values, so keeping references costs nothing and needs no cloning.
//
// A step keeps its `after` as well as its `before` so the caller can tell
// what the step itself changed from what changed since without being
// recorded (the store uses it for the run mode — see `restorePresentation`
// in editor-store.ts).
//
// Every function returns a new history (or the same one when nothing
// changed) and never mutates its input, so the store can treat a history
// exactly like it treats a document.

/** Oldest steps are dropped once the undo stack grows past this. */
export const HISTORY_LIMIT = 100;

export interface HistoryStep<T> {
  before: T;
  after: T;
}

export interface DocHistory<T> {
  /** Steps to undo, oldest first. */
  past: HistoryStep<T>[];
  /** Steps to redo, nearest first. */
  future: HistoryStep<T>[];
  /**
   * An open gesture (a drag, a slider drag, a stretch of typing): every
   * change made while it is open folds into one step, recorded when it
   * closes. `base` is the snapshot from before the gesture's first change.
   */
  gesture: { id: number; base: T } | null;
}

/** Decides whether two snapshots differ in anything undo should care about. */
export type SameSnapshot<T> = (a: T, b: T) => boolean;

export function emptyHistory<T>(): DocHistory<T> {
  return { past: [], future: [], gesture: null };
}

export function canUndo<T>(history: DocHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: DocHistory<T>): boolean {
  return history.future.length > 0;
}

function capped<T>(steps: HistoryStep<T>[], limit: number): HistoryStep<T>[] {
  return steps.length > limit ? steps.slice(steps.length - limit) : steps;
}

/** Push one step onto the undo stack; the redo branch dies. */
function pushStep<T>(history: DocHistory<T>, step: HistoryStep<T>, limit: number): DocHistory<T> {
  return { past: capped([...history.past, step], limit), future: [], gesture: history.gesture };
}

/**
 * Note that the document went from `before` to `after`. Outside a gesture
 * that is one step; inside one it is folded into the gesture's step, which
 * `endGesture` records. A change `same` calls a no-op (a field committing
 * the value it already had, a run-mode switch) records nothing.
 */
export function recordChange<T>(history: DocHistory<T>, before: T, after: T, same: SameSnapshot<T>, limit = HISTORY_LIMIT): DocHistory<T> {
  if (history.gesture) return history;
  if (before === after || same(before, after)) return history;
  return pushStep(history, { before, after }, limit);
}

/**
 * Open a gesture whose step will start from `current`. A gesture that is
 * still open is closed first (and recorded, if it changed anything), so a
 * gesture somebody forgot to close can never swallow the next one.
 */
export function beginGesture<T>(history: DocHistory<T>, current: T, id: number, same: SameSnapshot<T>, limit = HISTORY_LIMIT): DocHistory<T> {
  const closed = history.gesture ? endGesture(history, current, same, undefined, limit) : history;
  return { ...closed, gesture: { id, base: current } };
}

/**
 * Close the open gesture and record its one step — unless the document
 * ended up where it started (a click without a drag, a slider let go at
 * its old value), which records nothing. Passing an `id` only closes that
 * gesture, so a late "end" from an owner whose gesture was already
 * superseded can't close somebody else's.
 */
export function endGesture<T>(history: DocHistory<T>, current: T, same: SameSnapshot<T>, id?: number, limit = HISTORY_LIMIT): DocHistory<T> {
  const gesture = history.gesture;
  if (!gesture) return history;
  if (id !== undefined && gesture.id !== id) return history;
  const closed = { ...history, gesture: null };
  if (gesture.base === current || same(gesture.base, current)) return closed;
  return pushStep(closed, { before: gesture.base, after: current }, limit);
}

/**
 * Step back. Closes any open gesture first, so undo during a drag undoes
 * the drag so far. `step` is the step being undone — restore its
 * `before` — or `null` when there is nothing to undo; `history` is
 * returned either way, since closing the gesture may itself change it.
 */
export function undo<T>(history: DocHistory<T>, current: T, same: SameSnapshot<T>, limit = HISTORY_LIMIT): { history: DocHistory<T>; step: HistoryStep<T> | null } {
  const settled = endGesture(history, current, same, undefined, limit);
  const step = settled.past.at(-1);
  if (!step) return { history: settled, step: null };
  return { history: { past: settled.past.slice(0, -1), future: [step, ...settled.future], gesture: null }, step };
}

/** Step forward again: restore the returned step's `after`. */
export function redo<T>(history: DocHistory<T>, current: T, same: SameSnapshot<T>, limit = HISTORY_LIMIT): { history: DocHistory<T>; step: HistoryStep<T> | null } {
  const settled = endGesture(history, current, same, undefined, limit);
  // Closing a gesture that changed something is a new change, which has
  // already cleared the redo branch — so this correctly finds nothing.
  const [step, ...future] = settled.future;
  if (!step) return { history: settled, step: null };
  return { history: { past: capped([...settled.past, step], limit), future, gesture: null }, step };
}

/**
 * Structural equality the way `JSON.stringify` sees it: a key holding
 * `undefined` counts as absent, so `{ parentId: undefined }` equals `{}`.
 * Shared references short-circuit, which keeps comparing two documents
 * cheap — an edit only rebuilds the path to what it touched.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    if (a.length !== other.length) return false;
    for (let index = 0; index < a.length; index += 1) if (!jsonEqual(a[index], other[index])) return false;
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of Object.keys(left)) if (left[key] !== undefined && !jsonEqual(left[key], right[key])) return false;
  for (const key of Object.keys(right)) if (right[key] !== undefined && left[key] === undefined) return false;
  return true;
}
