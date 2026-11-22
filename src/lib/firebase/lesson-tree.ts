'use client';

// Reads and writes the Lesson tree (`users/{uid}/lesson-trees/main`) and
// its public copy (`public-lesson-trees/{uid}`). Every write goes through
// a transaction that reads the latest tree, applies a pure edit from
// `lib/lesson/lesson-tree.ts` and writes the tree *and* the public copy
// together — two tabs never overwrite each other's edit, and the public
// copy never lags the tree.

import { doc, getDoc, runTransaction, serverTimestamp, type Transaction } from 'firebase/firestore';
import { lessonNameOf, type LessonDocumentJSON } from '../lesson/lesson-types';
import { emptyLessonTree, normalizeLessonTree, publicTreeOf, reconcileLessonTree, treeFromPublic, type LessonTree, type TreeEdit } from '../lesson/lesson-tree';
import { firestore } from './client';

export function treeRefs(uid: string) {
  if (!uid) throw new Error('A Firebase user id is required.');
  return {
    tree: doc(firestore, 'users', uid, 'lesson-trees', 'main'),
    mirror: doc(firestore, 'public-lesson-trees', uid),
  };
}

/** The data for both documents. */
export function lessonTreeWrite(tree: LessonTree, uid: string) {
  return {
    tree: { ...tree, updatedAt: serverTimestamp() },
    mirror: { ...publicTreeOf(tree, uid), updatedAt: serverTimestamp() },
  };
}

/** Inside a transaction: the stored tree, normalised, or null when the user has none. */
export async function readTreeIn(transaction: Transaction, uid: string): Promise<LessonTree | null> {
  const snapshot = await transaction.get(treeRefs(uid).tree);
  return snapshot.exists() ? normalizeLessonTree(snapshot.data()).tree : null;
}

/** Inside a transaction (after every read): writes the tree and its public copy. */
export function writeTreeIn(transaction: Transaction, uid: string, tree: LessonTree): void {
  const refs = treeRefs(uid);
  const data = lessonTreeWrite(tree, uid);
  transaction.set(refs.tree, data.tree);
  transaction.set(refs.mirror, data.mirror);
}

export async function loadLessonTree(uid: string): Promise<LessonTree | null> {
  const snapshot = await getDoc(treeRefs(uid).tree);
  return snapshot.exists() ? normalizeLessonTree(snapshot.data()).tree : null;
}

/** The owner's public copy as a tree (every entry Public), or null when there is none. */
export async function loadPublicLessonTree(ownerUid: string): Promise<LessonTree | null> {
  const snapshot = await getDoc(treeRefs(ownerUid).mirror);
  return snapshot.exists() ? treeFromPublic(snapshot.data()) : null;
}

/**
 * Applies `edit` to the latest stored tree. A user without a tree starts
 * from an empty one unless `create` is false. A refused edit writes nothing
 * and is returned as is.
 */
export async function updateLessonTree(uid: string, edit: (tree: LessonTree) => TreeEdit, options: { create?: boolean } = {}): Promise<TreeEdit> {
  return runTransaction(firestore, async (transaction) => {
    const stored = await readTreeIn(transaction, uid);
    if (!stored && options.create === false) return { ok: false, reason: 'There is no lesson tree yet.' } as TreeEdit;
    const base = stored ?? emptyLessonTree();
    const result = edit(base);
    if (result.ok && (result.tree !== base || !stored)) writeTreeIn(transaction, uid, result.tree);
    return result;
  });
}

/** What the index records about a stored Lesson; raw Firestore data, so never trust the shape. */
export function lessonSummary(lesson: { id: string; name?: unknown; document?: unknown; public?: unknown }): { id: string; title: string; public: boolean } {
  const document = lesson.document;
  const hasMeta = typeof document === 'object' && document !== null && typeof (document as { meta?: unknown }).meta === 'object' && (document as { meta?: unknown }).meta !== null;
  const title = hasMeta ? lessonNameOf(document as LessonDocumentJSON) : typeof lesson.name === 'string' && lesson.name ? lesson.name : 'Untitled lesson';
  return { id: lesson.id, title, public: lesson.public === true };
}

/**
 * Brings a user's tree in line with their Lessons (the safety net for
 * writes made outside the app). No tree → nothing is created, returns null.
 */
export async function reconcileStoredTree(uid: string, lessons: { id: string; name?: unknown; document?: unknown; public?: unknown }[]): Promise<LessonTree | null> {
  const summaries = lessons.map(lessonSummary);
  return runTransaction(firestore, async (transaction) => {
    const stored = await readTreeIn(transaction, uid);
    if (!stored) return null;
    const { tree, changed } = reconcileLessonTree(stored, summaries);
    if (changed) writeTreeIn(transaction, uid, tree);
    return tree;
  });
}
