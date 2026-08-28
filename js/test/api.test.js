/**
 * Server API tests (design mode): static hosting + injection, bootstrap,
 * feedback CRUD with identity and authorization, clear semantics.
 *
 * @module test.api
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';

const root = mkdtempSync(join(tmpdir(), 'tux-api-'));
writeFileSync(join(root, 'index.html'), '<!doctype html><html><head><title>D</title></head><body><h1 data-tux-id="hero">Hello</h1></body></html>');
mkdirSync(join(root, 'sub'), { recursive: true });

const server = startServer({
  mode: 'design',
  host: '127.0.0.1',
  port: 0,
  root,
  target: null,
  cwd: root,
  session: 'test-session',
  environment: 'design',
  config: {
    project_id: 'p-api',
    review: { enabled: true, store: '.tux/feedback.json', host: '127.0.0.1', port: 0 },
    identity: { provider: 'local', user_id: 'srv', display_name: 'Server', admins: ['usr_admin'] },
  },
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

function headers(user) {
  return user ? { 'X-TUX-User-Id': user, 'X-TUX-Display-Name': user === 'usr_admin' ? 'Admin' : 'User' } : {};
}
async function call(path, { method = 'GET', user, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers(user), ...(user ? {} : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null), res };
}

test('health endpoint', async () => {
  const { status, data } = await call('/api/tux/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.session_id, 'test-session');
});

test('session endpoint', async () => {
  const { status, data } = await call('/api/tux/session');
  assert.equal(status, 200);
  assert.equal(data.project_id, 'p-api');
  assert.equal(data.environment, 'design');
});

test('static hosting injects the review client into HTML', async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();
  assert.ok(html.includes('<script src="/__tux__/bootstrap.js"></script><script type="module" src="/__tux__/client.js"></script></head>'));
});

test('bootstrap carries identity and activation', async () => {
  const res = await fetch(`${base}/__tux__/bootstrap.js`);
  const text = await res.text();
  assert.ok(text.startsWith('window.__TUX__ = {'));
  assert.ok(text.includes('"enabled":true'));
  assert.ok(text.includes('"user":"srv"'));
  assert.ok(text.includes('"session":"test-session"'));
});

test('client.js is served', async () => {
  const res = await fetch(`${base}/__tux__/client.js`);
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('TUX Review Client'));
});

test('POST feedback creates a canonical item with header identity', async () => {
  const { status, data } = await call('/api/tux/feedback', {
    method: 'POST', user: 'usr_a',
    body: { type: 'change', text: 'Make it pop', location: { route: '/checkout' }, target: { tux_id: 'cta' }, ui_state: { step: '1' } },
  });
  assert.equal(status, 201);
  assert.equal(data.author.user_id, 'usr_a');
  assert.equal(data.origin.mode, 'design');
  assert.match(data.id, /^fb_[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(data.status, 'open');
});

test('GET feedback list filters by route', async () => {
  await call('/api/tux/feedback', { method: 'POST', user: 'usr_a', body: { type: 'issue', text: 'Other route', location: { route: '/products' } } });
  const { status, data } = await call('/api/tux/feedback?route=%2Fcheckout');
  assert.equal(status, 200);
  assert.equal(data.schema_version, '1.0');
  assert.equal(data.feedback.length, 1);
  assert.equal(data.feedback[0].location.route, '/checkout');
});

test('PATCH is owner-only', async () => {
  const created = (await call('/api/tux/feedback', { method: 'POST', user: 'usr_a', body: { type: 'issue', text: 'x' } })).data;
  const forbidden = await call(`/api/tux/feedback/${created.id}`, { method: 'PATCH', user: 'usr_b', body: { text: 'hijack' } });
  assert.equal(forbidden.status, 403);
  const ok = await call(`/api/tux/feedback/${created.id}`, { method: 'PATCH', user: 'usr_a', body: { text: 'updated' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.feedback.text, 'updated');
});

test('DELETE is owner-or-admin', async () => {
  const a = (await call('/api/tux/feedback', { method: 'POST', user: 'usr_a', body: { type: 'issue', text: 'del-a' } })).data;
  const b = (await call('/api/tux/feedback', { method: 'POST', user: 'usr_b', body: { type: 'issue', text: 'del-b' } })).data;
  assert.equal((await call(`/api/tux/feedback/${a.id}`, { method: 'DELETE', user: 'usr_b' })).status, 403);
  assert.equal((await call(`/api/tux/feedback/${a.id}`, { method: 'DELETE', user: 'usr_a' })).status, 200);
  assert.equal((await call(`/api/tux/feedback/${b.id}`, { method: 'DELETE', user: 'usr_admin' })).status, 200);
});

test('clear mine vs all (admin)', async () => {
  const before = await call('/api/tux/feedback');
  const mineBefore = before.data.feedback.filter((f) => f.author.user_id === 'usr_a').length;
  await call('/api/tux/feedback', { method: 'POST', user: 'usr_a', body: { type: 'issue', text: 'ca' } });
  await call('/api/tux/feedback', { method: 'POST', user: 'usr_b', body: { type: 'issue', text: 'cb' } });
  const mine = await call('/api/tux/feedback/clear', { method: 'POST', user: 'usr_a', body: { scope: 'mine' } });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.cleared, mineBefore + 1);
  const afterMine = await call('/api/tux/feedback');
  assert.ok(afterMine.data.feedback.every((f) => f.author.user_id !== 'usr_a'));
  const denied = await call('/api/tux/feedback/clear', { method: 'POST', user: 'usr_a', body: { scope: 'all' } });
  assert.equal(denied.status, 403);
  const all = await call('/api/tux/feedback/clear', { method: 'POST', user: 'usr_admin', body: { scope: 'all' } });
  assert.equal(all.status, 200);
  assert.ok(all.data.cleared >= 1);
  const empty = await call('/api/tux/feedback');
  assert.deepEqual(empty.data.feedback, []);
});

test('invalid feedback type rejected', async () => {
  const { status } = await call('/api/tux/feedback', { method: 'POST', user: 'usr_a', body: { type: 'bogus', text: 'x' } });
  assert.equal(status, 400);
});

after(async () => {
  await new Promise((r) => server.close(r));
  rmSync(root, { recursive: true, force: true });
});
