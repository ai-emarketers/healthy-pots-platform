/**
 * Frees the dev ports (3000 web, 4000 API) when an old `npm run dev` is still running.
 *   npm run free-ports
 * Only stops processes named "node", so it will not touch other apps.
 */
import { execSync } from 'node:child_process';

const PORTS = [3000, 4000];
const win = process.platform === 'win32';
const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };

function pidsOnPort(port) {
  if (win) {
    return [...new Set(sh('netstat -ano -p tcp').split(/\r?\n/)
      .filter((l) => l.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop()))].filter((p) => /^\d+$/.test(p) && p !== '0');
  }
  return [...new Set(sh(`lsof -ti tcp:${port} -sTCP:LISTEN`).split('\n').filter(Boolean))];
}
function nameOf(pid) {
  if (win) return (sh(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).split('","')[0] || '').replace(/"/g, '').toLowerCase();
  return sh(`ps -p ${pid} -o comm=`).trim().toLowerCase();
}

let freed = 0;
for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) {
    const name = nameOf(pid);
    if (!name.startsWith('node')) { console.log(`Port ${port} is used by "${name || 'unknown'}" (PID ${pid}). Not stopping it: close it yourself or change PORT.`); continue; }
    sh(win ? `taskkill /PID ${pid} /F /T` : `kill -9 ${pid}`);
    console.log(`Stopped old node process ${pid} on port ${port}`);
    freed++;
  }
}
console.log(freed ? 'Ports freed. Now run: npm run dev' : 'No old node processes found on ports 3000 and 4000.');
