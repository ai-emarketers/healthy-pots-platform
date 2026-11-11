/**
 * One-command local setup that works on Windows, macOS and Linux:
 *   npm run bootstrap
 * Installs nothing itself: run `npm install` first (or `npm run setup`).
 * Steps: create env files if missing, start PostgreSQL (Docker), migrate, seed.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error(`\nStep failed: ${cmd}`); process.exit(r.status ?? 1); }
};

const secret = randomBytes(32).toString('hex');
if (!existsSync('apps/api/.env')) {
  copyFileSync('.env.example', 'apps/api/.env');
  writeFileSync('apps/api/.env', readFileSync('apps/api/.env', 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log('Created apps/api/.env with a new JWT_SECRET');
}
if (!existsSync('apps/web/.env.local')) {
  copyFileSync('apps/web/.env.example', 'apps/web/.env.local');
  writeFileSync('apps/web/.env.local', readFileSync('apps/web/.env.local', 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log('Created apps/web/.env.local with the same JWT_SECRET');
}
run('npm run db:up');
console.log('Waiting for PostgreSQL...');
spawnSync(process.platform === 'win32' ? 'ping -n 6 127.0.0.1 > nul' : 'sleep 5', { shell: true });
run('npm run db:migrate -- --name init');
run('npm run db:seed');
console.log('\nDone. Start the apps with: npm run dev   (web http://localhost:3000, API http://localhost:4000/api)');
