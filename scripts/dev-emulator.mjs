// `npm run dev:emulator`: `next dev` against the local Firebase emulators.
//
// Loads `.env.emulator` into process.env *before* starting Next. Next never
// lets a .env file override a variable already in process.env, so these
// values win over .env.local and the dev server cannot reach the real
// project. (`node --env-file` can't be used directly: Next forwards the
// flag to its worker through NODE_OPTIONS, where Node rejects it.)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

process.loadEnvFile(new URL('../.env.emulator', import.meta.url));

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], { stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 1));
