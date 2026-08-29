/**
 * E2E orchestrator: starts the three fixture servers (default-enabled
 * design start-review, config-disabled design start-review, TUX-free static server),
 * waits for health, runs Playwright, then tears everything down.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jsRoot = join(here, '..');
const repo = join(jsRoot, '..');
const example = join(repo, 'examples', 'design-vanilla');

const servers = [
  { args: [join(jsRoot, 'bin', 'tux.js'), 'design', 'start-review', '--dir', '.', '--foreground', '--port', '4181'], cwd: example, url: 'http://127.0.0.1:4181/api/tux/health' },
  { args: [join(jsRoot, 'bin', 'tux.js'), 'design', 'start-review', '--dir', '.', '--foreground', '--port', '4182', '--config', join(jsRoot, 'e2e', 'fixtures', 'config-disabled.json')], cwd: example, url: 'http://127.0.0.1:4182/api/tux/health' },
  { args: [join(jsRoot, 'e2e', 'helpers', 'static-server.mjs'), '4183'], cwd: jsRoot, url: 'http://127.0.0.1:4183/' },
];

async function waitFor(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server not ready: ${url}`);
}

const children = [];
for (const s of servers) {
  children.push(spawn(process.execPath, s.args, { cwd: s.cwd, stdio: 'ignore' }));
  await waitFor(s.url);
}

let code = 0;
try {
  execSync('npx playwright test --reporter=line', { cwd: jsRoot, stdio: 'inherit' });
} catch (e) {
  code = e.status ?? 1;
} finally {
  for (const c of children) {
    try { c.kill(); } catch { /* gone */ }
  }
}
process.exit(code);
