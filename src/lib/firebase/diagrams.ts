'use client';

import { addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { firestore } from './client';

export interface StoredDiagram {
  id: string;
  name: string;
  document: FlowDocumentJSON;
  /** Public diagrams are readable by any signed-in user via the viewer. */
  public?: boolean;
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

export async function createDiagram(userId: string, name: string, document: FlowDocumentJSON, isPublic = false) {
  const reference = await addDoc(diagramsCollection(userId), {
    name,
    document: cleanDocument(document),
    public: isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function saveDiagram(userId: string, diagramId: string, name: string, document: FlowDocumentJSON, isPublic = false) {
  if (!diagramId) throw new Error('A diagram id is required.');
  await setDoc(
    doc(diagramsCollection(userId), diagramId),
    {
      name,
      document: cleanDocument(document),
      public: isPublic,
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
  public: boolean;
  nodeCount: number;
  edgeCount: number;
  createdAt: number | null;
  updatedAt: number | null;
  document: FlowDocumentJSON;
}

/** Shared mapper from a raw Firestore doc into a flattened viewer row.
 *  Exported so the viewer can convert a direct owner read as well. */
export function toViewerRow(id: string, ownerUid: string, data: Partial<Omit<StoredDiagram, 'id'>>): AdminDiagramRow {
  const document: FlowDocumentJSON = data.document ?? { nodes: [], edges: [] };
  return {
    id,
    ownerUid,
    name: data.name || '(untitled)',
    public: data.public === true,
    nodeCount: document.nodes?.length ?? 0,
    edgeCount: document.edges?.length ?? 0,
    createdAt: data.createdAt ? data.createdAt.toMillis() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toMillis() : null,
    document,
  };
}

/**
 * Finds a single public diagram by its document id — the non-admin
 * viewer path. The query is constrained to `public == true` so the
 * security rules allow it (`request.query.public == true`); matching
 * the id itself happens client-side. Requires the collection-group
 * index defined in firestore.indexes.json.
 */
export async function findPublicDiagramById(diagramId: string): Promise<AdminDiagramRow | null> {
  if (!diagramId) return null;
  const snapshot = await getDocs(query(collectionGroup(firestore, 'diagrams'), where('public', '==', true)));
  const item = snapshot.docs.find((docItem) => docItem.id === diagramId);
  if (!item) return null;
  return toViewerRow(item.id, item.ref.parent.parent?.id ?? 'unknown', item.data() as Partial<Omit<StoredDiagram, 'id'>>);
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
    // Doc path is users/{uid}/diagrams/{diagramId} — the grandparent
    // document id is the owner's uid.
    return toViewerRow(item.id, item.ref.parent.parent?.id ?? 'unknown', item.data() as Partial<Omit<StoredDiagram, 'id'>>);
  });
}
