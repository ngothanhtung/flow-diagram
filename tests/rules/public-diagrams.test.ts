import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const ID = 'diagram-1';
const SOURCE = `users/${ALICE}/diagrams/${ID}`;
const MIRROR = `public-diagrams/${ID}`;

const source = { name: 'Flow', document: { nodes: [], edges: [] }, public: true };
const mirror = (overrides: Record<string, unknown> = {}) => ({
  ownerUid: ALICE,
  name: 'Flow',
  document: { nodes: [], edges: [] },
  public: true,
  ...overrides,
});

describe('public-diagrams/{id}', () => {
  const env = useRulesTestEnvironment();

  describe('read', () => {
    it('is open to unauthenticated clients', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertSucceeds(getDoc(doc(env().unauthenticatedContext().firestore(), MIRROR)));
    });

    it('is open to any signed-in user', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertSucceeds(getDoc(doc(env().authenticatedContext(BOB).firestore(), MIRROR)));
    });
  });

  describe('create', () => {
    it('succeeds for the owner of an existing source diagram', async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertSucceeds(setDoc(doc(db, MIRROR), mirror()));
    });

    it('fails when the source diagram does not exist under the caller\'s uid', async () => {
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror()));
    });

    it('fails when ownerUid is not the caller', async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror({ ownerUid: BOB })));
    });

    it('fails unless the mirror claims public: true', async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror({ public: false })));
    });

    it('fails for a non-owner claiming the owner\'s uid', async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror()));
    });

    it('fails for a non-owner claiming their own uid over someone else\'s diagram id', async () => {
      await seed(env(), { [SOURCE]: source });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(setDoc(doc(db, MIRROR), mirror({ ownerUid: BOB })));
    });

    it('fails unauthenticated', async () => {
      await seed(env(), { [SOURCE]: source });
      await assertFails(setDoc(doc(env().unauthenticatedContext().firestore(), MIRROR), mirror()));
    });
  });

  describe('update', () => {
    it('succeeds for the owner while the source exists and the mirror stays public', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertSucceeds(setDoc(doc(db, MIRROR), { name: 'Renamed' }, { merge: true }));
    });

    it('fails when the update would flip public off', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), { public: false }, { merge: true }));
    });

    it('fails when the source diagram is gone', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), { name: 'Renamed' }, { merge: true }));
    });

    it('fails when the owner tries to hand the mirror to someone else', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertFails(setDoc(doc(db, MIRROR), { ownerUid: BOB }, { merge: true }));
    });

    it('fails for a non-owner', async () => {
      await seed(env(), { [SOURCE]: source, [MIRROR]: mirror() });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(setDoc(doc(db, MIRROR), { name: 'Hijacked' }, { merge: true }));
    });
  });

  describe('delete', () => {
    it('succeeds for the owner', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertSucceeds(deleteDoc(doc(env().authenticatedContext(ALICE).firestore(), MIRROR)));
    });

    it('fails for a non-owner', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(deleteDoc(doc(env().authenticatedContext(BOB).firestore(), MIRROR)));
    });

    it('fails unauthenticated', async () => {
      await seed(env(), { [MIRROR]: mirror() });
      await assertFails(deleteDoc(doc(env().unauthenticatedContext().firestore(), MIRROR)));
    });
  });
});
