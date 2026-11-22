// Loads the lessons in seed/lessons/<lang> into the local Firebase
// emulators for one account — emulator only, never a real project:
//
//   SEED_EMAIL=… SEED_PASSWORD=… npx vite-node scripts/seed-emulator-lessons.ts [--lang en|vi|all] [--dir seed/lessons]
//
// Signs the account in through the Auth emulator (creating it when it
// doesn't exist), makes it an administrator (`users-roles/{uid}`), and
// writes each lesson to `users/{uid}/lessons/tutorial-<lang>-<id>` with
// Public on and its `public-lessons/{id}` mirror, so a re-run overwrites
// rather than duplicates. Firestore writes go through the emulator's REST
// API as `Bearer owner`, which bypasses the rules. The Vietnamese copies
// are titled "<title> (VI)" so both sets can be told apart in the list; the
// suffix goes into `meta.title` too, since that is the Lesson's one name
// (the stored `name` is always a copy of it).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argValue, fail, readSeedLessons, toFields } from './seed-lessons-shared';

const PROJECT = process.env.SEED_PROJECT ?? 'demo-x-flow-tool';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, argValue('--dir', 'seed/lessons'));
const langArg = argValue('--lang', 'all');
const languages = langArg === 'all' ? ['en', 'vi'] : [langArg];

const isLocal = (host: string) => /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host);
if (!PROJECT.startsWith('demo-')) fail(`Refusing to seed "${PROJECT}": only an emulator-only demo-* project may be seeded.`);
if (!isLocal(FIRESTORE) || !isLocal(AUTH)) fail(`Refusing to seed: the emulator hosts must be local (Firestore ${FIRESTORE}, Auth ${AUTH}).`);
if (languages.some((lang) => lang !== 'en' && lang !== 'vi')) fail('--lang must be en, vi or all.');
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password) fail('Set SEED_EMAIL and SEED_PASSWORD for the account to seed.');

async function authCall(method: 'signUp' | 'signInWithPassword'): Promise<{ localId?: string; error?: { message: string } }> {
  const response = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=emulator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return response.json() as Promise<{ localId?: string; error?: { message: string } }>;
}

async function signIn(): Promise<string> {
  let result = await authCall('signUp');
  if (result.error?.message.startsWith('EMAIL_EXISTS')) result = await authCall('signInWithPassword');
  if (!result.localId) fail(`Could not sign in as ${email}: ${result.error?.message ?? 'no user id'}`);
  return result.localId;
}

async function writeDoc(docPath: string, data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`http://${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!response.ok) fail(`Writing ${docPath} failed: ${response.status} ${await response.text()}`);
}

const uid = await signIn();
await writeDoc(`users-roles/${uid}`, { roles: ['administrators'] });

const lessons = readSeedLessons(dir, languages);
for (const { id, name, document, updatedAt } of lessons) {
  await writeDoc(`users/${uid}/lessons/${id}`, { name, document, public: true, createdAt: updatedAt, updatedAt });
  await writeDoc(`public-lessons/${id}`, { ownerUid: uid, name, document, public: true, updatedAt });
}
for (const lang of languages) console.log(`${lang}: ${lessons.filter((lesson) => lesson.lang === lang).length} lessons seeded`);
console.log(`Done — ${email} (uid ${uid}) is an administrator in ${PROJECT}.`);
