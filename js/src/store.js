/**
 * JSON persistence backend (SPC section 22): a single canonical JSON file
 * at `review.store` (default `.tux/feedback.json`), plus review sessions
 * under `.tux/sessions/` and incorporation batches under
 * `.tux/incorporations/`. The logical schema is independent of the
 * storage backend; agents go through the CLI/API, never the file layout.
 *
 * @module store
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from './canonical.js';
import { SCHEMA_VERSION } from './schema.js';

export function storeFilePath(cwd, config) {
  return join(cwd, config.review.store);
}

export function loadStore(cwd, config) {
  const p = storeFilePath(cwd, config);
  if (!existsSync(p)) return { schema_version: SCHEMA_VERSION, project_id: config.project_id, feedback: [] };
  const store = JSON.parse(readFileSync(p, 'utf8'));
  if (store.feedback === undefined) store.feedback = [];
  return store;
}

export function saveStore(cwd, config, store) {
  const p = storeFilePath(cwd, config);
  mkdirSync(join(cwd, '.tux'), { recursive: true });
  writeFileSync(p, canonicalJson(store) + '\n', 'utf8');
}

export function storeExists(cwd, config) {
  return existsSync(storeFilePath(cwd, config));
}

/** Sessions directory handling. */
export function sessionsDir(cwd) {
  return join(cwd, '.tux', 'sessions');
}

export function ensureSession(cwd, config, sessionId, environment, timestamp) {
  mkdirSync(sessionsDir(cwd), { recursive: true });
  const p = join(sessionsDir(cwd), `${sessionId}.json`);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  const session = {
    session_id: sessionId,
    project_id: config.project_id,
    environment,
    status: 'active',
    created_at: timestamp,
  };
  writeFileSync(p, canonicalJson(session) + '\n', 'utf8');
  return session;
}

/** Incorporation batches directory handling. */
export function incorporationsDir(cwd) {
  return join(cwd, '.tux', 'incorporations');
}

export function countIncorporationBatches(cwd) {
  const dir = incorporationsDir(cwd);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;
}

export function saveIncorporationBatch(cwd, batch) {
  mkdirSync(incorporationsDir(cwd), { recursive: true });
  const p = join(incorporationsDir(cwd), `${batch.batch_id}.json`);
  writeFileSync(p, canonicalJson(batch) + '\n', 'utf8');
  return p;
}
