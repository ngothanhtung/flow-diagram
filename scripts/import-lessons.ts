// Imports the lessons in seed/lessons/<lang> into a REAL Firebase project,
// as one ordinary signed-in account — every write goes through the
// deployed Firestore rules, exactly like the app's own Save:
//
//   FIREBASE_API_KEY=… SEED_EMAIL=… SEED_PASSWORD=… \
//     npx vite-node scripts/import-lessons.ts --project <project-id> [--lang en|vi|all] [--dir seed/lessons] [--create-account] [--tree-only]
//
// --tree-only leaves the Lessons alone and writes only the Lesson tree (for
// an account whose Lessons were imported before trees existed, or edited since).
//
// Or, without the account's password, as a project owner (bypasses the
// rules — e.g. an access token from the signed-in Firebase CLI):
//
//   FIREBASE_ACCESS_TOKEN=… npx vite-node scripts/import-lessons.ts --project <project-id> --uid <owner-uid>
//
// --project is required (no default) so a real project is never written to
// by accident. Without --create-account the account must already exist.
// Each lesson lands at `users/{uid}/lessons/tutorial-<lang>-<id>` with
// Public on, then its `public-lessons/{id}` mirror (the rules only admit a
// mirror whose source exists, hence the order). A re-run overwrites rather
// than duplicates. Then the Lesson tree (seed/lessons/tree.json) is merged
// into the account's own tree and its public copy rewritten. Unlike seed-emulator-lessons.ts this grants no role:
// making an account an administrator is done by hand in the console.
// Deploy the rules first: `firebase deploy --only firestore`.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argValue, fail, fromFields, readSeedLessons, readSeedTree, seededTreeDocs, toFields, type FirestoreValue } from './seed-lessons-shared';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = argValue('--project', '');
const dir = path.resolve(root, argValue('--dir', 'seed/lessons'));
const langArg = argValue('--lang', 'all');
const languages = langArg === 'all' ? ['en', 'vi'] : [langArg];
const createAccount = process.argv.includes('--create-account');
const treeOnly = process.argv.includes('--tree-only');
const ownerUid = argValue('--uid', '');
const accessToken = process.env.FIREBASE_ACCESS_TOKEN;

if (!project) fail('Pass --project <firebase-project-id> (the real project to import into).');
if (project.startsWith('demo-')) fail('demo-* projects are emulator-only: use scripts/seed-emulator-lessons.ts.');
if (languages.some((lang) => lang !== 'en' && lang !== 'vi')) fail('--lang must be en, vi or all.');
if (Boolean(accessToken) !== Boolean(ownerUid)) fail('FIREBASE_ACCESS_TOKEN and --uid go together.');
const apiKey = process.env.FIREBASE_API_KEY;
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!accessToken && !apiKey) fail('Set FIREBASE_API_KEY (the project\'s web API key, NEXT_PUBLIC_FIREBASE_API_KEY).');
if (!accessToken && (!email || !password)) fail('Set SEED_EMAIL and SEED_PASSWORD for the account that will own the lessons.');

type AuthResult = { localId?: string; idToken?: string; error?: { message: string } };

async function authCall(method: 'signUp' | 'signInWithPassword'): Promise<AuthResult> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return response.json() as Promise<AuthResult>;
}

async function signIn(): Promise<{ uid: string; token: string }> {
  let result = await authCall('signInWithPassword');
  const missing = result.error && /EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/.test(result.error.message);
  if (missing && createAccount) {
    const created = await authCall('signUp');
    if (!created.error?.message.startsWith('EMAIL_EXISTS')) result = created;
  }
  if (!result.localId || !result.idToken) {
    fail(`Could not sign in as ${email}: ${result.error?.message ?? 'no user id'}${missing && !createAccount ? ' (pass --create-account to create it)' : ''}`);
  }
  return { uid: result.localId, token: result.idToken };
}

const { uid, token } = accessToken ? { uid: ownerUid, token: accessToken } : await signIn();

async function readDoc(docPath: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${docPath}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) fail(`Reading ${docPath} failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return fromFields(body.fields ?? {});
}

async function writeDoc(docPath: string, data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const hint = response.status === 403 ? '\nPermission denied: deploy the rules (`firebase deploy --only firestore`) and check the account is on the Access list (config/access).' : '';
    fail(`Writing ${docPath} failed: ${response.status} ${detail}${hint}`);
  }
}

const lessons = readSeedLessons(dir, languages);
if (!treeOnly) {
  for (const { id, name, document, updatedAt } of lessons) {
    await writeDoc(`users/${uid}/lessons/${id}`, { name, document, public: true, createdAt: updatedAt, updatedAt });
    await writeDoc(`public-lessons/${id}`, { ownerUid: uid, name, document, public: true, updatedAt });
  }
  for (const lang of languages) console.log(`${lang}: ${lessons.filter((lesson) => lesson.lang === lang).length} lessons imported`);
}

/** Every Lesson the account owns, as the tree index records it (name and Public only — the documents stay unread). */
async function listLessonSummaries(): Promise<{ id: string; title: string; public: boolean }[]> {
  const out: { id: string; title: string; public: boolean }[] = [];
  let pageToken = '';
  do {
    const query = `pageSize=300&mask.fieldPaths=name&mask.fieldPaths=public${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}/lessons?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) fail(`Listing lessons failed: ${response.status} ${await response.text()}`);
    const body = (await response.json()) as { documents?: { name: string; fields?: Record<string, FirestoreValue> }[]; nextPageToken?: string };
    for (const document of body.documents ?? []) {
      const fields = fromFields(document.fields ?? {});
      out.push({ id: document.name.split('/').pop() ?? '', title: typeof fields.name === 'string' && fields.name ? fields.name : 'Untitled lesson', public: fields.public === true });
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

// The Lesson tree: the curriculum's chapters, merged into the account's own
// tree and checked against its real Lessons (written after the lessons; the
// public copy last).
const treeDocs = seededTreeDocs(await readDoc(`users/${uid}/lesson-trees/main`), readSeedTree(dir, languages), uid, new Date(), await listLessonSummaries());
await writeDoc(`users/${uid}/lesson-trees/main`, treeDocs.tree);
await writeDoc(`public-lesson-trees/${uid}`, treeDocs.mirror);
console.log('Lesson tree imported.');
console.log(`Done — ${treeOnly ? 'tree only' : `${lessons.length} lessons`} for uid ${uid} in ${project}.`);
