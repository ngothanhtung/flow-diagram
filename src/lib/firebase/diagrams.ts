'use client';

import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { collaboratorLevel, revisionOf, saveDecision, type AccessIndex, type AccessLevel, type DiagramRole } from '../sharing';
import { hasVersionableContent, type VersionActor } from '../version-history';
import { firestore } from './client';
import { deleteAccessIndex, findSharedAccess, listSharedAccess, markOpened } from './sharing';
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
  /** Save counter: +1 on every Save, which the rules enforce. A Save
   *  conflict is the server having moved past the revision the editor
   *  loaded. Absent on Diagrams last saved before Share — read it through
   *  `revisionOf`, which counts that as 0. */
  revision?: number;
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
    revision: 0,
  });
  if (hasVersionableContent(clean)) batch.set(doc(versionsCollection(userId, reference.id)), newVersionData(clean, actor));
  await batch.commit();
  // A brand-new diagram has no mirror to clear, so only a public one syncs.
  if (isPublic) await syncPublicMirror(userId, reference.id, name, document, isPublic);
  return reference.id;
}

/** What a Save came to. */
export type SaveResult =
  /** Written: the Diagram is now at `revision`; `isPublic` is the server's
   *  flag (the Share dialog may have changed it since the editor loaded). */
  | { status: 'saved'; revision: number; isPublic: boolean }
  /** Someone saved since `baseRevision`; nothing was written. The editor
   *  shows who and when, and Overwrite retries with `revision` as base. */
  | { status: 'conflict'; revision: number; lastSavedBy: VersionActor | null; lastSavedAt: number | null }
  /** The Diagram no longer exists (its Owner deleted it). */
  | { status: 'missing' };

export interface SaveRequest {
  /** Whose uid path the Diagram lives under — the signed-in user for their
   *  own Diagrams, the Owner for a Collaborator's Save. */
  ownerUid: string;
  diagramId: string;
  name: string;
  document: FlowDocumentJSON;
  actor: VersionActor;
  /** The revision the editor loaded or last saved. */
  baseRevision: number;
  /** Whether the saver is the Owner: only the Owner clears a stale mirror
   *  of a private Diagram (a Collaborator may not delete the mirror). */
  asOwner: boolean;
}

/**
 * Save, in one transaction: read the Diagram, compare its revision with
 * the one the editor has (`saveDecision`); equal → write the Diagram
 * (revision + 1, `lastSavedBy`) and a new Version together; different →
 * write nothing and report the Save conflict. The transaction re-runs if
 * someone else's Save lands between its read and its commit, so two Saves
 * from the same revision can never both go through (the rules require
 * revision + 1 as well, which also stops any client that skips this).
 *
 * `public` is never written here — the Share dialog owns it and applies
 * it immediately — so a Save can't undo a Public toggle made elsewhere.
 * Afterwards, best-effort: the Public link mirror follows the server's
 * flag, then Version retention.
 *
 * A permission-denied FirebaseError is left to the caller: for a
 * Collaborator it means their access was removed or lowered.
 */
export async function saveDiagram({ ownerUid, diagramId, name, document, actor, baseRevision, asOwner }: SaveRequest): Promise<SaveResult> {
  if (!diagramId) throw new Error('A diagram id is required.');
  const clean = cleanDocument(document);
  const reference = doc(diagramsCollection(ownerUid), diagramId);
  const result = await runTransaction(firestore, async (transaction): Promise<SaveResult> => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return { status: 'missing' };
    const data = snapshot.data() as Partial<StoredDiagram>;
    const server = revisionOf(data);
    if (saveDecision(baseRevision, server) === 'conflict') {
      return { status: 'conflict', revision: server, lastSavedBy: data.lastSavedBy ?? null, lastSavedAt: data.updatedAt ? data.updatedAt.toMillis() : null };
    }
    transaction.update(reference, {
      name,
      document: clean,
      updatedAt: serverTimestamp(),
      lastSavedBy: actor,
      revision: server + 1,
    });
    transaction.set(doc(versionsCollection(ownerUid, diagramId)), newVersionData(clean, actor));
    return { status: 'saved', revision: server + 1, isPublic: data.public === true };
  });
  if (result.status === 'saved') {
    if (result.isPublic || asOwner) await syncPublicMirror(ownerUid, diagramId, name, document, result.isPublic);
    await pruneVersions(ownerUid, diagramId);
  }
  return result;
}

/**
 * Turns a Diagram's Public link on or off **now** — the Share dialog's
 * toggle, Owner only. On publishes what is *saved* (read from the server,
 * not the editor's unsaved canvas) to the mirror in the same batch as the
 * flag; off removes the mirror in the same batch. Unlike the mirror sync
 * after a Save, this throws: the toggle has to show whether it worked.
 */
export async function setDiagramPublic(ownerUid: string, diagramId: string, isPublic: boolean): Promise<void> {
  const reference = doc(diagramsCollection(ownerUid), diagramId);
  const batch = writeBatch(firestore);
  batch.update(reference, { public: isPublic });
  if (isPublic) {
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new Error('The diagram no longer exists.');
    const saved = snapshot.data() as Partial<StoredDiagram>;
    batch.set(publicDiagramDoc(diagramId), {
      ownerUid,
      name: saved.name ?? 'Untitled diagram',
      document: cleanDocument(saved.document ?? { nodes: [], edges: [] }),
      public: true,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.delete(publicDiagramDoc(diagramId));
  }
  await batch.commit();
}

export async function loadDiagram(userId: string, diagramId: string) {
  const snapshot = await getDoc(doc(diagramsCollection(userId), diagramId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as StoredDiagram;
}

/** Who is opening `/diagrams/{id}/…` and as what. */
export type DiagramOpening =
  | { role: DiagramRole; ownerUid: string; ownerEmail: string | null; diagram: StoredDiagram; index: AccessIndex | null }
  /** `unverified`: nothing of the caller's own, and their email isn't
   *  verified — so a Diagram shared with them can't be seen yet. */
  | { role: null; reason: 'not-found' | 'unverified' };

/**
 * Resolves a bare Diagram id for the signed-in user (ADR 0001):
 *
 * 1. Their own `users/{uid}/diagrams/{id}` — the Owner, and every link
 *    from before Share, with exactly the one read it always took.
 * 2. Otherwise the access index, by id and the user's verified email —
 *    a Collaborator, with their Access level, reading the Owner's path.
 *
 * Owner first, not index first: a Diagram's index can only be written by
 * its Owner, but resolving your own Diagram must never depend on it.
 * A Collaborator's first open is recorded (`markOpened`) for the Share
 * dialog's "Pending" badge.
 */
export async function openDiagram(user: { uid: string; email: string | null; emailVerified: boolean }, diagramId: string): Promise<DiagramOpening> {
  const own = await loadDiagram(user.uid, diagramId);
  if (own) return { role: 'owner', ownerUid: user.uid, ownerEmail: user.email, diagram: own, index: null };
  if (!user.email) return { role: null, reason: 'not-found' };
  if (!user.emailVerified) return { role: null, reason: 'unverified' };
  const index = await findSharedAccess(user.email, diagramId);
  const level = collaboratorLevel(index, user.email);
  if (!index || !level) return { role: null, reason: 'not-found' };
  const diagram = await loadDiagram(index.ownerUid, diagramId);
  if (!diagram) return { role: null, reason: 'not-found' };
  void markOpened(index, user.email);
  return { role: level, ownerUid: index.ownerUid, ownerEmail: index.ownerEmail || null, diagram, index };
}

/** One row of "Shared with me". */
export interface SharedDiagram {
  diagram: StoredDiagram;
  ownerUid: string;
  ownerEmail: string;
  level: AccessLevel;
}

/**
 * "Shared with me": one query over the access index for the user's
 * verified email, then one read of each Diagram from its Owner's path.
 *
 * Per-Diagram reads rather than a name/time copied into the index: the
 * index is the Owner's to write, so a Collaborator's Save couldn't keep a
 * copy fresh — reading the Diagram is always right, costs one read per
 * shared Diagram (the same order as the owner's own list, which reads
 * every Diagram), and drops a Diagram deleted under a stale index. Seeing
 * a Diagram here counts as having opened it (the "Pending" badge).
 */
export async function listSharedWithMe(user: { email: string | null }): Promise<SharedDiagram[]> {
  if (!user.email) return [];
  const email = user.email;
  const indexes = await listSharedAccess(email);
  const rows = await Promise.all(
    indexes.map(async (index): Promise<SharedDiagram | null> => {
      const level = collaboratorLevel(index, email);
      if (!level) return null;
      try {
        const diagram = await loadDiagram(index.ownerUid, index.diagramId);
        if (!diagram) return null;
        void markOpened(index, email);
        return { diagram, ownerUid: index.ownerUid, ownerEmail: index.ownerEmail, level };
      } catch (error) {
        console.warn('Could not read a shared diagram', index.diagramId, error);
        return null;
      }
    }),
  );
  return rows.filter((row): row is SharedDiagram => row !== null);
}

export async function listDiagrams(userId: string) {
  const snapshot = await getDocs(query(diagramsCollection(userId), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoredDiagram);
}

/** Deletes a diagram: every one of its Versions first (Firestore does not
 *  cascade, and a failure part-way must leave the diagram in place to
 *  retry rather than orphaned Versions), then its access index — which is
 *  what drops it from every Collaborator's "Shared with me", and goes
 *  before the Diagram for the same reason — then the Diagram, then its
 *  public mirror. */
export async function deleteDiagram(userId: string, diagramId: string) {
  await deleteAllVersions(userId, diagramId);
  await deleteAccessIndex(userId, diagramId);
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
