import { assertFails, assertSucceeds, type TokenOptions } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ACCESS_CASES } from '@/lib/access-list.cases';
import { ADMIN, seed, useRulesTestEnvironment } from './setup';

// PRD v0.2 §4.5. The case table is shared with src/lib/access-list.test.ts,
// so the client's `accessDecision` and these rules answer the same question
// the same way; the describe blocks below walk the acceptance criteria.

const CONFIG = 'config/access';
const COMPANY = { domains: ['company.com'], emails: [] };

type Provider = 'google.com' | 'password';

function token(email: string | null, emailVerified: boolean, provider: Provider): TokenOptions {
  return {
    ...(email === null ? {} : { email }),
    email_verified: emailVerified,
    firebase: { sign_in_provider: provider },
  };
}

const diagram = (isPublic = false) => ({ name: 'Flow', document: { nodes: [], edges: [] }, public: isPublic });
const template = { name: 'ERD', document: { nodes: [], edges: [] } };
const mirror = (ownerUid: string) => ({ ownerUid, name: 'Flow', document: { nodes: [], edges: [] }, public: true });

describe('Access list', () => {
  const env = useRulesTestEnvironment();

  const as = (uid: string, email: string | null, emailVerified: boolean, provider: Provider) =>
    env().authenticatedContext(uid, token(email, emailVerified, provider)).firestore();

  /** Everything a signed-in user does with their own data, all expected to pass or all to fail. */
  async function expectUserData(uid: string, db: ReturnType<typeof as>, allowed: boolean) {
    const check = allowed ? assertSucceeds : assertFails;
    await check(getDoc(doc(db, `users/${uid}/diagrams/existing`)));
    await check(getDocs(collection(db, `users/${uid}/diagrams`)));
    await check(setDoc(doc(db, `users/${uid}/diagrams/new`), diagram()));
    await check(updateDoc(doc(db, `users/${uid}/diagrams/existing`), { name: 'Renamed' }));
    await check(getDoc(doc(db, 'templates/erd')));
    await check(getDocs(collection(db, 'templates')));
    await check(deleteDoc(doc(db, `users/${uid}/diagrams/existing`)));
  }

  async function seedUser(uid: string, config: Record<string, unknown> | undefined, extra: Record<string, Record<string, unknown>> = {}) {
    await seed(env(), {
      ...(config ? { [CONFIG]: config } : {}),
      [`users/${uid}/diagrams/existing`]: diagram(),
      'templates/erd': template,
      ...extra,
    });
  }

  describe('shared case table (src/lib/access-list.cases.ts)', () => {
    it.each(ACCESS_CASES)('$name → $expected', async ({ config, email, emailVerified, provider, isAdmin, expected }) => {
      const uid = 'case-user';
      await seedUser(uid, config, isAdmin ? { [`users-roles/${uid}`]: { roles: ['administrators'] } } : {});
      // The rules only know allowed / denied; needs-verification is a denial.
      await expectUserData(uid, as(uid, email, emailVerified, provider), expected === 'allowed');
    });
  });

  describe('§4.5 acceptance criteria', () => {
    it('empty list: any email, verified or not, uses the app as before', async () => {
      await seedUser('x', { domains: [], emails: [] });
      await expectUserData('x', as('x', 'x@anything.io', false, 'password'), true);
    });

    it('missing config doc: same as empty', async () => {
      await seedUser('x', undefined);
      await expectUserData('x', as('x', 'x@anything.io', false, 'password'), true);
    });

    it('list {company.com}: a@company.com (Google) is allowed', async () => {
      await seedUser('a', COMPANY);
      await expectUserData('a', as('a', 'a@company.com', true, 'google.com'), true);
    });

    it('list {company.com}: b@gmail.com is refused with Google and with Email/Password', async () => {
      await seedUser('b', COMPANY);
      await expectUserData('b', as('b', 'b@gmail.com', true, 'google.com'), false);
      await expectUserData('b', as('b', 'b@gmail.com', true, 'password'), false);
    });

    it('b@gmail.com added as an exception email is allowed', async () => {
      await seedUser('b', { domains: ['company.com'], emails: ['b@gmail.com'] });
      await expectUserData('b', as('b', 'b@gmail.com', true, 'google.com'), true);
    });

    it('an off-list account calling Firestore directly cannot read or write anyone\'s diagrams or templates', async () => {
      await seedUser('b', COMPANY, {
        'users/alice/diagrams/pub': diagram(true),
        'users/b/diagrams/mine-public': diagram(true),
        'public-diagrams/mine-public': mirror('b'),
      });
      const db = as('b', 'b@gmail.com', true, 'google.com');
      await expectUserData('b', db, false);
      // Someone else's public diagram at its source path (the Viewer uses the mirror instead).
      await assertFails(getDoc(doc(db, 'users/alice/diagrams/pub')));
      // Writing a public mirror is writing user data.
      await assertFails(setDoc(doc(db, 'public-diagrams/existing'), mirror('b')));
      await assertFails(setDoc(doc(db, 'public-diagrams/mine-public'), { name: 'Renamed' }, { merge: true }));
      await assertFails(deleteDoc(doc(db, 'public-diagrams/mine-public')));
      await assertFails(deleteDoc(doc(db, 'public-diagrams/no-such-mirror')));
      // Template writes stay administrator-only.
      await assertFails(setDoc(doc(db, 'templates/new'), template));
    });

    it('the same account on the list can still write its public mirror', async () => {
      await seedUser('a', COMPANY);
      const db = as('a', 'a@company.com', true, 'google.com');
      await assertSucceeds(setDoc(doc(db, 'public-diagrams/existing'), mirror('a')));
      await assertSucceeds(setDoc(doc(db, 'public-diagrams/existing'), { name: 'Renamed' }, { merge: true }));
      await assertSucceeds(deleteDoc(doc(db, 'public-diagrams/existing')));
    });

    it('an administrator off the list, unverified, keeps the editor and the admin pages', async () => {
      await seedUser(ADMIN, COMPANY, { 'users/alice/diagrams/private': diagram(false) });
      const db = as(ADMIN, 'boss@gmail.com', false, 'password');
      // Editor + Diagrams list.
      await expectUserData(ADMIN, db, true);
      // /admin/diagrams (collection group) and opening anyone's diagram.
      await assertSucceeds(getDocs(collectionGroup(db, 'diagrams')));
      await assertSucceeds(getDoc(doc(db, 'users/alice/diagrams/private')));
      // /admin/templates.
      await assertSucceeds(setDoc(doc(db, 'templates/new'), template));
      await assertSucceeds(updateDoc(doc(db, 'templates/new'), { name: 'ERD v2' }));
      await assertSucceeds(deleteDoc(doc(db, 'templates/new')));
    });

    it('a Public diagram whose Owner is off the list still opens from its Public link', async () => {
      await seed(env(), {
        [CONFIG]: COMPANY,
        'users/b/diagrams/pub': diagram(true),
        'public-diagrams/pub': mirror('b'),
      });
      await assertSucceeds(getDoc(doc(env().unauthenticatedContext().firestore(), 'public-diagrams/pub')));
      await assertSucceeds(getDoc(doc(as('b', 'b@gmail.com', true, 'google.com'), 'public-diagrams/pub')));
      await assertSucceeds(getDoc(doc(as('a', 'a@company.com', true, 'google.com'), 'public-diagrams/pub')));
    });

    it('list {company.com}: an unverified password account x@company.com has no data access until it verifies', async () => {
      await seedUser('x', COMPANY);
      await expectUserData('x', as('x', 'x@company.com', false, 'password'), false);
      // Same uid after clicking the link: the refreshed token carries email_verified.
      await seedUser('x', COMPANY);
      await expectUserData('x', as('x', 'x@company.com', true, 'password'), true);
    });

    it('empty list: an unverified password account works immediately', async () => {
      await seedUser('x', { domains: [], emails: [] });
      await expectUserData('x', as('x', 'x@company.com', false, 'password'), true);
    });

    it('takes effect without a new sign-in: editing the list changes the answer for the same token', async () => {
      await seedUser('b', { domains: [], emails: [] });
      const db = as('b', 'b@gmail.com', true, 'google.com');
      await assertSucceeds(getDoc(doc(db, 'users/b/diagrams/existing')));
      await seed(env(), { [CONFIG]: COMPANY });
      await assertFails(getDoc(doc(db, 'users/b/diagrams/existing')));
    });
  });

  describe('config/access', () => {
    it('is readable by any signed-in user, on the list or not', async () => {
      await seed(env(), { [CONFIG]: COMPANY });
      await assertSucceeds(getDoc(doc(as('a', 'a@company.com', true, 'google.com'), CONFIG)));
      await assertSucceeds(getDoc(doc(as('b', 'b@gmail.com', false, 'password'), CONFIG)));
    });

    it('reading a missing config doc is allowed too (the client treats it as open)', async () => {
      await assertSucceeds(getDoc(doc(as('b', 'b@gmail.com', false, 'password'), CONFIG)));
    });

    it('is not readable unauthenticated', async () => {
      await seed(env(), { [CONFIG]: COMPANY });
      await assertFails(getDoc(doc(env().unauthenticatedContext().firestore(), CONFIG)));
    });

    it('cannot be listed, or written by anyone from the client — administrators included', async () => {
      await seed(env(), { [CONFIG]: COMPANY });
      const admin = as(ADMIN, 'boss@company.com', true, 'google.com');
      const user = as('b', 'b@gmail.com', true, 'google.com');
      await assertFails(getDocs(collection(admin, 'config')));
      for (const db of [admin, user]) {
        await assertFails(setDoc(doc(db, CONFIG), { domains: [], emails: [] }));
        await assertFails(updateDoc(doc(db, CONFIG), { emails: ['b@gmail.com'] }));
        await assertFails(deleteDoc(doc(db, CONFIG)));
        await assertFails(setDoc(doc(db, 'config/other'), { value: 1 }));
      }
    });
  });

  describe('users-roles self-read', () => {
    it('still works for a user off the list (the client needs it to spot administrators)', async () => {
      await seed(env(), { [CONFIG]: COMPANY, 'users-roles/b': { roles: [] } });
      await assertSucceeds(getDoc(doc(as('b', 'b@gmail.com', false, 'password'), 'users-roles/b')));
      await assertSucceeds(getDoc(doc(as(ADMIN, 'boss@gmail.com', false, 'password'), `users-roles/${ADMIN}`)));
    });
  });
});
