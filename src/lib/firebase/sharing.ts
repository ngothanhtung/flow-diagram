'use client';

import { collection, deleteDoc, doc, FieldPath, FirestoreError, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where, type QuerySnapshot } from 'firebase/firestore';
import { accessDocId, accessFields, normalizeEmail, parseAccessIndex, type AccessIndex, type AccessLevel } from '../sharing';
import { firestore } from './client';

/**
 * The access index of Share (PRD v0.3 §4.2, ADR 0001):
 * `diagram-access/{ownerUid}_{diagramId}` lists a Diagram's Collaborators.
 * The Diagram itself never moves — it stays at `users/{ownerUid}/diagrams/{id}`,
 * and a Diagram with no index belongs to its Owner alone (every Diagram
 * created before Share). firestore.rules reads the same document to let a
 * Collaborator in; only the Owner writes it, except for each Collaborator's
 * own first-open mark.
 */

const ACCESS_COLLECTION = 'diagram-access';

function accessRef(ownerUid: string, diagramId: string) {
  return doc(firestore, ACCESS_COLLECTION, accessDocId(ownerUid, diagramId));
}

/** The Owner's read of their own Diagram's index (null = not shared). */
export async function loadAccessIndex(ownerUid: string, diagramId: string): Promise<AccessIndex | null> {
  const snapshot = await getDoc(accessRef(ownerUid, diagramId));
  return snapshot.exists() ? parseAccessIndex(snapshot.data()) : null;
}

/** Every index the Owner has — the Diagrams list's "shared with N" marker
 *  and delete warning, one query for the whole list. */
export async function listOwnedAccess(ownerUid: string): Promise<Map<string, AccessIndex>> {
  const snapshot = await getDocs(query(collection(firestore, ACCESS_COLLECTION), where('ownerUid', '==', ownerUid)));
  const byDiagram = new Map<string, AccessIndex>();
  for (const item of snapshot.docs) {
    const index = parseAccessIndex(item.data());
    if (index && index.collaboratorEmails.length > 0) byDiagram.set(index.diagramId, index);
  }
  return byDiagram;
}

/**
 * "Shared with me": every index listing `email`. The rules allow this
 * query only for the caller's own **verified** email, so callers check
 * verification first rather than surface a permission error.
 */
export async function listSharedAccess(email: string): Promise<AccessIndex[]> {
  const key = normalizeEmail(email);
  if (!key) return [];
  const snapshot = await getDocs(query(collection(firestore, ACCESS_COLLECTION), where('collaboratorEmails', 'array-contains', key)));
  return snapshot.docs.map((item) => parseAccessIndex(item.data())).filter((index): index is AccessIndex => index !== null);
}

/**
 * The index through which `email` may open Diagram `diagramId`, if any —
 * how `/diagrams/{id}/edit` and `/view` find the Owner from a bare id.
 * A query, not a get: the route carries no owner uid. Two Owners can't
 * both list the caller on the same id in practice (ids are random); if
 * they did, the first answer wins.
 *
 * The query wants the composite index `diagram-access (diagramId ASC,
 * collaboratorEmails CONTAINS)` from `firestore.indexes.json`; until it is
 * deployed (`failed-precondition`), it falls back to the "Shared with me"
 * query and filters here — correct, one read per Diagram shared with the
 * caller instead of one.
 */
export async function findSharedAccess(email: string, diagramId: string): Promise<AccessIndex | null> {
  const key = normalizeEmail(email);
  if (!key || !diagramId) return null;
  const shared = collection(firestore, ACCESS_COLLECTION);
  let snapshot: QuerySnapshot;
  try {
    snapshot = await getDocs(query(shared, where('diagramId', '==', diagramId), where('collaboratorEmails', 'array-contains', key)));
  } catch (error) {
    if (!(error instanceof FirestoreError) || error.code !== 'failed-precondition') throw error;
    console.warn('Share: composite index diagram-access(diagramId, collaboratorEmails) is missing — deploy firestore.indexes.json. Falling back to the Shared-with-me query.', error);
    snapshot = await getDocs(query(shared, where('collaboratorEmails', 'array-contains', key)));
  }
  for (const item of snapshot.docs) {
    const index = parseAccessIndex(item.data());
    if (index && index.diagramId === diagramId) return index;
  }
  return null;
}

/**
 * Changes a Diagram's Collaborator list, read-modify-write in a
 * transaction so two of the Owner's tabs can't drop each other's invites.
 * `change` gets the current map (normalised emails → level) and returns
 * the next one. An empty result deletes the index: no index = owner-only,
 * exactly like a Diagram that was never shared. Returns the stored index.
 */
export async function updateCollaborators(
  owner: { uid: string; email: string | null },
  diagramId: string,
  change: (current: Record<string, AccessLevel>) => Record<string, AccessLevel>,
): Promise<AccessIndex | null> {
  const reference = accessRef(owner.uid, diagramId);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists() ? parseAccessIndex(snapshot.data()) : null;
    const next = change({ ...(current?.collaborators ?? {}) });
    if (Object.keys(next).length === 0) {
      if (snapshot.exists()) transaction.delete(reference);
      return null;
    }
    const rawOpened = (snapshot.exists() ? (snapshot.get('openedBy') as Record<string, unknown> | undefined) : undefined) ?? {};
    const fields = accessFields(next, rawOpened);
    const ownerEmail = normalizeEmail(owner.email);
    transaction.set(reference, { ownerUid: owner.uid, ownerEmail, diagramId, ...fields, updatedAt: serverTimestamp() });
    return {
      ownerUid: owner.uid,
      ownerEmail,
      diagramId,
      collaborators: fields.collaborators,
      collaboratorEmails: fields.collaboratorEmails,
      openedBy: current ? Object.fromEntries(Object.entries(current.openedBy).filter(([email]) => email in fields.collaborators)) : {},
    };
  });
}

/** Removes the index (Diagram delete). Missing is fine. */
export async function deleteAccessIndex(ownerUid: string, diagramId: string): Promise<void> {
  await deleteDoc(accessRef(ownerUid, diagramId));
}

/**
 * Records that `email` has now seen the Diagram (Shared with me, the
 * Editor or the Viewer) — what turns "Pending" off in the Share dialog.
 * Written once; best-effort, since it is only a hint for the Owner.
 */
export async function markOpened(index: AccessIndex, email: string): Promise<void> {
  const key = normalizeEmail(email);
  if (!key || Object.hasOwn(index.openedBy, key) || !Object.hasOwn(index.collaborators, key)) return;
  try {
    await updateDoc(accessRef(index.ownerUid, index.diagramId), new FieldPath('openedBy', key), serverTimestamp());
  } catch (error) {
    console.warn('Could not record that this shared diagram was opened', error);
  }
}
