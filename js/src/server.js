/**
 * TUX review/design server (framework-agnostic, zero dependencies).
 *
 * Two modes:
 * - `design`: serves a static design directory from disk, injecting the
 *   Review Client into every HTML response.
 * - `review`: reverse-proxies an existing application, injecting the
 *   Review Client into HTML responses on the way through.
 *
 * Endpoints (canonical API):
 * - GET  /api/tux/health
 * - GET  /api/tux/session
 * - GET  /api/tux/feedback[?route=&status=&type=&mine=&session=]
 * - POST /api/tux/feedback
 * - GET  /api/tux/feedback/{id}
 * - PATCH /api/tux/feedback/{id}        (owner only)
 * - DELETE /api/tux/feedback/{id}       (owner or admin)
 * - POST /api/tux/feedback/clear        {scope:"mine"|"all",route?,session?}
 * - GET  /__tux__/bootstrap.js          activation + identity bootstrap
 * - GET  /__tux__/client.js             the Review Client module
 * - GET  /__tux__/client.css            Review Client styles
 *
 * @module server
 */
import { createServer, request as httpRequest } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './canonical.js';
import { canonicalTimestamp, nowMs, newId } from './ids.js';
import { FEEDBACK_TYPES, makeFeedback, SCHEMA_VERSION } from './schema.js';
import { loadStore, saveStore, ensureSession } from './store.js';
import { resolveIdentity } from './config.js';

const CLIENT_DIR = fileURLToPath(new URL('../client/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/**
 * @param {object} opts
 * @param {'design'|'review'} opts.mode
 * @param {string} opts.host bind host
 * @param {number} opts.port bind port
 * @param {string|null} opts.root static root (design mode)
 * @param {string|null} opts.target proxy target (review mode)
 * @param {string} opts.cwd project cwd for store access
 * @param {object} opts.config resolved project config
 * @param {string} opts.session session id exposed to clients
 * @param {string} opts.environment environment label
 */
export function startServer(opts) {
  const state = {
    ...opts,
    root: opts.root ? resolve(opts.cwd, opts.root) : null,
    identity: resolveIdentity(opts.config),
    startedAt: canonicalTimestamp(nowMs()),
  };
  ensureSession(opts.cwd, opts.config, opts.session, opts.environment, state.startedAt);
  const server = createServer((req, res) => {
    handle(state, req, res).catch((err) => {
      sendJson(res, 500, { error: { code: 'internal', message: String(err && err.message ? err.message : err) } });
    });
  });
  return server;
}

async function handle(state, req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  if (path === '/api/tux/health') {
    return sendJson(res, 200, { status: 'ok', mode: state.mode, session_id: state.session });
  }
  if (path.startsWith('/api/tux/')) return api(state, req, res, url);
  if (path.startsWith('/__tux__/')) return assets(state, res, path);

  if (state.mode === 'design') return static_(state, res, path);
  return proxy(state, req, res);
}

function identityOf(state, req) {
  const userId = req.headers['x-tux-user-id'] ?? state.identity.user_id;
  const displayName = req.headers['x-tux-display-name'] ?? state.identity.display_name;
  return { user_id: String(userId), display_name: String(displayName) };
}

function isAdmin(state, userId) {
  return (state.identity.admins ?? []).includes(userId);
}

async function api(state, req, res, url) {
  const path = url.pathname;
  const identity = identityOf(state, req);
  const method = req.method ?? 'GET';

  if (path === '/api/tux/session' && method === 'GET') {
    return sendJson(res, 200, {
      session_id: state.session,
      project_id: state.config.project_id,
      environment: state.environment,
      status: 'active',
    });
  }

  if (path === '/api/tux/feedback' && method === 'GET') {
    const store = loadStore(state.cwd, state.config);
    let items = store.feedback;
    const q = url.searchParams;
    if (q.get('route')) items = items.filter((f) => f.location?.route === q.get('route'));
    if (q.get('status')) items = items.filter((f) => f.status === q.get('status'));
    if (q.get('type')) items = items.filter((f) => f.feedback.type === q.get('type'));
    if (q.get('session')) items = items.filter((f) => f.session_id === q.get('session'));
    if (q.get('mine') === '1' || q.get('mine') === 'true') items = items.filter((f) => f.author.user_id === identity.user_id);
    return sendJson(res, 200, { schema_version: SCHEMA_VERSION, project_id: store.project_id, feedback: items });
  }

  if (path === '/api/tux/feedback' && method === 'POST') {
    const body = await readJson(req);
    if (body.error) return sendJson(res, 400, { error: { code: 'invalid', message: body.error } });
    const data = body.data ?? {};
    const type = data.type ?? 'issue';
    if (!FEEDBACK_TYPES.includes(type)) {
      return sendJson(res, 400, { error: { code: 'invalid', message: `invalid feedback type: ${type}` } });
    }
    const text = typeof data.text === 'string' ? data.text : '';
    if (text.trim() === '') return sendJson(res, 400, { error: { code: 'invalid', message: 'text is required' } });
    const store = loadStore(state.cwd, state.config);
    const session = data.session_id ?? state.session;
    const seq = store.feedback.length + 1;
    const id = newId('fb', store.project_id, session, seq, 'feedback', nowMs());
    const item = makeFeedback({
      id,
      project_id: store.project_id,
      session_id: session,
      author: identity,
      origin: state.mode === 'design' ? 'design' : 'review',
      location: data.location ?? {},
      target: data.target ?? {},
      ui_state: data.ui_state ?? {},
      type,
      text,
      created_at: canonicalTimestamp(nowMs()),
    });
    store.feedback.push(item);
    saveStore(state.cwd, state.config, store);
    return sendJson(res, 201, item);
  }

  if (path === '/api/tux/feedback/clear' && method === 'POST') {
    const body = await readJson(req);
    if (body.error) return sendJson(res, 400, { error: { code: 'invalid', message: body.error } });
    const scope = body.data?.scope;
    if (scope !== 'mine' && scope !== 'all') {
      return sendJson(res, 400, { error: { code: 'invalid', message: 'scope must be "mine" or "all"' } });
    }
    if (scope === 'all' && !isAdmin(state, identity.user_id)) {
      return sendJson(res, 403, { error: { code: 'forbidden', message: 'clearing all feedback requires admin' } });
    }
    const route = body.data?.route;
    const session = body.data?.session;
    const store = loadStore(state.cwd, state.config);
    const before = store.feedback.length;
    store.feedback = store.feedback.filter((f) => {
      if (scope === 'mine' && f.author.user_id !== identity.user_id) return true;
      if (route && f.location?.route !== route) return true;
      if (session && f.session_id !== session) return true;
      return false;
    });
    const cleared = before - store.feedback.length;
    saveStore(state.cwd, state.config, store);
    return sendJson(res, 200, { cleared });
  }

  const feedbackMatch = path.match(/^\/api\/tux\/feedback\/([^/]+)$/);
  if (feedbackMatch) {
    const id = decodeURIComponent(feedbackMatch[1]);
    const store = loadStore(state.cwd, state.config);
    const idx = store.feedback.findIndex((f) => f.id === id);
    if (idx === -1) return sendJson(res, 404, { error: { code: 'not_found', message: `feedback not found: ${id}` } });
    const item = store.feedback[idx];
    if (method === 'GET') return sendJson(res, 200, item);
    if (method === 'PATCH') {
      if (item.author.user_id !== identity.user_id) {
        return sendJson(res, 403, { error: { code: 'forbidden', message: 'only the author may update this feedback' } });
      }
      const body = await readJson(req);
      if (body.error) return sendJson(res, 400, { error: { code: 'invalid', message: body.error } });
      const patch = body.data ?? {};
      if (patch.text !== undefined) item.feedback.text = String(patch.text);
      if (patch.type !== undefined) {
        if (!FEEDBACK_TYPES.includes(patch.type)) return sendJson(res, 400, { error: { code: 'invalid', message: `invalid feedback type: ${patch.type}` } });
        item.feedback.type = patch.type;
      }
      item.updated_at = canonicalTimestamp(nowMs());
      saveStore(state.cwd, state.config, store);
      return sendJson(res, 200, item);
    }
    if (method === 'DELETE') {
      const owner = item.author.user_id === identity.user_id;
      if (!owner && !isAdmin(state, identity.user_id)) {
        return sendJson(res, 403, { error: { code: 'forbidden', message: 'only the author or an admin may delete this feedback' } });
      }
      store.feedback.splice(idx, 1);
      saveStore(state.cwd, state.config, store);
      return sendJson(res, 200, { deleted: [id] });
    }
  }

  return sendJson(res, 404, { error: { code: 'not_found', message: `unknown API path: ${path}` } });
}

function assets(state, res, path) {
  if (path === '/__tux__/bootstrap.js') {
    const bootstrap = `window.__TUX__ = ${JSON.stringify({
      enabled: state.config.review?.enabled !== false, // startup configuration (SPC 64–65)
      build: 'included',
      mode: state.mode,
      apiBase: '/api/tux',
      session: state.session,
      environment: state.environment,
      user: state.identity.user_id,
      displayName: state.identity.display_name,
      project: state.config.project_id,
    })};\n`;
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(bootstrap);
    return;
  }
  if (path === '/__tux__/client.js' || path === '/__tux__/client.css') {
    const file = join(CLIENT_DIR, path === '/__tux__/client.js' ? 'tux-review.js' : 'tux-review.css');
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

function static_(state, res, path) {
  let rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
  if (rel === '') rel = 'index.html';
  let file = join(state.root, rel);
  if (!file.startsWith(state.root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const candidates = [join(file, 'index.html'), file + '.html'];
    file = candidates.find((c) => existsSync(c) && statSync(c).isFile());
    if (!file) {
      // SPA fallback: unknown extension-less routes render the app shell
      if (!extname(path)) file = join(state.root, 'index.html');
      if (!existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
    }
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  const body = readFileSync(file);
  if (type.startsWith('text/html')) {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(inject(body.toString('utf8')));
    return;
  }
  res.writeHead(200, { 'Content-Type': type });
  res.end(body);
}

function proxy(state, req, res) {
  const target = new URL(state.target);
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };
  const upstream = httpRequest(options, (up) => {
    const type = up.headers['content-type'] ?? '';
    if (type.startsWith('text/html')) {
      const chunks = [];
      up.on('data', (c) => chunks.push(c));
      up.on('end', () => {
        res.writeHead(up.statusCode, up.headers);
        res.end(inject(Buffer.concat(chunks).toString('utf8')));
      });
      return;
    }
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    sendJson(res, 502, { error: { code: 'bad_gateway', message: `target unreachable: ${err.message}` } });
  });
  req.pipe(upstream);
}

/** Inject the TUX bootstrap + client into an HTML document. */
export function inject(html) {
  const tags = '<script src="/__tux__/bootstrap.js"></script><script type="module" src="/__tux__/client.js"></script>';
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tags}</head>`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tags}</body>`);
  return html + tags;
}

function readJson(req) {
  return new Promise((resolvePromise) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw === '') return resolvePromise({ data: {} });
      try {
        resolvePromise({ data: JSON.parse(raw) });
      } catch (e) {
        resolvePromise({ error: `invalid JSON: ${e.message}` });
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(canonicalJson(data));
}
