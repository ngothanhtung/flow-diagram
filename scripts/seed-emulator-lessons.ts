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
// are named "<title> (VI)" so both sets can be told apart in the list.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = process.env.SEED_PROJECT ?? 'demo-x-flow-tool';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argValue = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const dir = path.resolve(root, argValue('--dir', 'seed/lessons'));
const langArg = argValue('--lang', 'all');
const languages = langArg === 'all' ? ['en', 'vi'] : [langArg];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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

type FirestoreValue = Record<string, unknown>;

/** A JSON value (or Date) as a Firestore REST `Value`. */
function toValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: value.length ? { values: value.map(toValue) } : {} };
  return { mapValue: { fields: toFields(value as Record<string, unknown>) } };
}

function toFields(object: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toValue(value)]));
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

// The Lessons list is newest first: stamp the times so it reads EN A→Z, then VI A→Z.
const now = Date.now();
let order = 0;
for (const lang of languages) {
  const files = readdirSync(path.join(dir, lang)).filter((file) => file.endsWith('.lesson.json')).sort();
  for (const file of files) {
    const document = JSON.parse(readFileSync(path.join(dir, lang, file), 'utf8')) as { meta?: { title?: string } };
    const id = `tutorial-${lang}-${file.replace(/\.lesson\.json$/, '')}`;
    const title = document.meta?.title || id;
    const name = lang === 'vi' ? `${title} (VI)` : title;
    const updatedAt = new Date(now - order * 1000);
    order += 1;
    await writeDoc(`users/${uid}/lessons/${id}`, { name, document, public: true, createdAt: updatedAt, updatedAt });
    await writeDoc(`public-lessons/${id}`, { ownerUid: uid, name, document, public: true, updatedAt });
  }
  console.log(`${lang}: ${files.length} lessons seeded`);
}
console.log(`Done — ${email} (uid ${uid}) is an administrator in ${PROJECT}.`);
