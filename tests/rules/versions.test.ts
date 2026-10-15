import { assertFails, assertSucceeds, type TokenOptions } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

// PRD v0.3 §4.1 — Versions: users/{owner}/diagrams/{id}/versions/{vid}.
// Readable/creatable/nameable by the Owner (T7 adds Can edit
// Collaborators), immutable except for `name`, deletable by the Owner
// (pruning, Diagram delete), all behind the Access list.

const ALICE_EMAIL = 'alice@company.com';
const BOB_EMAIL = 'bob@company.com';
const DIAGRAM = `users/${ALICE}/diagrams/d1`;
const VERSIONS = `${DIAGRAM}/versions`;
const EXISTING = `${VERSIONS}/v1`;
const NAMED = `${VERSIONS}/named`;

const token = (email: string, emailVerified = true): TokenOptions => ({ email, email_verified: emailVerified });
const flow = { nodes: [], edges: [] };
const actor = (uid: string, email: string | null, displayName: string | null = null) => ({ uid, email, displayName });

/** A Version exactly as `newVersionData` writes it. */
const newVersion = (uid = ALICE, email: string | null = ALICE_EMAIL) => ({ document: flow, savedAt: serverTimestamp(), savedBy: actor(uid, email, 'Alice'), name: null });

/** A stored Version (fixture, written with rules off). */
const storedVersion = (name: string | null = null) => ({ document: flow, savedAt: Timestamp.fromMillis(1_000), savedBy: actor(ALICE, ALICE_EMAIL, 'Alice'), name });

describe('users/{uid}/diagrams/{id}/versions/{vid}', () => {
  const env = useRulesTestEnvironment();

  const alice = () => env().authenticatedContext(ALICE, token(ALICE_EMAIL)).firestore();
  const bob = () => env().authenticatedContext(BOB, token(BOB_EMAIL)).firestore();

  async function seedHistory(extra: Record<string, Record<string, unknown>> = {}) {
    await seed(env(), {
      [DIAGRAM]: { name: 'Flow', document: flow, public: false },
      [EXISTING]: storedVersion(),
      [NAMED]: storedVersion('Sent to client'),
      ...extra,
    });
  }

  describe('owner', () => {
    it('saves: the Diagram and its new Version in one batch', async () => {
      await seedHistory();
      const db = alice();
      const batch = writeBatch(db);
      batch.set(doc(db, DIAGRAM), { name: 'Flow', document: flow, public: false, updatedAt: serverTimestamp(), lastSavedBy: actor(ALICE, ALICE_EMAIL, 'Alice') }, { merge: true });
      batch.set(doc(collection(db, VERSIONS)), newVersion());
      await assertSucceeds(batch.commit());
    });

    it('creates a Version on its own, with or without a display name', async () => {
      await assertSucceeds(setDoc(doc(alice(), `${VERSIONS}/a`), newVersion()));
      await assertSucceeds(setDoc(doc(alice(), `${VERSIONS}/b`), { ...newVersion(), savedBy: actor(ALICE, ALICE_EMAIL, null) }));
    });

    it('reads one Version and lists the history newest first', async () => {
      await seedHistory();
      await assertSucceeds(getDoc(doc(alice(), EXISTING)));
      await assertSucceeds(getDocs(query(collection(alice(), VERSIONS), orderBy('savedAt', 'desc'))));
    });

    it('runs the prune queries: count of unnamed, then the oldest unnamed', async () => {
      await seedHistory();
      const unnamed = query(collection(alice(), VERSIONS), where('name', '==', null));
      await assertSucceeds(getCountFromServer(unnamed));
      await assertSucceeds(getDocs(query(unnamed, orderBy('savedAt', 'asc'), limit(1))));
    });

    it('names, renames and unnames a Version', async () => {
      await seedHistory();
      const ref = doc(alice(), EXISTING);
      await assertSucceeds(updateDoc(ref, { name: 'Sent to client' }));
      await assertSucceeds(updateDoc(ref, { name: 'Sent to client v2' }));
      await assertSucceeds(updateDoc(ref, { name: null }));
      await assertSucceeds(updateDoc(ref, { name: 'x'.repeat(80) }));
    });

    it('deletes Versions — unnamed (pruning) and named (Diagram delete)', async () => {
      await seedHistory();
      await assertSucceeds(deleteDoc(doc(alice(), EXISTING)));
      await assertSucceeds(deleteDoc(doc(alice(), NAMED)));
    });
  });

  describe('a new Version must be what a Save writes', () => {
    it('denies a spoofed savedBy — another uid, or another email', async () => {
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedBy: actor(BOB, ALICE_EMAIL) }));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedBy: actor(ALICE, BOB_EMAIL) }));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedBy: actor(ALICE, null) }));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedBy: { ...actor(ALICE, ALICE_EMAIL), role: 'owner' } }));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedBy: 'alice' }));
    });

    it('denies a client-chosen savedAt', async () => {
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), savedAt: Timestamp.fromMillis(0) }));
    });

    it('denies creating a Version already named, with extra fields, or with missing ones', async () => {
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), name: 'Pre-named' }));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), public: true }));
      const withoutName: Partial<ReturnType<typeof newVersion>> = newVersion();
      delete withoutName.name;
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), withoutName));
      await assertFails(setDoc(doc(alice(), `${VERSIONS}/x`), { ...newVersion(), document: 'not a diagram' }));
    });
  });

  describe('a Version is immutable except for its name', () => {
    it('denies changing document, savedAt or savedBy — alone or alongside a name', async () => {
      await seedHistory();
      const ref = doc(alice(), EXISTING);
      await assertFails(updateDoc(ref, { document: { nodes: [{ id: 'n' }], edges: [] } }));
      await assertFails(updateDoc(ref, { savedAt: serverTimestamp() }));
      await assertFails(updateDoc(ref, { savedBy: actor(ALICE, ALICE_EMAIL, 'Someone else') }));
      await assertFails(updateDoc(ref, { name: 'Named', document: { nodes: [{ id: 'n' }], edges: [] } }));
      // Re-sending an unchanged field is not a change — the name is all that moves.
      await assertSucceeds(updateDoc(ref, { name: 'Named', document: flow }));
      await assertFails(updateDoc(ref, { extra: true }));
      // Overwriting the whole Version is an update too.
      await assertFails(setDoc(ref, { ...newVersion(), name: null }));
    });

    it('denies an empty, too long or non-text name', async () => {
      await seedHistory();
      const ref = doc(alice(), EXISTING);
      await assertFails(updateDoc(ref, { name: '' }));
      await assertFails(updateDoc(ref, { name: 'x'.repeat(81) }));
      await assertFails(updateDoc(ref, { name: 42 }));
    });
  });

  describe('another signed-in user (what a Can view Collaborator is to these rules until T7)', () => {
    it('cannot read or list the history — even of a Public diagram', async () => {
      await seedHistory({ [DIAGRAM]: { name: 'Flow', document: flow, public: true } });
      // The Diagram itself is readable through `public`; its history is not.
      await assertSucceeds(getDoc(doc(bob(), DIAGRAM)));
      await assertFails(getDoc(doc(bob(), EXISTING)));
      await assertFails(getDocs(collection(bob(), VERSIONS)));
      await assertFails(getCountFromServer(query(collection(bob(), VERSIONS), where('name', '==', null))));
    });

    it('cannot create, name or delete a Version — not even as themselves', async () => {
      await seedHistory();
      await assertFails(setDoc(doc(bob(), `${VERSIONS}/x`), newVersion(BOB, BOB_EMAIL)));
      await assertFails(updateDoc(doc(bob(), EXISTING), { name: 'Hijacked' }));
      await assertFails(deleteDoc(doc(bob(), EXISTING)));
      await assertFails(deleteDoc(doc(bob(), NAMED)));
    });
  });

  describe('Access list', () => {
    it('an owner off the Access list cannot read, write, name or delete their own Versions', async () => {
      await seedHistory({ 'config/access': { domains: ['company.com'], emails: [] } });
      const offList = env().authenticatedContext(ALICE, token('alice@gmail.com')).firestore();
      await assertFails(getDoc(doc(offList, EXISTING)));
      await assertFails(getDocs(collection(offList, VERSIONS)));
      await assertFails(setDoc(doc(offList, `${VERSIONS}/x`), newVersion(ALICE, 'alice@gmail.com')));
      await assertFails(updateDoc(doc(offList, EXISTING), { name: 'Named' }));
      await assertFails(deleteDoc(doc(offList, EXISTING)));
    });

    it('an owner on the list but unverified is refused too, and allowed once verified', async () => {
      await seedHistory({ 'config/access': { domains: ['company.com'], emails: [] } });
      const unverified = env().authenticatedContext(ALICE, token(ALICE_EMAIL, false)).firestore();
      await assertFails(getDoc(doc(unverified, EXISTING)));
      await assertFails(setDoc(doc(unverified, `${VERSIONS}/x`), newVersion()));
      await assertSucceeds(getDoc(doc(alice(), EXISTING)));
      await assertSucceeds(setDoc(doc(alice(), `${VERSIONS}/x`), newVersion()));
    });
  });

  describe('unauthenticated', () => {
    it('is denied everything', async () => {
      await seedHistory();
      const db = env().unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, EXISTING)));
      await assertFails(getDocs(collection(db, VERSIONS)));
      await assertFails(setDoc(doc(db, `${VERSIONS}/x`), newVersion()));
      await assertFails(updateDoc(doc(db, EXISTING), { name: 'Named' }));
      await assertFails(deleteDoc(doc(db, EXISTING)));
    });
  });

  describe('administrator', () => {
    it('can read any Diagram\'s history but not write it', async () => {
      await seedHistory();
      const db = env().authenticatedContext(ADMIN, token('boss@company.com')).firestore();
      await assertSucceeds(getDoc(doc(db, EXISTING)));
      await assertSucceeds(getDocs(collection(db, VERSIONS)));
      await assertFails(setDoc(doc(db, `${VERSIONS}/x`), newVersion(ADMIN, 'boss@company.com')));
      await assertFails(updateDoc(doc(db, EXISTING), { name: 'Admin' }));
      await assertFails(deleteDoc(doc(db, EXISTING)));
    });
  });
});
