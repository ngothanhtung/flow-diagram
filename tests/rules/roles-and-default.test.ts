import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

describe('users-roles/{uid}', () => {
  const env = useRulesTestEnvironment();

  it('a user can read their own role doc', async () => {
    await seed(env(), { [`users-roles/${ALICE}`]: { roles: [] } });
    await assertSucceeds(getDoc(doc(env().authenticatedContext(ALICE).firestore(), `users-roles/${ALICE}`)));
    await assertSucceeds(getDoc(doc(env().authenticatedContext(ADMIN).firestore(), `users-roles/${ADMIN}`)));
  });

  it('a user cannot read someone else\'s role doc — administrators included', async () => {
    await seed(env(), { [`users-roles/${ALICE}`]: { roles: [] } });
    await assertFails(getDoc(doc(env().authenticatedContext(BOB).firestore(), `users-roles/${ALICE}`)));
    await assertFails(getDoc(doc(env().authenticatedContext(ADMIN).firestore(), `users-roles/${ALICE}`)));
  });

  it('cannot be listed', async () => {
    await assertFails(getDocs(collection(env().authenticatedContext(ADMIN).firestore(), 'users-roles')));
  });

  it('cannot be read unauthenticated', async () => {
    await assertFails(getDoc(doc(env().unauthenticatedContext().firestore(), `users-roles/${ADMIN}`)));
  });

  it('nobody can write a role doc from the client — not even to promote themselves', async () => {
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), `users-roles/${ALICE}`), { roles: ['administrators'] }));
    await assertFails(setDoc(doc(env().authenticatedContext(ADMIN).firestore(), `users-roles/${ALICE}`), { roles: ['administrators'] }));
    await assertFails(deleteDoc(doc(env().authenticatedContext(ADMIN).firestore(), `users-roles/${ADMIN}`)));
  });
});

describe('default deny', () => {
  const env = useRulesTestEnvironment();

  it('denies reads and writes on an unknown collection, even for an administrator', async () => {
    await seed(env(), { 'unknown/doc-1': { value: 1 } });
    for (const db of [
      env().unauthenticatedContext().firestore(),
      env().authenticatedContext(ALICE).firestore(),
      env().authenticatedContext(ADMIN).firestore(),
    ]) {
      await assertFails(getDoc(doc(db, 'unknown/doc-1')));
      await assertFails(setDoc(doc(db, 'unknown/doc-2'), { value: 2 }));
    }
  });

  it('denies a top-level users/{uid} doc, even to its owner', async () => {
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), `users/${ALICE}`), { name: 'Alice' }));
  });
});
