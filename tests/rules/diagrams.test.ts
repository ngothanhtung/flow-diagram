import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const PRIVATE = `users/${ALICE}/diagrams/private-1`;
const PUBLIC = `users/${ALICE}/diagrams/public-1`;

const diagram = (isPublic: boolean) => ({ name: 'Flow', document: { nodes: [], edges: [] }, public: isPublic });

describe('users/{uid}/diagrams/{id}', () => {
  const env = useRulesTestEnvironment();

  describe('owner', () => {
    it('can create, read, update and delete their own diagram', async () => {
      const db = env().authenticatedContext(ALICE).firestore();
      const ref = doc(db, PRIVATE);
      await assertSucceeds(setDoc(ref, diagram(false)));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(updateDoc(ref, { name: 'Renamed' }));
      await assertSucceeds(deleteDoc(ref));
    });

    it('can list their own diagrams', async () => {
      await seed(env(), { [PRIVATE]: diagram(false), [PUBLIC]: diagram(true) });
      const db = env().authenticatedContext(ALICE).firestore();
      await assertSucceeds(getDocs(collection(db, `users/${ALICE}/diagrams`)));
    });
  });

  describe('another signed-in user', () => {
    it('cannot read a private diagram', async () => {
      await seed(env(), { [PRIVATE]: diagram(false) });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(getDoc(doc(db, PRIVATE)));
    });

    it('treats a diagram with no public field as private', async () => {
      await seed(env(), { [PRIVATE]: { name: 'Legacy', document: { nodes: [], edges: [] } } });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(getDoc(doc(db, PRIVATE)));
    });

    it('can read a public diagram', async () => {
      await seed(env(), { [PUBLIC]: diagram(true) });
      const db = env().authenticatedContext(BOB).firestore();
      await assertSucceeds(getDoc(doc(db, PUBLIC)));
    });

    it('cannot create, update or delete under someone else\'s uid — public or not', async () => {
      await seed(env(), { [PRIVATE]: diagram(false), [PUBLIC]: diagram(true) });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(setDoc(doc(db, `users/${ALICE}/diagrams/new-1`), diagram(false)));
      await assertFails(updateDoc(doc(db, PRIVATE), { name: 'Hijacked' }));
      await assertFails(updateDoc(doc(db, PUBLIC), { name: 'Hijacked' }));
      await assertFails(deleteDoc(doc(db, PUBLIC)));
    });

    it('cannot list someone else\'s diagrams', async () => {
      await seed(env(), { [PRIVATE]: diagram(false) });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(getDocs(collection(db, `users/${ALICE}/diagrams`)));
    });
  });

  describe('unauthenticated', () => {
    it('cannot read a private diagram', async () => {
      await seed(env(), { [PRIVATE]: diagram(false) });
      const db = env().unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, PRIVATE)));
    });

    it('cannot read a public diagram at its source path either (the viewer reads the mirror)', async () => {
      await seed(env(), { [PUBLIC]: diagram(true) });
      const db = env().unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, PUBLIC)));
    });

    it('cannot write', async () => {
      const db = env().unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, PRIVATE), diagram(false)));
    });
  });

  describe('administrator', () => {
    it('can get any user\'s private diagram', async () => {
      await seed(env(), { [PRIVATE]: diagram(false) });
      const db = env().authenticatedContext(ADMIN).firestore();
      await assertSucceeds(getDoc(doc(db, PRIVATE)));
    });

    it('can list every user\'s diagrams through the collection group', async () => {
      await seed(env(), { [PRIVATE]: diagram(false), [`users/${BOB}/diagrams/b-1`]: diagram(false) });
      const db = env().authenticatedContext(ADMIN).firestore();
      await assertSucceeds(getDocs(collectionGroup(db, 'diagrams')));
    });

    it('still cannot write another user\'s diagram', async () => {
      await seed(env(), { [PRIVATE]: diagram(false) });
      const db = env().authenticatedContext(ADMIN).firestore();
      await assertFails(updateDoc(doc(db, PRIVATE), { name: 'Edited by admin' }));
    });
  });

  describe('collection group', () => {
    it('is denied to a signed-in non-administrator', async () => {
      await seed(env(), { [PUBLIC]: diagram(true) });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(getDocs(collectionGroup(db, 'diagrams')));
    });

    it('is denied to an unauthenticated client', async () => {
      const db = env().unauthenticatedContext().firestore();
      await assertFails(getDocs(collectionGroup(db, 'diagrams')));
    });
  });
});
