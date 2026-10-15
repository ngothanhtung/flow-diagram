import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `npm run test:rules`: runs inside `firebase emulators:exec`, which starts
// the Firestore emulator (demo project) and exports FIRESTORE_EMULATOR_HOST.
// Test files share that one emulator and each clears it in beforeEach, so
// they must not run in parallel.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
