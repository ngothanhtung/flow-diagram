// What a learner has finished, for the Course sidebar: a Lesson counts as
// done once its last Lesson step has been shown. Kept per browser (not per
// account) under one localStorage key — spec 2026-11-22-lesson-tree-design.md §5.3.

import { descendantFolderIds, readingOrder, type LessonTree } from './lesson-tree';

export const DONE_KEY = 'xflow:lessons-done';

/** A stored JSON array of ids; anything else reads as nothing done. */
export function parseDone(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? new Set(value.filter((id): id is string => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function loadDone(): Set<string> {
  try {
    return parseDone(window.localStorage.getItem(DONE_KEY));
  } catch {
    return new Set();
  }
}

/** Marks a Lesson done and returns the new set (storage failures are ignored). */
export function markDone(lessonId: string): Set<string> {
  const done = loadDone();
  done.add(lessonId);
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Private mode or a full quota: the mark lasts for this page only.
  }
  return done;
}

/** Done / total over a folder's whole subtree. */
export function folderProgress(tree: LessonTree, folderId: string, done: ReadonlySet<string>): { done: number; total: number } {
  const inside = descendantFolderIds(tree, folderId).add(folderId);
  const ids = Object.entries(tree.lessons)
    .filter(([, entry]) => entry.folderId !== null && inside.has(entry.folderId))
    .map(([id]) => id);
  return { done: ids.filter((id) => done.has(id)).length, total: ids.length };
}

/** The Lesson after this one in the course's reading order, or null. */
export function nextLessonId(tree: LessonTree, lessonId: string): string | null {
  const order = readingOrder(tree);
  const index = order.indexOf(lessonId);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : null;
}
