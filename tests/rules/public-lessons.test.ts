import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const ID = 'lesson-1';
const SOURCE = `users/${ALICE}/lessons/${ID}`;
const MIRROR = `public-lessons/${ID}`;

const source = { name: 'Lesson', document: { nodes: [], edges: [] }, public: true };
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

    it('succeeds when there is no mirror to delete', async () => {
      await assertSucceeds(deleteDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR)));
    });
  });
});
