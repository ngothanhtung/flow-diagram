'use client';

// Reads and writes the Diagram tree (`users/{uid}/diagram-trees/main`): the
// Lesson tree's folders over the user's own Diagrams. Every write is a
// transaction on the latest stored tree, so two tabs never overwrite each
// other's edit. There is no public copy. Diagram writes don't touch the tree:
// `/` reconciles it with the Diagram list each time it loads.

import { doc, runTransaction, serverTimestamp, type Transaction } from 'firebase/firestore';
import { diagramSummary } from '../diagram-tree';
import { emptyLessonTree, normalizeLessonTree, reconcileLessonTree, type LessonTree, type TreeEdit } from '../lesson/lesson-tree';
import { firestore } from './client';

function treeRef(uid: string) {
  if (!uid) throw new Error('A Firebase user id is required.');
  return doc(firestore, 'users', uid, 'diagram-trees', 'main');
}

async function readIn(transaction: Transaction, uid: string): Promise<LessonTree | null> {
  const snapshot = await transaction.get(treeRef(uid));
  return snapshot.exists() ? normalizeLessonTree(snapshot.data()).tree : null;
}

function writeIn(transaction: Transaction, uid: string, tree: LessonTree): void {
  transaction.set(treeRef(uid), { ...tree, updatedAt: serverTimestamp() });
}

/** Applies `edit` to the latest stored tree (an empty one when the user has none). A refused edit writes nothing. */
export async function updateDiagramTree(uid: string, edit: (tree: LessonTree) => TreeEdit): Promise<TreeEdit> {
  return runTransaction(firestore, async (transaction) => {
    const stored = await readIn(transaction, uid);
    const base = stored ?? emptyLessonTree();
    const result = edit(base);
    if (result.ok && (result.tree !== base || !stored)) writeIn(transaction, uid, result.tree);
    return result;
  });
}

/**
 * Brings the tree in line with the user's Diagrams: a new one lands in
 * Unfiled, a deleted one leaves its folder, names are refreshed. No tree →
 * nothing is created, returns null (someone who never made a folder pays no write).
 */
export async function reconcileStoredDiagramTree(uid: string, diagrams: { id: string; name?: unknown; public?: unknown }[]): Promise<LessonTree | null> {
  const summaries = diagrams.map(diagramSummary);
  return runTransaction(firestore, async (transaction) => {
    const stored = await readIn(transaction, uid);
    if (!stored) return null;
    const { tree, changed } = reconcileLessonTree(stored, summaries);
    if (changed) writeIn(transaction, uid, tree);
    return tree;
  });
}
