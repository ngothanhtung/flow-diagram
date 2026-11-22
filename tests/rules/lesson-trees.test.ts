import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

const TREE = `users/${ALICE}/lesson-trees/main`;
const PUBLIC = `public-lesson-trees/${ALICE}`;
const tree = { format: 'x-flow-lesson-tree', version: 1, folders: {}, lessons: {} };
const publicTree = (ownerUid = ALICE) => ({ ownerUid, folders: [], lessons: [] });
// Signed in, verified, but off a configured Access list.
const OFF_LIST = { email: 'alice@other.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } } as const;
const ACCESS_LIST = { domains: ['company.com'], emails: [] };

describe('users/{uid}/lesson-trees/{treeId}', () => {
  const env = useRulesTestEnvironment();

  it('lets the owner create, read and delete their main tree', async () => {
    const db = env().authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, TREE), tree));
    await assertSucceeds(getDoc(doc(db, TREE)));
    await assertSucceeds(deleteDoc(doc(db, TREE)));
  });

  it('refuses any tree id but main', async () => {
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), `users/${ALICE}/lesson-trees/other`), tree));
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

describe('public-lesson-trees/{ownerUid}', () => {
  const env = useRulesTestEnvironment();

  it('lets a signed-out client get one', async () => {
    await seed(env(), { [PUBLIC]: publicTree() });
    await assertSucceeds(getDoc(doc(env().unauthenticatedContext().firestore(), PUBLIC)));
  });

  it('lets nobody list the collection', async () => {
    await seed(env(), { [PUBLIC]: publicTree() });
    await assertFails(getDocs(collection(env().unauthenticatedContext().firestore(), 'public-lesson-trees')));
    await assertFails(getDocs(collection(env().authenticatedContext(ALICE).firestore(), 'public-lesson-trees')));
    await assertFails(getDocs(collection(env().authenticatedContext(ADMIN).firestore(), 'public-lesson-trees')));
  });

  it('lets the owner write it under their own uid', async () => {
    const db = env().authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, PUBLIC), publicTree()));
    await assertSucceeds(setDoc(doc(db, PUBLIC), publicTree()));
    await assertSucceeds(deleteDoc(doc(db, PUBLIC)));
  });

  it('refuses an ownerUid that is not the caller', async () => {
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE).firestore(), PUBLIC), publicTree(BOB)));
  });

  it("refuses writing or deleting someone else's", async () => {
    await seed(env(), { [PUBLIC]: publicTree() });
    const bob = env().authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(bob, PUBLIC), publicTree(BOB)));
    await assertFails(deleteDoc(doc(bob, PUBLIC)));
  });

  it('refuses the owner when they are off a configured Access list', async () => {
    await seed(env(), { 'config/access': ACCESS_LIST });
    await assertFails(setDoc(doc(env().authenticatedContext(ALICE, OFF_LIST).firestore(), PUBLIC), publicTree()));
  });
});
