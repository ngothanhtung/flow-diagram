'use client';

import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, writeBatch, type Timestamp } from 'firebase/firestore';
import { emptyLessonDocument, type LessonDocumentJSON } from '../lesson/lesson-types';
import { firestore } from './client';

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

export async function createLesson(userId: string, name: string, document: LessonDocumentJSON): Promise<string> {
  const reference = doc(lessonsCollection(userId));
  await writeBatch(firestore)
    .set(reference, { name, document: cleanDocument(document), public: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    .commit();
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

/**
 * Saves a Lesson. One batch writes the Lesson and, when it is public, its
 * mirror, so the public copy never lags a successful Save. `public` is not
 * written here: `setLessonPublic` owns it.
 */
export async function saveLesson(userId: string, lessonId: string, name: string, document: LessonDocumentJSON, isPublic: boolean): Promise<void> {
  const clean = cleanDocument(document);
  const batch = writeBatch(firestore);
  batch.update(doc(lessonsCollection(userId), lessonId), { name, document: clean, updatedAt: serverTimestamp() });
  if (isPublic) batch.set(publicLessonDoc(lessonId), mirrorData(userId, name, clean));
  await batch.commit();
}

/**
 * Turns a Lesson's public link on or off now. On publishes what is *saved*
 * (read from the server, not the editor's unsaved state) in the same batch
 * as the flag; off removes the mirror in the same batch. Throws on failure.
 */
export async function setLessonPublic(userId: string, lessonId: string, isPublic: boolean): Promise<void> {
  const reference = doc(lessonsCollection(userId), lessonId);
  const batch = writeBatch(firestore);
  batch.update(reference, { public: isPublic });
  if (isPublic) {
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new Error('The lesson no longer exists.');
    const saved = snapshot.data() as Partial<StoredLesson>;
    batch.set(publicLessonDoc(lessonId), mirrorData(userId, saved.name ?? 'Untitled lesson', cleanDocument(saved.document ?? emptyLessonDocument())));
  } else {
    batch.delete(publicLessonDoc(lessonId));
  }
  await batch.commit();
}

/** Removes the mirror first (an error is ignored), then the Lesson. */
export async function deleteLesson(userId: string, lessonId: string): Promise<void> {
  try {
    await deleteDoc(publicLessonDoc(lessonId));
  } catch (err) {
    console.error('Failed to delete public lesson mirror', err);
  }
  await deleteDoc(doc(lessonsCollection(userId), lessonId));
}

export async function findPublicLessonById(lessonId: string): Promise<PublicLesson | null> {
  const snapshot = await getDoc(publicLessonDoc(lessonId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PublicLesson;
}
