import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/** Must stay a `demo-*` id: the emulator then refuses anything but local. */
export const PROJECT_ID = 'demo-x-flow-tool';

export const ALICE = 'alice';
export const BOB = 'bob';
export const ADMIN = 'admin';

/**
 * Registers the hooks every rules test file needs and returns a getter for
 * the environment: rules are read from `firestore.rules` on disk (so a test
 * always runs against the file that would be deployed), the emulator is
 * cleared before each test, and `ADMIN` is seeded as an administrator.
 *
 * Host/port come from FIRESTORE_EMULATOR_HOST, which `firebase
 * emulators:exec` sets — run through `npm run test:rules`.
 */
export function useRulesTestEnvironment(): () => RulesTestEnvironment {
  let testEnv: RulesTestEnvironment | undefined;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    const env = requireEnv(testEnv);
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users-roles', ADMIN), { roles: ['administrators'] });
    });
  });

  return () => requireEnv(testEnv);
}

function requireEnv(testEnv: RulesTestEnvironment | undefined): RulesTestEnvironment {
  if (!testEnv) throw new Error('Rules test environment is not initialised.');
  return testEnv;
}

/** Writes documents with rules bypassed — fixtures, not the thing under test. */
export async function seed(env: RulesTestEnvironment, docs: Record<string, Record<string, unknown>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data);
    }
  });
}
