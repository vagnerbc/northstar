import { spawnSync } from 'node:child_process';

const compose = ['compose', '-p', 'ecommerce-e2e', '-f', 'compose.yaml', '-f', 'compose.e2e.yaml'];
const run = (command, args, options = {}) =>
  spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });

let exitCode = 1;
try {
  const started = run('docker', [...compose, 'up', '--build', '--wait']);
  if (started.status !== 0)
    throw new Error('The isolated E2E Compose stack did not become healthy.');
  exitCode = run('pnpm', ['exec', 'playwright', 'test']).status ?? 1;
} finally {
  // The fixed project name ensures cleanup can only remove resources created by this test stack.
  run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
}
process.exitCode = exitCode;
