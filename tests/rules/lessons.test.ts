import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const LESSON = `users/${ALICE}/lessons/lesson-1`;
const LESSONS = `users/${ALICE}/lessons`;
const lesson = { name: 'Lesson', document: { nodes: [], edges: [] }, public: false };

describe('users/{uid}/lessons/{id}', () => {
  const env = useRulesTestEnvironment();

  describe('owner', () => {
    it('can create, get, list, update and delete their own lesson', async () => {
      const db = env().authenticatedContext(ALICE).firestore();
      await assertSucceeds(setDoc(doc(db, LESSON), lesson));
      await assertSucceeds(getDoc(doc(db, LESSON)));
      await assertSucceeds(getDocs(collection(db, LESSONS)));
      await assertSucceeds(updateDoc(doc(db, LESSON), { name: 'Renamed' }));
      await assertSucceeds(deleteDoc(doc(db, LESSON)));
    });
  });

  describe('another user', () => {
    it('cannot get, list or write a lesson of someone else', async () => {
      await seed(env(), { [LESSON]: lesson });
      const db = env().authenticatedContext(BOB).firestore();
      await assertFails(getDoc(doc(db, LESSON)));
      await assertFails(getDocs(collection(db, LESSONS)));
      await assertFails(setDoc(doc(db, `${LESSONS}/new`), lesson));
      await assertFails(updateDoc(doc(db, LESSON), { name: 'Hijacked' }));
      await assertFails(deleteDoc(doc(db, LESSON)));
    });
  });

  describe('administrator', () => {
    it('can get a lesson but not update it', async () => {
      await seed(env(), { [LESSON]: lesson });
      const db = env().authenticatedContext(ADMIN).firestore();
      await assertSucceeds(getDoc(doc(db, LESSON)));
      await assertFails(updateDoc(doc(db, LESSON), { name: 'Edited' }));
    });
  });

  describe('unauthenticated', () => {
    it('cannot get a lesson', async () => {
      await seed(env(), { [LESSON]: lesson });
      await assertFails(getDoc(doc(env().unauthenticatedContext().firestore(), LESSON)));
    });
  });

  describe('Access list', () => {
    it('blocks an owner who is not admitted', async () => {
      await seed(env(), {
        'config/access': { domains: ['company.com'], emails: [] },
        [LESSON]: lesson,
      });
      const db = env()
        .authenticatedContext(ALICE, { email: 'alice@other.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } })
        .firestore();
      await assertFails(getDoc(doc(db, LESSON)));
    });
  });
});
