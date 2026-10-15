import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, seed, useRulesTestEnvironment } from './setup';

const TEMPLATE = 'templates/erd';
const template = { name: 'ERD', document: { nodes: [], edges: [] } };

describe('templates/{id}', () => {
  const env = useRulesTestEnvironment();

  it('can be read and listed by any signed-in user', async () => {
    await seed(env(), { [TEMPLATE]: template });
    const db = env().authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, TEMPLATE)));
    await assertSucceeds(getDocs(collection(db, 'templates')));
  });

  it('cannot be read unauthenticated', async () => {
    await seed(env(), { [TEMPLATE]: template });
    const db = env().unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, TEMPLATE)));
    await assertFails(getDocs(collection(db, 'templates')));
  });

  it('can be created, updated and deleted by an administrator', async () => {
    const db = env().authenticatedContext(ADMIN).firestore();
    await assertSucceeds(setDoc(doc(db, TEMPLATE), template));
    await assertSucceeds(updateDoc(doc(db, TEMPLATE), { name: 'ERD v2' }));
    await assertSucceeds(deleteDoc(doc(db, TEMPLATE)));
  });

  it('cannot be written by a signed-in non-administrator', async () => {
    await seed(env(), { [TEMPLATE]: template });
    const db = env().authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'templates/new'), template));
    await assertFails(updateDoc(doc(db, TEMPLATE), { name: 'Hijacked' }));
    await assertFails(deleteDoc(doc(db, TEMPLATE)));
  });

  it('cannot be written unauthenticated', async () => {
    const db = env().unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'templates/new'), template));
  });
});
