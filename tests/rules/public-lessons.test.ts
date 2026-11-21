import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const ID = 'lesson-1';
const SOURCE = `users/${ALICE}/lessons/${ID}`;
const MIRROR = `public-lessons/${ID}`;

const source = { name: 'Lesson', document: { nodes: [], edges: [] }, public: true };
// Signed in, verified, but off a configured Access list.
const OFF_LIST = { email: 'alice@other.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } } as const;
const ACCESS_LIST = { domains: ['company.com'], emails: [] };

const mirror = (overrides: Record<string, unknown> = {}) => ({
  ownerUid: ALICE,
  name: 'Lesson',
  document: { nodes: [], edges: [] },
  public: true,
  ...overrides,
});

describe('public-lessons/{id}', () => {
  const env = useRulesTestEnvironment();

  describe('read', () => {
    it('lets an unauthenticated client get one', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertSucceeds(getDoc(doc(env().unauthenticatedContext().firestore(), MIRROR)));
    });

    it('lets nobody list the collection', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(getDocs(collection(env().unauthenticatedContext().firestore(), 'public-lessons')));
      await assertFails(getDocs(collection(env().authenticatedContext(ALICE).firestore(), 'public-lessons')));
      await assertFails(getDocs(collection(env().authenticatedContext(ADMIN).firestore(), 'public-lessons')));
    });

    it('lets a signed-in user off the Access list get one', async () => {
      await seed(env(), { 'config/access': ACCESS_LIST, [MIRROR]: mirror() });
      await assertSucceeds(getDoc(doc(env().authenticatedContext(BOB, OFF_LIST).firestore(), MIRROR)));
    });
  });

  describe('create', () => {
    it('succeeds for the owner of an existing source lesson', async () => {
      await seed(env(), { [SOURCE]: source });
      await assertSucceeds(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), mirror()));
    });

    it('fails when there is no source lesson', async () => {
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), mirror()));
    });

    it('fails when ownerUid is not the caller', async () => {
      await seed(env(), { [SOURCE]: source });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), mirror({ ownerUid: BOB })));
    });

    it('fails when public is false', async () => {
      await seed(env(), { [SOURCE]: source });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), mirror({ public: false })));
    });

    it('fails for an owner who is off the Access list', async () => {
      await seed(env(), { 'config/access': ACCESS_LIST, [SOURCE]: source });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE, OFF_LIST).firestore(), MIRROR), mirror()));
    });

    it("fails for an administrator mirroring another user's lesson", async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(ADMIN).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror()));
      await assertFails(setDoc(doc(db, MIRROR), mirror({ ownerUid: ADMIN })));
    });
  });

  describe('update', () => {
    it('succeeds for the owner while the source exists', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      await assertSucceeds(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), { name: 'Renamed' }, { merge: true }));
    });

    it('fails for another user', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      await assertFails(setDoc(doc(env().authenticatedContext(BOB).firestore(), MIRROR), { name: 'Hijacked' }, { merge: true }));
    });

    it('fails when the source lesson no longer exists', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), { name: 'Renamed' }, { merge: true }));
    });

    it('fails when it changes ownerUid', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), { ownerUid: BOB }, { merge: true }));
    });

    it('fails when it sets public to false', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR), { public: false }, { merge: true }));
    });

    it('fails for an administrator', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      await assertFails(setDoc(doc(env().authenticatedContext(ADMIN).firestore(), MIRROR), { name: 'Edited' }, { merge: true }));
    });
  });

  describe('delete', () => {
    it('succeeds for the owner', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertSucceeds(deleteDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR)));
    });

    it('fails for another user', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(deleteDoc(doc(env().authenticatedContext(BOB).firestore(), MIRROR)));
    });

    it('fails for an administrator', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(deleteDoc(doc(env().authenticatedContext(ADMIN).firestore(), MIRROR)));
    });

    it('succeeds when there is no mirror to delete', async () => {
      await assertSucceeds(deleteDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR)));
    });
  });
});
