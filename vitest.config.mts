import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `npm test`: pure logic under src/, no browser and no emulator. The
// Firestore rules suite has its own config (vitest.rules.config.mts) because
// it needs a running emulator — see `npm run test:rules`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
