import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

// The Diagram tree: the same folders as the Lesson tree, owner only, no public copy.
const TREE = `users/${ALICE}/diagram-trees/main`;
const tree = { format: 'x-flow-lesson-tree', version: 1, folders: {}, lessons: {} };
const OFF_LIST = { email: 'alice@other.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } } as const;
const ACCESS_LIST = { domains: ['company.com'], emails: [] };

describe('users/{uid}/diagram-trees/{treeId}', () => {
  const env = useRulesTestEnvironment();

  it('lets the owner create, read and delete their main tree', async () => {
    const db = env().authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, TREE), tree));
    await assertSucceeds(getDoc(doc(db, TREE)));
    await assertSucceeds(deleteDoc(doc(db, TREE)));
  });

  it('refuses any tree id but main', async () => {
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), `users/${ALICE}/diagram-trees/other`), tree));
  });

  it('refuses another user and a signed-out client', async () => {
    await seed(env(), { [TREE]: tree });
    await assertFails(getDoc(doc(env().authenticatedContext(BOB).firestore(), TREE)));
    await assertFails(setDoc(doc(env().authenticatedContext(BOB).firestore(), TREE), tree));
    await assertFails(getDoc(doc(env().unauthenticatedContext().firestore(), TREE)));
  });

  it('lets an administrator read but not write', async () => {
    await seed(env(), { [TREE]: tree });
    await assertSucceeds(getDoc(doc(env().authenticatedContext(ADMIN).firestore(), TREE)));
    await assertFails(setDoc(doc(env().authenticatedContext(ADMIN).firestore(), TREE), tree));
  });

  it('refuses the owner when they are off a configured Access list', async () => {
    await seed(env(), { 'config/access': ACCESS_LIST });
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE, OFF_LIST).firestore(), TREE), tree));
  });
});
