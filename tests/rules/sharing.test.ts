import { assertFails, assertSucceeds, type RulesTestContext, type TokenOptions } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  FieldPath,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, seed, useRulesTestEnvironment } from './setup';

// PRD v0.3 §4.2 — Share for Collaborators (ADR 0001). Diagrams stay at
// users/{owner}/diagrams/{id}; diagram-access/{owner}_{id} lists who else
// may open them. Covers the whole Access level table plus every
// acceptance criterion that "calling Firestore directly" can check.

const CAROL = 'carol';
const DAVE = 'dave';
const ALICE_EMAIL = 'alice@company.com';
const BOB_EMAIL = 'bob@company.com';
const CAROL_EMAIL = 'carol@company.com';
const DAVE_EMAIL = 'dave@company.com';

const ID = 'd1';
const DIAGRAM = `users/${ALICE}/diagrams/${ID}`;
const VERSIONS = `${DIAGRAM}/versions`;
const UNNAMED = `${VERSIONS}/v-unnamed`;
const NAMED = `${VERSIONS}/v-named`;
const ACCESS = `diagram-access/${ALICE}_${ID}`;
const MIRROR = `public-diagrams/${ID}`;

const flow = { nodes: [], edges: [] };
const edited = { nodes: [{ id: 'n1', title: 'Edited', position: { x: 0, y: 0 } }], edges: [] };
const token = (email: string, emailVerified = true): TokenOptions => ({ email, email_verified: emailVerified });
const actor = (uid: string, email: string | null, displayName: string | null = null) => ({ uid, email, displayName });

const storedDiagram = (overrides: Record<string, unknown> = {}) => ({
  name: 'Architecture',
  document: flow,
  public: false,
  createdAt: Timestamp.fromMillis(1_000),
  updatedAt: Timestamp.fromMillis(2_000),
  lastSavedBy: actor(ALICE, ALICE_EMAIL, 'Alice'),
  revision: 3,
  ...overrides,
});

const storedVersion = (name: string | null) => ({ document: flow, savedAt: Timestamp.fromMillis(1_000), savedBy: actor(ALICE, ALICE_EMAIL, 'Alice'), name });

/** The index as the Owner's client writes it. */
const accessIndex = (collaborators: Record<string, string> = { [BOB_EMAIL]: 'edit', [CAROL_EMAIL]: 'view' }, overrides: Record<string, unknown> = {}) => ({
  ownerUid: ALICE,
  ownerEmail: ALICE_EMAIL,
  diagramId: ID,
  collaborators,
  collaboratorEmails: Object.keys(collaborators).sort(),
  openedBy: {},
  updatedAt: serverTimestamp(),
  ...overrides,
});

/** Same, as a stored fixture (no sentinels). */
const storedIndex = (collaborators?: Record<string, string>, overrides: Record<string, unknown> = {}) => ({ ...accessIndex(collaborators, overrides), updatedAt: Timestamp.fromMillis(1_000) });

/** The fields a Save writes to the Diagram, from revision `from`. */
const saveFields = (uid: string, email: string, from = 3, extra: Record<string, unknown> = {}) => ({
  name: 'Architecture',
  document: edited,
  updatedAt: serverTimestamp(),
  lastSavedBy: actor(uid, email, null),
  revision: from + 1,
  ...extra,
});

const newVersion = (uid: string, email: string) => ({ document: edited, savedAt: serverTimestamp(), savedBy: actor(uid, email, null), name: null });

/** The test context's (compat-typed) Firestore, as the modular API's type. */
type TestDb = ReturnType<RulesTestContext['firestore']>;
const modular = (db: TestDb) => db as unknown as Firestore;

/** A Save as the client runs it: read, compare, write Diagram + Version. */
function transactionalSave(testDb: TestDb, uid: string, email: string, from = 3, extra: Record<string, unknown> = {}) {
  const db = modular(testDb);
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, DIAGRAM);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('missing');
    transaction.update(ref, saveFields(uid, email, from, extra));
    transaction.set(doc(collection(db, VERSIONS)), newVersion(uid, email));
  });
}

describe('Share — diagram-access + Collaborator branches', () => {
  const env = useRulesTestEnvironment();

  const as = (uid: string, email: string, verified = true) => env().authenticatedContext(uid, token(email, verified)).firestore();
  const alice = () => as(ALICE, ALICE_EMAIL);
  const bob = () => as(BOB, BOB_EMAIL); // Can edit
  const carol = () => as(CAROL, CAROL_EMAIL); // Can view
  const dave = () => as(DAVE, DAVE_EMAIL); // not invited

  async function seedShared(extra: Record<string, Record<string, unknown>> = {}) {
    await seed(env(), {
      [DIAGRAM]: storedDiagram(),
      [UNNAMED]: storedVersion(null),
      [NAMED]: storedVersion('Sent to client'),
      [ACCESS]: storedIndex(),
      ...extra,
    });
  }

  // ---- Access level table, row by row ----------------------------------

  describe('Owner — every row of the table', () => {
    it('views, saves (attributed, next revision) and gets a Version in one transaction', async () => {
      await seedShared();
      await assertSucceeds(getDoc(doc(alice(), DIAGRAM)));
      await assertSucceeds(transactionalSave(alice(), ALICE, ALICE_EMAIL));
    });

    it('reads, names and prunes Versions', async () => {
      await seedShared();
      await assertSucceeds(getDocs(collection(alice(), VERSIONS)));
      await assertSucceeds(updateDoc(doc(alice(), UNNAMED), { name: 'Kept' }));
      await assertSucceeds(deleteDoc(doc(alice(), NAMED)));
    });

    it('turns Public on and off', async () => {
      await seedShared();
      await assertSucceeds(updateDoc(doc(alice(), DIAGRAM), { public: true }));
      await assertSucceeds(setDoc(doc(alice(), MIRROR), { ownerUid: ALICE, name: 'Architecture', document: flow, public: true }));
      await assertSucceeds(updateDoc(doc(alice(), DIAGRAM), { public: false }));
      await assertSucceeds(deleteDoc(doc(alice(), MIRROR)));
    });

    it('Shares: creates, changes and removes the Collaborator list', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex({ [BOB_EMAIL]: 'edit' })));
      await assertSucceeds(getDoc(doc(alice(), ACCESS)));
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex({ [BOB_EMAIL]: 'view', [CAROL_EMAIL]: 'edit' })));
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex({ [CAROL_EMAIL]: 'edit' })));
      await assertSucceeds(deleteDoc(doc(alice(), ACCESS)));
    });

    it('may probe for an index that does not exist yet', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertSucceeds(getDoc(doc(alice(), ACCESS)));
    });

    it('lists their own indexes (the Diagrams list\'s shared marker)', async () => {
      await seedShared();
      await assertSucceeds(getDocs(query(collection(alice(), 'diagram-access'), where('ownerUid', '==', ALICE))));
    });

    it('deletes the Diagram, its Versions and its index', async () => {
      await seedShared();
      await assertSucceeds(deleteDoc(doc(alice(), UNNAMED)));
      await assertSucceeds(deleteDoc(doc(alice(), NAMED)));
      await assertSucceeds(deleteDoc(doc(alice(), DIAGRAM)));
      await assertSucceeds(deleteDoc(doc(alice(), ACCESS)));
    });
  });

  describe('Can edit Collaborator', () => {
    it('views the Diagram (one get), but cannot list the owner\'s Diagrams', async () => {
      await seedShared();
      await assertSucceeds(getDoc(doc(bob(), DIAGRAM)));
      await assertFails(getDocs(collection(bob(), `users/${ALICE}/diagrams`)));
    });

    it('edits and Saves: content fields, next revision, attributed to themselves', async () => {
      await seedShared();
      await assertSucceeds(transactionalSave(bob(), BOB, BOB_EMAIL));
    });

    it('cannot change Public, createdAt or any non-content field while saving', async () => {
      await seedShared();
      await assertFails(transactionalSave(bob(), BOB, BOB_EMAIL, 3, { public: true }));
      await assertFails(transactionalSave(bob(), BOB, BOB_EMAIL, 3, { createdAt: serverTimestamp() }));
      await assertFails(transactionalSave(bob(), BOB, BOB_EMAIL, 3, { ownerUid: BOB }));
      await assertFails(updateDoc(doc(bob(), DIAGRAM), { public: true }));
    });

    it('cannot Save without moving the revision on by exactly one (the server side of a Save conflict)', async () => {
      await seedShared();
      const db = bob();
      // Stale: wrote what it loaded (3) again.
      await assertFails(updateDoc(doc(db, DIAGRAM), { ...saveFields(BOB, BOB_EMAIL, 3), revision: 3 }));
      // Skipping ahead.
      await assertFails(updateDoc(doc(db, DIAGRAM), { ...saveFields(BOB, BOB_EMAIL, 3), revision: 5 }));
      // No revision at all.
      const { revision: _omit, ...withoutRevision } = saveFields(BOB, BOB_EMAIL, 3);
      void _omit;
      await assertFails(updateDoc(doc(db, DIAGRAM), withoutRevision));
      // And with a client-chosen time.
      await assertFails(updateDoc(doc(db, DIAGRAM), { ...saveFields(BOB, BOB_EMAIL, 3), updatedAt: Timestamp.fromMillis(0) }));
    });

    it('cannot spoof lastSavedBy — another uid, another email, or none', async () => {
      await seedShared();
      await assertFails(transactionalSave(bob(), ALICE, BOB_EMAIL));
      await assertFails(transactionalSave(bob(), BOB, ALICE_EMAIL));
      await assertFails(updateDoc(doc(bob(), DIAGRAM), { ...saveFields(BOB, BOB_EMAIL), lastSavedBy: { ...actor(BOB, BOB_EMAIL), role: 'owner' } }));
      const { lastSavedBy: _omit, ...unattributed } = saveFields(BOB, BOB_EMAIL);
      void _omit;
      await assertFails(updateDoc(doc(bob(), DIAGRAM), unattributed));
    });

    it('reads the history, names Versions and creates Versions as themselves', async () => {
      await seedShared();
      await assertSucceeds(getDoc(doc(bob(), UNNAMED)));
      await assertSucceeds(getDocs(query(collection(bob(), VERSIONS), orderBy('savedAt', 'desc'))));
      await assertSucceeds(updateDoc(doc(bob(), UNNAMED), { name: 'Bob named it' }));
      await assertSucceeds(updateDoc(doc(bob(), NAMED), { name: null }));
      await assertSucceeds(setDoc(doc(bob(), `${VERSIONS}/b1`), newVersion(BOB, BOB_EMAIL)));
      await assertFails(setDoc(doc(bob(), `${VERSIONS}/b2`), newVersion(ALICE, ALICE_EMAIL)));
    });

    it('prunes: runs the prune queries and deletes unnamed Versions — never a Named one', async () => {
      await seedShared();
      const unnamed = query(collection(bob(), VERSIONS), where('name', '==', null));
      await assertSucceeds(getCountFromServer(unnamed));
      await assertSucceeds(getDocs(query(unnamed, orderBy('savedAt', 'asc'), limit(1))));
      await assertFails(deleteDoc(doc(bob(), NAMED)));
      const db = modular(bob());
      await assertSucceeds(
        runTransaction(db, async (transaction) => {
          const ref = doc(db, UNNAMED);
          await transaction.get(ref);
          transaction.delete(ref);
        }),
      );
    });

    it('Save as: a copy under their own uid is theirs', async () => {
      await seedShared();
      await assertSucceeds(setDoc(doc(bob(), `users/${BOB}/diagrams/copy`), { ...storedDiagram({ revision: 0 }), lastSavedBy: actor(BOB, BOB_EMAIL) }));
    });

    it('refreshes the Public link mirror after saving a Public diagram', async () => {
      await seedShared({ [DIAGRAM]: storedDiagram({ public: true }), [MIRROR]: { ownerUid: ALICE, name: 'Architecture', document: flow, public: true } });
      await assertSucceeds(setDoc(doc(bob(), MIRROR), { ownerUid: ALICE, name: 'Renamed', document: edited, public: true, updatedAt: serverTimestamp() }, { merge: true }));
    });

    it('cannot turn Public on or off (mirror create / delete), or re-own or unpublish the mirror', async () => {
      await seedShared({ [DIAGRAM]: storedDiagram({ public: true }) });
      await assertFails(setDoc(doc(bob(), MIRROR), { ownerUid: ALICE, name: 'Architecture', document: flow, public: true }));
      await seed(env(), { [MIRROR]: { ownerUid: ALICE, name: 'Architecture', document: flow, public: true } });
      await assertFails(deleteDoc(doc(bob(), MIRROR)));
      await assertFails(setDoc(doc(bob(), MIRROR), { ownerUid: BOB }, { merge: true }));
      await assertFails(setDoc(doc(bob(), MIRROR), { public: false }, { merge: true }));
    });

    it('cannot Share: no write to the Collaborator list, not even to promote someone', async () => {
      await seedShared();
      await assertFails(setDoc(doc(bob(), ACCESS), accessIndex({ [BOB_EMAIL]: 'edit', [CAROL_EMAIL]: 'edit' })));
      await assertFails(setDoc(doc(bob(), ACCESS), accessIndex({ [BOB_EMAIL]: 'edit', [CAROL_EMAIL]: 'view', [DAVE_EMAIL]: 'edit' }, { ownerUid: BOB, ownerEmail: BOB_EMAIL })));
      await assertFails(updateDoc(doc(bob(), ACCESS), { [`collaborators`]: { [BOB_EMAIL]: 'edit' }, collaboratorEmails: [BOB_EMAIL] }));
      await assertFails(deleteDoc(doc(bob(), ACCESS)));
    });

    it('cannot delete the Diagram or create one under the owner', async () => {
      await seedShared();
      await assertFails(deleteDoc(doc(bob(), DIAGRAM)));
      await assertFails(setDoc(doc(bob(), `users/${ALICE}/diagrams/new`), storedDiagram({ revision: 0 })));
    });
  });

  describe('Can view Collaborator', () => {
    it('views the Diagram', async () => {
      await seedShared();
      await assertSucceeds(getDoc(doc(carol(), DIAGRAM)));
    });

    it('cannot Save, rename or touch any field', async () => {
      await seedShared();
      await assertFails(transactionalSave(carol(), CAROL, CAROL_EMAIL));
      await assertFails(updateDoc(doc(carol(), DIAGRAM), { name: 'Renamed' }));
    });

    it('sees no history and can do nothing with Versions — even calling Firestore directly', async () => {
      await seedShared();
      await assertFails(getDoc(doc(carol(), UNNAMED)));
      await assertFails(getDocs(collection(carol(), VERSIONS)));
      await assertFails(getCountFromServer(query(collection(carol(), VERSIONS), where('name', '==', null))));
      await assertFails(setDoc(doc(carol(), `${VERSIONS}/c1`), newVersion(CAROL, CAROL_EMAIL)));
      await assertFails(updateDoc(doc(carol(), UNNAMED), { name: 'Carol' }));
      await assertFails(deleteDoc(doc(carol(), UNNAMED)));
    });

    it('cannot refresh the mirror, Share, or delete', async () => {
      await seedShared({ [DIAGRAM]: storedDiagram({ public: true }), [MIRROR]: { ownerUid: ALICE, name: 'Architecture', document: flow, public: true } });
      await assertFails(setDoc(doc(carol(), MIRROR), { name: 'Renamed', document: edited }, { merge: true }));
      await assertFails(setDoc(doc(carol(), ACCESS), accessIndex({ [CAROL_EMAIL]: 'edit' })));
      await assertFails(deleteDoc(doc(carol(), DIAGRAM)));
    });

    it('may Save as a copy of their own (the Viewer offers none, but it is their own uid)', async () => {
      await assertSucceeds(setDoc(doc(carol(), `users/${CAROL}/diagrams/copy`), storedDiagram({ revision: 0 })));
    });
  });

  // ---- Who does not get in -------------------------------------------

  describe('an invited email that is not verified', () => {
    it('is denied the Diagram, its history, the index and the Shared-with-me query — with an open Access list too', async () => {
      await seedShared();
      const unverified = as(BOB, BOB_EMAIL, false);
      await assertFails(getDoc(doc(unverified, DIAGRAM)));
      await assertFails(transactionalSave(unverified, BOB, BOB_EMAIL));
      await assertFails(getDocs(collection(unverified, VERSIONS)));
      await assertFails(getDoc(doc(unverified, ACCESS)));
      await assertFails(getDocs(query(collection(unverified, 'diagram-access'), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
    });

    it('gets in once the token says verified', async () => {
      await seedShared();
      await assertSucceeds(getDoc(doc(as(BOB, BOB_EMAIL, true), DIAGRAM)));
    });
  });

  describe('an invitee off the Access list', () => {
    it('is denied everything even when invited and verified', async () => {
      await seedShared({
        'config/access': { domains: ['company.com'], emails: [] },
        [ACCESS]: storedIndex({ 'bob@gmail.com': 'edit' }),
      });
      const offList = as(BOB, 'bob@gmail.com');
      await assertFails(getDoc(doc(offList, DIAGRAM)));
      await assertFails(transactionalSave(offList, BOB, 'bob@gmail.com'));
      await assertFails(getDocs(collection(offList, VERSIONS)));
      await assertFails(getDoc(doc(offList, ACCESS)));
      await assertFails(getDocs(query(collection(offList, 'diagram-access'), where('collaboratorEmails', 'array-contains', 'bob@gmail.com'))));
    });

    it('while a listed Collaborator on the same deployment gets in', async () => {
      await seedShared({ 'config/access': { domains: ['company.com'], emails: [] } });
      await assertSucceeds(getDoc(doc(bob(), DIAGRAM)));
    });
  });

  describe('a removed or downgraded Collaborator — takes effect immediately', () => {
    it('removed: denied reading and writing the Diagram, its Versions and the index', async () => {
      await seedShared({ [ACCESS]: storedIndex({ [CAROL_EMAIL]: 'view' }) });
      await assertFails(getDoc(doc(bob(), DIAGRAM)));
      await assertFails(transactionalSave(bob(), BOB, BOB_EMAIL));
      await assertFails(getDocs(collection(bob(), VERSIONS)));
      await assertFails(getDoc(doc(bob(), ACCESS)));
    });

    it('index deleted (Diagram unshared or deleted): denied', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertFails(getDoc(doc(bob(), DIAGRAM)));
      await assertFails(getDocs(collection(bob(), VERSIONS)));
    });

    it('downgraded to Can view: still reads, can no longer Save or see history', async () => {
      await seedShared({ [ACCESS]: storedIndex({ [BOB_EMAIL]: 'view' }) });
      await assertSucceeds(getDoc(doc(bob(), DIAGRAM)));
      await assertFails(transactionalSave(bob(), BOB, BOB_EMAIL));
      await assertFails(getDocs(collection(bob(), VERSIONS)));
    });
  });

  describe('someone never invited', () => {
    it('is denied the Diagram, its history and the index', async () => {
      await seedShared();
      await assertFails(getDoc(doc(dave(), DIAGRAM)));
      await assertFails(transactionalSave(dave(), DAVE, DAVE_EMAIL));
      await assertFails(getDocs(collection(dave(), VERSIONS)));
      await assertFails(getDoc(doc(dave(), ACCESS)));
    });

    it('cannot pass the check by using an index for another owner\'s Diagram id', async () => {
      // Dave owns his own d1 and shares it with himself-as-someone: that
      // index lives at dave_d1 and says nothing about alice's d1.
      await seedShared({
        [`users/${DAVE}/diagrams/${ID}`]: storedDiagram(),
        [`diagram-access/${DAVE}_${ID}`]: storedIndex({ [BOB_EMAIL]: 'edit' }, { ownerUid: DAVE, ownerEmail: DAVE_EMAIL }),
        [ACCESS]: storedIndex({ [CAROL_EMAIL]: 'view' }),
      });
      await assertFails(getDoc(doc(bob(), DIAGRAM)));
    });

    it('an index that names another owner than its path grants nothing', async () => {
      await seedShared({ [ACCESS]: storedIndex({ [BOB_EMAIL]: 'edit' }, { ownerUid: DAVE }) });
      await assertFails(getDoc(doc(bob(), DIAGRAM)));
    });

    it('unauthenticated: nothing at all', async () => {
      await seedShared();
      const db = env().unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, DIAGRAM)));
      await assertFails(getDoc(doc(db, ACCESS)));
      await assertFails(getDocs(query(collection(db, 'diagram-access'), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
    });
  });

  // ---- "Shared with me" ----------------------------------------------

  describe('"Shared with me" query', () => {
    it('is allowed for the caller\'s own verified email — and finds the index', async () => {
      await seedShared();
      const snapshot = await assertSucceeds(getDocs(query(collection(bob(), 'diagram-access'), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
      if (snapshot.size !== 1) throw new Error(`expected 1 shared diagram, got ${snapshot.size}`);
    });

    it('also by Diagram id (how the Editor resolves a link)', async () => {
      await seedShared();
      await assertSucceeds(getDocs(query(collection(bob(), 'diagram-access'), where('diagramId', '==', ID), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
    });

    it('a token email in another case still matches its normalised entry', async () => {
      await seedShared();
      const mixedCase = env().authenticatedContext(BOB, token('Bob@Company.com')).firestore();
      await assertSucceeds(getDoc(doc(mixedCase, DIAGRAM)));
      await assertSucceeds(getDocs(query(collection(mixedCase, 'diagram-access'), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
    });

    it('is refused for anyone else\'s email, or with no filter at all', async () => {
      await seedShared();
      await assertFails(getDocs(query(collection(bob(), 'diagram-access'), where('collaboratorEmails', 'array-contains', CAROL_EMAIL))));
      await assertFails(getDocs(query(collection(dave(), 'diagram-access'), where('collaboratorEmails', 'array-contains', BOB_EMAIL))));
      await assertFails(getDocs(collection(bob(), 'diagram-access')));
      await assertFails(getDocs(query(collection(bob(), 'diagram-access'), where('ownerUid', '==', ALICE))));
    });

    it('a pending invite starts matching once that email signs up and verifies', async () => {
      await seedShared({ [ACCESS]: storedIndex({ [DAVE_EMAIL]: 'edit' }) });
      // Before verifying: nothing.
      await assertFails(getDocs(query(collection(as(DAVE, DAVE_EMAIL, false), 'diagram-access'), where('collaboratorEmails', 'array-contains', DAVE_EMAIL))));
      // After: listed and openable.
      await assertSucceeds(getDocs(query(collection(dave(), 'diagram-access'), where('collaboratorEmails', 'array-contains', DAVE_EMAIL))));
      await assertSucceeds(getDoc(doc(dave(), DIAGRAM)));
    });
  });

  describe('first-open mark ("Pending" in the Share dialog)', () => {
    it('a Collaborator stamps their own mark with the server time', async () => {
      await seedShared();
      await assertSucceeds(updateDoc(doc(bob(), ACCESS), new FieldPath('openedBy', BOB_EMAIL), serverTimestamp()));
      await assertSucceeds(updateDoc(doc(carol(), ACCESS), new FieldPath('openedBy', CAROL_EMAIL), serverTimestamp()));
    });

    it('but not someone else\'s, not a chosen time, and nothing else alongside', async () => {
      await seedShared();
      await assertFails(updateDoc(doc(bob(), ACCESS), new FieldPath('openedBy', CAROL_EMAIL), serverTimestamp()));
      await assertFails(updateDoc(doc(bob(), ACCESS), new FieldPath('openedBy', BOB_EMAIL), Timestamp.fromMillis(0)));
      await assertFails(updateDoc(doc(bob(), ACCESS), new FieldPath('openedBy', BOB_EMAIL), serverTimestamp(), new FieldPath('collaborators', CAROL_EMAIL), 'edit'));
      await assertFails(updateDoc(doc(dave(), ACCESS), new FieldPath('openedBy', DAVE_EMAIL), serverTimestamp()));
    });
  });

  // ---- The index is the Owner's, in the shape the client writes --------

  describe('diagram-access writes', () => {
    it('only by the owner of the Diagram it names', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      // Bob writing alice's slot, as alice or as himself.
      await assertFails(setDoc(doc(bob(), ACCESS), accessIndex()));
      await assertFails(setDoc(doc(bob(), ACCESS), accessIndex(undefined, { ownerUid: BOB, ownerEmail: BOB_EMAIL })));
      // Bob claiming an index for a Diagram he doesn't have.
      await assertFails(setDoc(doc(bob(), `diagram-access/${BOB}_${ID}`), accessIndex({ [CAROL_EMAIL]: 'edit' }, { ownerUid: BOB, ownerEmail: BOB_EMAIL })));
    });

    it('a squatter with a same-id Diagram of their own gets their own slot, never the owner\'s', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram(), [`users/${BOB}/diagrams/${ID}`]: storedDiagram() });
      await assertSucceeds(setDoc(doc(bob(), `diagram-access/${BOB}_${ID}`), accessIndex({ [CAROL_EMAIL]: 'edit' }, { ownerUid: BOB, ownerEmail: BOB_EMAIL })));
      await assertFails(setDoc(doc(bob(), ACCESS), accessIndex({ [CAROL_EMAIL]: 'edit' }, { ownerUid: BOB, ownerEmail: BOB_EMAIL })));
      // …and alice can still Share hers.
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex({ [CAROL_EMAIL]: 'view' })));
    });

    it('refuses an id that is not {ownerUid}_{diagramId}', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertFails(setDoc(doc(alice(), `diagram-access/${ID}`), accessIndex()));
      await assertFails(setDoc(doc(alice(), `diagram-access/${ALICE}_other`), accessIndex()));
    });

    it('refuses a list that disagrees with the map, duplicates, or a bad level', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { collaboratorEmails: [BOB_EMAIL] })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { collaboratorEmails: [BOB_EMAIL, CAROL_EMAIL, DAVE_EMAIL] })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ [BOB_EMAIL]: 'edit' }, { collaboratorEmails: [BOB_EMAIL, BOB_EMAIL] })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ [BOB_EMAIL]: 'owner' })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ [BOB_EMAIL]: true as unknown as string })));
    });

    it('refuses an email that is not normalised, or the Owner listing themselves', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ 'Bob@Company.com': 'edit' })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ ' bob@company.com': 'edit' })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ [ALICE_EMAIL]: 'edit' })));
    });

    it('refuses more than 50 Collaborators', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      const fifty: Record<string, string> = {};
      for (let i = 0; i < 50; i += 1) fifty[`p${String(i).padStart(2, '0')}@company.com`] = 'view';
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex(fifty)));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex({ ...fifty, 'p50@company.com': 'view' })));
    });

    it('refuses a wrong ownerEmail, extra fields, or an opened mark for someone not listed', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram() });
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { ownerEmail: BOB_EMAIL })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { public: true })));
      await assertFails(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { openedBy: { [DAVE_EMAIL]: Timestamp.fromMillis(1) } })));
      await assertSucceeds(setDoc(doc(alice(), ACCESS), accessIndex(undefined, { openedBy: { [BOB_EMAIL]: Timestamp.fromMillis(1) } })));
    });

    it('an owner off the Access list cannot Share', async () => {
      await seed(env(), { [DIAGRAM]: storedDiagram(), 'config/access': { domains: ['company.com'], emails: [] } });
      const offList = as(ALICE, 'alice@gmail.com');
      await assertFails(setDoc(doc(offList, ACCESS), accessIndex(undefined, { ownerEmail: 'alice@gmail.com' })));
    });
  });

  // ---- Save attribution and revision, for the Owner too ---------------

  describe('Owner Saves', () => {
    it('a Diagram created before Share (no revision) saves as revision 1 — the old link keeps working', async () => {
      await seed(env(), { [DIAGRAM]: { name: 'Legacy', document: flow, public: false } });
      await assertSucceeds(getDoc(doc(alice(), DIAGRAM)));
      await assertSucceeds(transactionalSave(alice(), ALICE, ALICE_EMAIL, 0));
    });

    it('cannot spoof lastSavedBy or skip the revision either', async () => {
      await seedShared();
      await assertFails(transactionalSave(alice(), BOB, ALICE_EMAIL));
      await assertFails(transactionalSave(alice(), ALICE, BOB_EMAIL));
      await assertFails(updateDoc(doc(alice(), DIAGRAM), { ...saveFields(ALICE, ALICE_EMAIL), revision: 3 }));
      await assertFails(updateDoc(doc(alice(), DIAGRAM), { ...saveFields(ALICE, ALICE_EMAIL), revision: 9 }));
    });

    it('a non-Save change (Public, a rename) needs no revision', async () => {
      await seedShared();
      await assertSucceeds(updateDoc(doc(alice(), DIAGRAM), { public: true }));
      await assertSucceeds(updateDoc(doc(alice(), DIAGRAM), { name: 'Renamed' }));
    });

    it('a new Diagram starts at revision 0', async () => {
      await assertSucceeds(setDoc(doc(alice(), `users/${ALICE}/diagrams/new`), storedDiagram({ revision: 0 })));
      await assertFails(setDoc(doc(alice(), `users/${ALICE}/diagrams/new2`), storedDiagram({ revision: 4 })));
    });
  });

  describe('administrator', () => {
    it('still reads every Diagram (overview) but cannot Share someone else\'s', async () => {
      await seedShared();
      const db = env().authenticatedContext(ADMIN, token('boss@company.com')).firestore();
      await assertSucceeds(getDoc(doc(db, DIAGRAM)));
      await assertSucceeds(getDocs(collectionGroup(db, 'diagrams')));
      await assertFails(setDoc(doc(db, ACCESS), accessIndex({ 'boss@company.com': 'edit' })));
      await assertFails(transactionalSave(db, ADMIN, 'boss@company.com'));
    });
  });

  describe('Public link of a pre-Share Diagram', () => {
    it('still opens for anyone, signed out included', async () => {
      await seed(env(), { [MIRROR]: { ownerUid: ALICE, name: 'Legacy', document: flow, public: true } });
      await assertSucceeds(getDoc(doc(env().unauthenticatedContext().firestore(), MIRROR)));
    });
  });
});
