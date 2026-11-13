/**
 * Frees the dev ports (3000 web, 4000 API) when an old `npm run dev` is still running.
 *   npm run free-ports
 * Only stops processes named "node", so it will not touch other apps.
 */
// Runs shell commands and returns their output
import { execSync } from 'node:child_process';

// Dev ports to clear: 3000 = web, 4000 = API
const PORTS = [3000, 4000];
// Windows and macOS/Linux need different commands
const win = process.platform === 'win32';
// Run a command, return its output, or an empty string on any error
const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };

// Find the process IDs listening on a port (netstat on Windows, lsof elsewhere)
function pidsOnPort(port) {
  if (win) {
    return [...new Set(sh('netstat -ano -p tcp').split(/\r?\n/)
      .filter((l) => l.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop()))].filter((p) => /^\d+$/.test(p) && p !== '0');
  }
  return [...new Set(sh(`lsof -ti tcp:${port} -sTCP:LISTEN`).split('\n').filter(Boolean))];
}
// Look up a process name so only node processes are ever killed
function nameOf(pid) {
  if (win) return (sh(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).split('","')[0] || '').replace(/"/g, '').toLowerCase();
  return sh(`ps -p ${pid} -o comm=`).trim().toLowerCase();
}

// Counter of stopped processes for the final message
let freed = 0;
// Check each dev port in turn
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
