'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { firestore } from './client';

export interface StoredDiagram {
  id: string;
  name: string;
  document: FlowDocumentJSON;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

function diagramsCollection(userId: string) {
  if (!userId) throw new Error('A Firebase user id is required.');
  return collection(firestore, 'users', userId, 'diagrams');
}

function cleanDocument(document: FlowDocumentJSON): FlowDocumentJSON {
  // Firestore rejects undefined values. Flow documents only contain JSON data,
  // so a JSON round-trip safely removes optional properties set to undefined.
  return JSON.parse(JSON.stringify(document)) as FlowDocumentJSON;
}

export async function createDiagram(
  userId: string,
  name: string,
  document: FlowDocumentJSON,
) {
  const reference = await addDoc(diagramsCollection(userId), {
    name,
    document: cleanDocument(document),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function saveDiagram(
  userId: string,
  diagramId: string,
  name: string,
  document: FlowDocumentJSON,
) {
  if (!diagramId) throw new Error('A diagram id is required.');
  await setDoc(
    doc(diagramsCollection(userId), diagramId),
    {
      name,
      document: cleanDocument(document),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadDiagram(userId: string, diagramId: string) {
  const snapshot = await getDoc(doc(diagramsCollection(userId), diagramId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as StoredDiagram;
}

export async function listDiagrams(userId: string) {
  const snapshot = await getDocs(
    query(diagramsCollection(userId), orderBy('updatedAt', 'desc')),
  );
  return snapshot.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as StoredDiagram,
  );
}

export function deleteDiagram(userId: string, diagramId: string) {
  return deleteDoc(doc(diagramsCollection(userId), diagramId));
}
