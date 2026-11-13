/**
 * One-command local setup that works on Windows, macOS and Linux:
 *   npm run bootstrap
 * Installs nothing itself: run `npm install` first (or `npm run setup`).
 * Steps: create env files if missing, start PostgreSQL (Docker), migrate, seed.
 */
// File helpers: copy the env templates, check existence, read and write text
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
// Used to generate a random JWT secret
import { randomBytes } from 'node:crypto';
// Runs shell commands (npm scripts) and waits for them
import { spawnSync } from 'node:child_process';

// Run one command with live output; stop the whole setup if it fails
const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error(`\nStep failed: ${cmd}`); process.exit(r.status ?? 1); }
};

// One random 64-hex-char secret, shared by API and web so the web middleware can verify API tokens
const secret = randomBytes(32).toString('hex');
// First run only: create the API env file from the template and inject the secret
if (!existsSync('apps/api/.env')) {
  copyFileSync('.env.example', 'apps/api/.env');
  writeFileSync('apps/api/.env', readFileSync('apps/api/.env', 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log('Created apps/api/.env with a new JWT_SECRET');
}
// Same for the web env file (it needs the identical JWT_SECRET)
if (!existsSync('apps/web/.env.local')) {
  copyFileSync('apps/web/.env.example', 'apps/web/.env.local');
  writeFileSync('apps/web/.env.local', readFileSync('apps/web/.env.local', 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log('Created apps/web/.env.local with the same JWT_SECRET');
}
// Start PostgreSQL in Docker (docker-compose.yml)
run('npm run db:up');
// Give the database a few seconds to accept connections
console.log('Waiting for PostgreSQL...');
spawnSync(process.platform === 'win32' ? 'ping -n 6 127.0.0.1 > nul' : 'sleep 5', { shell: true });
// Create the tables from the Prisma schema
run('npm run db:migrate -- --name init');
// Insert demo data: users, meals, pincodes, settings
run('npm run db:seed');
console.log('\nDone. Start the apps with: npm run dev   (web http://localhost:3000, API http://localhost:4000/api)');
