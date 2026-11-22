'use client';

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { emptyLessonTree, removeLessonEntry, upsertLessonEntry } from '../lesson/lesson-tree';
import { emptyLessonDocument, lessonNameOf, type LessonDocumentJSON } from '../lesson/lesson-types';
import { firestore } from './client';
import { readTreeIn, writeTreeIn } from './lesson-tree';

export interface StoredLesson {
  id: string;
  name: string;
  document: LessonDocumentJSON;
  public: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** The `public-lessons/{id}` mirror, as read back. */
export interface PublicLesson extends StoredLesson {
  ownerUid: string;
}

function lessonsCollection(userId: string) {
  if (!userId) throw new Error('A Firebase user id is required.');
  return collection(firestore, 'users', userId, 'lessons');
}

function publicLessonDoc(lessonId: string) {
  return doc(firestore, 'public-lessons', lessonId);
}

function cleanDocument(document: LessonDocumentJSON): LessonDocumentJSON {
  // Firestore rejects undefined values; a JSON round-trip drops them
  // (same approach as diagrams.ts).
  return JSON.parse(JSON.stringify(document)) as LessonDocumentJSON;
}

function mirrorData(ownerUid: string, name: string, document: LessonDocumentJSON) {
  return { ownerUid, name, document, public: true, updatedAt: serverTimestamp() };
}

/**
 * Creates a Lesson. When the user has a Lesson tree (or a folder is given,
 * which creates the tree) its index gets the new entry in the same
 * transaction — in `folderId`, last, or Unfiled.
 */
export async function createLesson(userId: string, document: LessonDocumentJSON, folderId: string | null = null): Promise<string> {
  const reference = doc(lessonsCollection(userId));
  const name = lessonNameOf(document);
  await runTransaction(firestore, async (transaction) => {
    const tree = await readTreeIn(transaction, userId);
    transaction.set(reference, { name, document: cleanDocument(document), public: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (tree || folderId !== null) {
      writeTreeIn(transaction, userId, upsertLessonEntry(tree ?? emptyLessonTree(), reference.id, { folderId, title: name, public: false }));
    }
  });
  return reference.id;
}

export async function loadLesson(userId: string, lessonId: string): Promise<StoredLesson | null> {
  const snapshot = await getDoc(doc(lessonsCollection(userId), lessonId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as StoredLesson;
}

export async function listLessons(userId: string): Promise<StoredLesson[]> {
  const snapshot = await getDocs(query(lessonsCollection(userId), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as StoredLesson);
}

export type SaveLessonResult = { status: 'saved'; isPublic: boolean } | { status: 'missing' };

/**
 * Saves a Lesson (name = its `meta.title`). One transaction reads the stored
 * Lesson, writes it and, only when the *stored* flag is Public, its mirror —
 * so the public copy never lags a successful Save, and a Save can never
 * re-publish a Lesson whose Public link was turned off elsewhere (the list,
 * another tab) while this editor still thought it was on. Returns the
 * server's flag for the editor to show. `public` is not written here:
 * `setLessonPublic` owns it. A Lesson deleted meanwhile → `missing`.
 */
export async function saveLesson(userId: string, lessonId: string, document: LessonDocumentJSON): Promise<SaveLessonResult> {
  const clean = cleanDocument(document);
  const name = lessonNameOf(document);
  const reference = doc(lessonsCollection(userId), lessonId);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return { status: 'missing' } as const;
    const tree = await readTreeIn(transaction, userId);
    const isPublic = snapshot.data().public === true;
    transaction.update(reference, { name, document: clean, updatedAt: serverTimestamp() });
    if (isPublic) transaction.set(publicLessonDoc(lessonId), mirrorData(userId, name, clean));
    // The tree's index carries the title: refresh it only when it changed.
    const entry = tree && Object.hasOwn(tree.lessons, lessonId) ? tree.lessons[lessonId] : null;
    if (tree && (!entry || entry.title !== name || entry.public !== isPublic)) {
      writeTreeIn(transaction, userId, upsertLessonEntry(tree, lessonId, { title: name, public: isPublic }));
    }
    return { status: 'saved', isPublic } as const;
  });
}

/**
 * Turns a Lesson's public link on or off now. On publishes what is *saved*
 * (read from the server, not the editor's unsaved state) in the same
 * transaction as the flag; off removes the mirror in it. The Lesson tree's
 * entry and public copy follow in the same transaction. Throws on failure.
 */
export async function setLessonPublic(userId: string, lessonId: string, isPublic: boolean): Promise<void> {
  const reference = doc(lessonsCollection(userId), lessonId);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('The lesson no longer exists.');
    const tree = await readTreeIn(transaction, userId);
    transaction.update(reference, { public: isPublic });
    if (isPublic) {
      const saved = snapshot.data() as Partial<StoredLesson>;
      transaction.set(publicLessonDoc(lessonId), mirrorData(userId, saved.name ?? 'Untitled lesson', cleanDocument(saved.document ?? emptyLessonDocument())));
    } else {
      transaction.delete(publicLessonDoc(lessonId));
    }
    if (tree) writeTreeIn(transaction, userId, upsertLessonEntry(tree, lessonId, { public: isPublic }));
  });
}

/** Removes the mirror first (an error is ignored), then the Lesson and its tree entry. */
export async function deleteLesson(userId: string, lessonId: string): Promise<void> {
  try {
    await deleteDoc(publicLessonDoc(lessonId));
  } catch (err) {
    console.error('Failed to delete public lesson mirror', err);
  }
  const reference = doc(lessonsCollection(userId), lessonId);
  await runTransaction(firestore, async (transaction) => {
    const tree = await readTreeIn(transaction, userId);
    transaction.delete(reference);
    if (tree && Object.hasOwn(tree.lessons, lessonId)) writeTreeIn(transaction, userId, removeLessonEntry(tree, lessonId));
  });
}

export async function findPublicLessonById(lessonId: string): Promise<PublicLesson | null> {
  const snapshot = await getDoc(publicLessonDoc(lessonId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PublicLesson;
}
