'use client';

import {
  collection,
  doc,
  FirestoreError,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import type { FlowDocumentJSON } from '../flowchart-types';
import { excessUnnamed, normalizeVersionName, unnamedVersionsToPrune, type VersionActor, type VersionSummary } from '../version-history';
import { firestore } from './client';

/**
 * Versions of a Diagram (PRD v0.3 §4.1) live in a subcollection of the
 * Diagram they belong to: `users/{ownerUid}/diagrams/{id}/versions/{vid}`.
 * They are written by `saveDiagram` / `createDiagram` (one per Save, in the
 * same batch as the Diagram itself) and removed by `pruneVersions` (on
 * Save) and `deleteAllVersions` (on Diagram delete). Apart from `name`,
 * a Version never changes — `firestore.rules` enforces that.
 */

/** A Version as stored. */
interface StoredVersionData {
  document: FlowDocumentJSON;
  savedAt: Timestamp | null;
  savedBy: VersionActor;
  name: string | null;
}

/** A Version with its document, for preview / restore / save-as. */
export interface StoredVersion extends VersionSummary {
  document: FlowDocumentJSON;
}

/** Writes per batch when deleting every Version of a Diagram. Well under
 *  Firestore's 500-write batch cap, and it bounds how many full documents
 *  one read pulls into memory. */
const DELETE_CHUNK = 200;

export function versionsCollection(ownerUid: string, diagramId: string) {
  if (!ownerUid || !diagramId) throw new Error('An owner uid and a diagram id are required.');
  return collection(firestore, 'users', ownerUid, 'diagrams', diagramId, 'versions');
}

/**
 * The fields of a new Version. `name: null` is written explicitly — the
 * prune query filters on `name == null`, which a missing field would not
 * match. `document` must already be Firestore-clean (no `undefined`).
 */
export function newVersionData(document: FlowDocumentJSON, savedBy: VersionActor) {
  return { document, savedAt: serverTimestamp(), savedBy, name: null };
}

function toStoredVersion(snapshot: QueryDocumentSnapshot): StoredVersion {
  // 'estimate': a Version this client just wrote may still lack its
  // server time locally; the local estimate keeps it sortable.
  const data = snapshot.data({ serverTimestamps: 'estimate' }) as Partial<StoredVersionData>;
  return {
    id: snapshot.id,
    name: typeof data.name === 'string' ? data.name : null,
    savedAt: data.savedAt ? data.savedAt.toMillis() : null,
    savedBy: data.savedBy ?? null,
    document: data.document ?? { nodes: [], edges: [] },
  };
}

/** Every Version of a Diagram, newest first. */
export async function listVersions(ownerUid: string, diagramId: string): Promise<StoredVersion[]> {
  const snapshot = await getDocs(query(versionsCollection(ownerUid, diagramId), orderBy('savedAt', 'desc')));
  return snapshot.docs.map(toStoredVersion);
}

/** Name, rename or (with an empty string) unname a Version. Returns the
 *  name actually stored. */
export async function renameVersion(ownerUid: string, diagramId: string, versionId: string, name: string): Promise<string | null> {
  const next = normalizeVersionName(name);
  await updateDoc(doc(versionsCollection(ownerUid, diagramId), versionId), { name: next });
  return next;
}

/**
 * Retention: keep the `UNNAMED_VERSIONS_KEPT` newest unnamed Versions,
 * delete older unnamed ones. Runs client-side after every Save — there is
 * no server to do it (no Cloud Functions on the free plan).
 *
 * Cost at steady state (51 unnamed after a Save): one count aggregation
 * (billed as one read), one query returning the single oldest unnamed
 * Version, and one transactional re-read + delete of it — never a read of
 * the whole history. The ordered query needs the composite index
 * `versions (name ASC, savedAt ASC)` from `firestore.indexes.json`; if
 * that index is missing (not deployed yet), it falls back to reading every
 * unnamed Version and sorting here — still correct, just ~50 reads.
 *
 * The deletes run in a transaction that re-reads each candidate, so a
 * Version someone names between the query and the delete is kept.
 *
 * Best-effort, like the public mirror sync: logs and never throws, because
 * a failed prune must not fail the Save that triggered it — the next Save
 * catches up.
 */
export async function pruneVersions(ownerUid: string, diagramId: string): Promise<number> {
  try {
    const unnamed = query(versionsCollection(ownerUid, diagramId), where('name', '==', null));
    const excess = excessUnnamed((await getCountFromServer(unnamed)).data().count);
    if (excess === 0) return 0;

    let candidates: QueryDocumentSnapshot[];
    try {
      candidates = (await getDocs(query(unnamed, orderBy('savedAt', 'asc'), limit(excess)))).docs;
    } catch (error) {
      if (!(error instanceof FirestoreError) || error.code !== 'failed-precondition') throw error;
      console.warn('Version prune: composite index versions(name, savedAt) is missing — deploy firestore.indexes.json. Falling back to reading every unnamed version.', error);
      const all = (await getDocs(unnamed)).docs;
      const doomed = new Set(unnamedVersionsToPrune(all.map(toStoredVersion)));
      candidates = all.filter((snapshot) => doomed.has(snapshot.id));
    }

    let deleted = 0;
    for (let start = 0; start < candidates.length; start += DELETE_CHUNK) {
      const chunk = candidates.slice(start, start + DELETE_CHUNK);
      deleted += await runTransaction(firestore, async (transaction) => {
        const fresh = await Promise.all(chunk.map((candidate) => transaction.get(candidate.ref)));
        let count = 0;
        for (const snapshot of fresh) {
          if (!snapshot.exists() || snapshot.get('name') !== null) continue;
          transaction.delete(snapshot.ref);
          count += 1;
        }
        return count;
      });
    }
    return deleted;
  } catch (error) {
    console.error('Failed to prune old versions', error);
    return 0;
  }
}

/**
 * Deletes every Version of a Diagram, Named ones included (Firestore does
 * not cascade a document delete to its subcollections). Chunked, so a
 * Diagram with any number of Versions — Named ones are unbounded — stays
 * within the batch write limit. Throws on failure: the caller deletes the
 * Diagram itself only after this succeeded, so a half-done delete leaves
 * the Diagram in place to retry rather than orphaned Versions behind it.
 */
export async function deleteAllVersions(ownerUid: string, diagramId: string): Promise<number> {
  const versions = versionsCollection(ownerUid, diagramId);
  let deleted = 0;
  for (;;) {
    const snapshot = await getDocs(query(versions, limit(DELETE_CHUNK)));
    if (snapshot.empty) return deleted;
    const batch = writeBatch(firestore);
    for (const item of snapshot.docs) batch.delete(item.ref);
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < DELETE_CHUNK) return deleted;
  }
}
