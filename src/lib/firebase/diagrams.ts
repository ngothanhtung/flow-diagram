'use client';

import { addDoc, collection, collectionGroup, deleteDoc, doc, documentId, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
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

export async function createDiagram(userId: string, name: string, document: FlowDocumentJSON) {
  const reference = await addDoc(diagramsCollection(userId), {
    name,
    document: cleanDocument(document),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function saveDiagram(userId: string, diagramId: string, name: string, document: FlowDocumentJSON) {
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
  const snapshot = await getDocs(query(diagramsCollection(userId), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoredDiagram);
}

export function deleteDiagram(userId: string, diagramId: string) {
  return deleteDoc(doc(diagramsCollection(userId), diagramId));
}

/** Flattened row for the read-only admin overview. Timestamps are
 *  converted to epoch millis so the table can sort them natively. */
export interface AdminDiagramRow {
  id: string;
  ownerUid: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: number | null;
  updatedAt: number | null;
  document: FlowDocumentJSON;
}

/**
 * Finds a single diagram by its document id across all users — the
 * viewer route `/diagrams/{id}/view` only knows the id, not the owner
 * uid. Uses a collection-group query filtered by `documentId()`.
 */
export async function findDiagramById(diagramId: string): Promise<AdminDiagramRow | null> {
  if (!diagramId) return null;
  const snapshot = await getDocs(query(collectionGroup(firestore, 'diagrams'), where(documentId(), '==', diagramId)));
  const item = snapshot.docs[0];
  if (!item) return null;
  const data = item.data() as Partial<Omit<StoredDiagram, 'id'>>;
  const document: FlowDocumentJSON = data.document ?? { nodes: [], edges: [] };
  return {
    id: item.id,
    ownerUid: item.ref.parent.parent?.id ?? 'unknown',
    name: data.name || '(untitled)',
    nodeCount: document.nodes?.length ?? 0,
    edgeCount: document.edges?.length ?? 0,
    createdAt: data.createdAt ? data.createdAt.toMillis() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toMillis() : null,
    document,
  };
}

/**
 * Lists every diagram across all users via a `diagrams` collection-group
 * query — the admin page is read-only, so only `get`/`list` access is
 * needed (see firestore.rules). No `orderBy` on the server side so the
 * query needs no composite index; sorting happens in the table.
 */
export async function listAllDiagrams(): Promise<AdminDiagramRow[]> {
  const snapshot = await getDocs(collectionGroup(firestore, 'diagrams'));
  return snapshot.docs.map((item) => {
    const data = item.data() as Partial<Omit<StoredDiagram, 'id'>>;
    const document: FlowDocumentJSON = data.document ?? { nodes: [], edges: [] };
    return {
      id: item.id,
      // Doc path is users/{uid}/diagrams/{diagramId} — the grandparent
      // document id is the owner's uid.
      ownerUid: item.ref.parent.parent?.id ?? 'unknown',
      name: data.name || '(untitled)',
      nodeCount: document.nodes?.length ?? 0,
      edgeCount: document.edges?.length ?? 0,
      createdAt: data.createdAt ? data.createdAt.toMillis() : null,
      updatedAt: data.updatedAt ? data.updatedAt.toMillis() : null,
      document,
    };
  });
}
