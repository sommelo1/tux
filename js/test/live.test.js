/**
 * Process-level integration tests: `tux live start-review/status/stop-review` with a
 * real proxied application, injection through the proxy, feedback
 * persistence across a server restart (SPC sections 39–41, 85, 89).
 *
 * @module test.review
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'tux.js');
const repo = join(bin, '..', '..', '..');
const cleanups = [];

function tux(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
}

async function waitFor(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`not ready: ${url}`);
}

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    try { fn(); } catch { /* noop */ }
  }
});

test('live start-review → proxy injects client → status → persistence across restart → stop', async () => {
  const work = mkdtempSync(join(tmpdir(), 'tux-review-'));
  cleanups.push(() => rmSync(work, { recursive: true, force: true }));

  // the "existing application"
  const app = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><title>App</title></head><body><h1 id="h">App</h1></body></html>');
  });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const appPort = app.address().port;
  cleanups.push(() => app.close());

  const cfg = { project_id: 'review-test', review: { enabled: true, store: '.tux/feedback.json', host: '127.0.0.1', port: 4186 } };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(work, 'tux.config.json'), JSON.stringify(cfg, null, 2) + '\n');

  // 1) start (attach mode)
  const started = tux(['live', 'start-review', '--url', `http://127.0.0.1:${appPort}`, '--port', '4186', '--session', 'integration'], work);
  assert.equal(started.status, 0, started.stderr);
  const state = JSON.parse(started.stdout);
  assert.equal(state.state ?? undefined, undefined);
  assert.equal(state.session_id, 'integration');
  cleanups.push(() => tux(['live', 'stop-review', '--format', 'json'], work));
  await waitFor('http://127.0.0.1:4186/api/tux/health');

  // 2) the application stays functional and gets the client injected
  const page = await fetch('http://127.0.0.1:4186/');
  const html = await page.text();
  assert.ok(html.includes('<h1 id="h">App</h1>'), 'app content preserved');
  assert.ok(html.includes('/__tux__/bootstrap.js'), 'client injected');

  // 3) feedback through the proxy API persists into the store
  const created = await fetch('http://127.0.0.1:4186/api/tux/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-TUX-User-Id': 'usr_it', 'X-TUX-Display-Name': 'IT' },
    body: JSON.stringify({ type: 'issue', text: 'Persist me', location: { route: '/' }, target: { tux_id: 'h' } }),
  });
  assert.equal(created.status, 201);
  assert.ok(existsSync(join(work, '.tux', 'feedback.json')), 'store written');

  // 4) status reports running with feedback count
  const status1 = JSON.parse(tux(['live', 'status', '--format', 'json'], work).stdout);
  assert.equal(status1.state, 'running');
  assert.equal(status1.feedback_count, 1);
  assert.equal(status1.session_id, 'integration');

  // 5) stop; feedback survives (SPC 41)
  const stopped = JSON.parse(tux(['live', 'stop-review', '--format', 'json'], work).stdout);
  assert.equal(stopped.stopped, true);
  await new Promise((r) => setTimeout(r, 500));
  const status2 = JSON.parse(tux(['live', 'status', '--format', 'json'], work).stdout);
  assert.equal(status2.state, 'stopped');
  const store = JSON.parse(readFileSync(join(work, '.tux', 'feedback.json'), 'utf8'));
  assert.equal(store.feedback.length, 1);
  assert.equal(store.feedback[0].feedback.text, 'Persist me');

  // 6) restart picks the persisted feedback up (SPC 85)
  const again = tux(['live', 'start-review', '--url', `http://127.0.0.1:${appPort}`, '--port', '4186'], work);
  assert.equal(again.status, 0, again.stderr);
  cleanups.pop(); // replace the guard cleanup: stop once at the end is enough
  await waitFor('http://127.0.0.1:4186/api/tux/health');
  const status3 = JSON.parse(tux(['live', 'status', '--format', 'json'], work).stdout);
  assert.equal(status3.feedback_count, 1);
  tux(['live', 'stop-review'], work);
});

test('live start-review --dry-run prints the plan without side effects (SPC 39)', async () => {
  const work = mkdtempSync(join(tmpdir(), 'tux-dry-'));
  cleanups.push(() => rmSync(work, { recursive: true, force: true }));
  const r = tux(['live', 'start-review', '--url', 'http://localhost:3000', '--dry-run', '--format', 'json'], work);
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.action, 'start');
  assert.equal(plan.mode, 'proxy');
  assert.equal(plan.target, 'http://localhost:3000');
  assert.ok(!existsSync(join(work, '.tux', 'server.json')), 'no runtime state written');
});

test('live start-review without url/cmd and no config store is rejected explicitly', async () => {
  const work = mkdtempSync(join(tmpdir(), 'tux-bad-'));
  cleanups.push(() => rmSync(work, { recursive: true, force: true }));
  // spawn-mode without a reachable target must fail with a server error (exit 4)
  const r = spawnSync(process.execPath, [bin, 'live', 'start-review', '--', 'node', '-e', 'setTimeout(()=>{},30000)'], {
    cwd: work, encoding: 'utf8', timeout: 60000,
  });
  assert.equal(r.status, 4, `exit ${r.status}: ${r.stderr}`);
  assert.ok(r.stderr.includes('did not become reachable') || r.stderr.includes('not become healthy'));
});
