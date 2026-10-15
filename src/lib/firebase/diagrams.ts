'use client';

import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { hasVersionableContent, type VersionActor } from '../version-history';
import { firestore } from './client';
import { deleteAllVersions, newVersionData, pruneVersions, versionsCollection } from './versions';

export interface StoredDiagram {
  id: string;
  name: string;
  document: FlowDocumentJSON;
  /** Public diagrams are readable by any signed-in user via the viewer. */
  public?: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  /** Who performed the last Save (or the create). Absent on diagrams
   *  last saved before Versions existed. `updatedAt` is the "when". */
  lastSavedBy?: VersionActor;
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

function publicDiagramDoc(diagramId: string) {
  return doc(firestore, 'public-diagrams', diagramId);
}

/**
 * Keeps the flat `public-diagrams/{id}` mirror in sync with a diagram's
 * `public` flag, so anonymous viewers can read it without a collection-group
 * query (see `findPublicDiagramById`). Best-effort: logs rather than throws,
 * since a mirror sync failure shouldn't fail the caller's save/create/delete.
 */
async function syncPublicMirror(userId: string, diagramId: string, name: string, document: FlowDocumentJSON, isPublic: boolean) {
  try {
    if (isPublic) {
      await setDoc(
        publicDiagramDoc(diagramId),
        {
          ownerUid: userId,
          name,
          document: cleanDocument(document),
          public: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      await deleteDoc(publicDiagramDoc(diagramId));
    }
  } catch (err) {
    console.error('Failed to sync public diagram mirror', err);
  }
}

/**
 * Creates a diagram owned by `userId` — and, when it has content, its
 * first Version in the same batch. Every write of content to a diagram
 * (create or Save) produces a Version, so "the newest Version is what is
 * saved" holds from the start: a Save-as copy, a diagram from a template
 * or one copied from an old Version opens with a history, and Restore /
 * Save conflicts never meet saved content that exists nowhere in its
 * history. A blank "New diagram" is the exception (`hasVersionableContent`):
 * an empty canvas has nothing to restore.
 */
export async function createDiagram(userId: string, name: string, document: FlowDocumentJSON, isPublic: boolean, actor: VersionActor) {
  const reference = doc(diagramsCollection(userId));
  const clean = cleanDocument(document);
  const batch = writeBatch(firestore);
  batch.set(reference, {
    name,
    document: clean,
    public: isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSavedBy: actor,
  });
  if (hasVersionableContent(clean)) batch.set(doc(versionsCollection(userId, reference.id)), newVersionData(clean, actor));
  await batch.commit();
  // A brand-new diagram has no mirror to clear, so only a public one syncs.
  if (isPublic) await syncPublicMirror(userId, reference.id, name, document, isPublic);
  return reference.id;
}

/**
 * Save: the diagram and a new Version, atomically (one batch — a Save
 * never lands without its Version). Then, best-effort and in this order,
 * the public mirror and Version retention; neither can fail the Save.
 */
export async function saveDiagram(userId: string, diagramId: string, name: string, document: FlowDocumentJSON, isPublic: boolean, actor: VersionActor) {
  if (!diagramId) throw new Error('A diagram id is required.');
  const clean = cleanDocument(document);
  const batch = writeBatch(firestore);
  batch.set(
    doc(diagramsCollection(userId), diagramId),
    {
      name,
      document: clean,
      public: isPublic,
      updatedAt: serverTimestamp(),
      lastSavedBy: actor,
    },
    { merge: true },
  );
  batch.set(doc(versionsCollection(userId, diagramId)), newVersionData(clean, actor));
  await batch.commit();
  await syncPublicMirror(userId, diagramId, name, document, isPublic);
  await pruneVersions(userId, diagramId);
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

/** Deletes a diagram, every one of its Versions (first — Firestore does
 *  not cascade, and a failure part-way must leave the diagram in place to
 *  retry rather than orphaned Versions), then its public mirror. */
export async function deleteDiagram(userId: string, diagramId: string) {
  await deleteAllVersions(userId, diagramId);
  await deleteDoc(doc(diagramsCollection(userId), diagramId));
  await deleteDoc(publicDiagramDoc(diagramId)).catch(() => undefined);
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
 * Finds a single public diagram by its document id — the anonymous/
 * non-admin viewer path. Reads the flat `public-diagrams/{id}` mirror
 * directly (see `syncPublicMirror`), so it needs no auth and no
 * collection-group query.
 */
export async function findPublicDiagramById(diagramId: string): Promise<AdminDiagramRow | null> {
  if (!diagramId) return null;
  const snapshot = await getDoc(publicDiagramDoc(diagramId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<Omit<StoredDiagram, 'id'>> & { ownerUid?: string };
  return toViewerRow(snapshot.id, data.ownerUid ?? 'unknown', data);
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
