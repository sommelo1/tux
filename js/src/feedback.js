/**
 * Feedback operations — the deterministic primitives behind
 * `tux feedback <action>` (SPC sections 42–57).
 *
 * @module feedback
 */
import { CliError, EXIT } from './errors.js';
import { canonicalJson, compactJson } from './canonical.js';
import { nowMs, canonicalTimestamp, newId } from './ids.js';
import { FEEDBACK_TYPES, FEEDBACK_STATUSES, makeFeedback, normalizedText, validateFeedback } from './schema.js';
import {
  loadStore, saveStore, storeExists, ensureSession,
  countIncorporationBatches, saveIncorporationBatch,
} from './store.js';
import { resolveIdentity } from './config.js';

/** Options shared by every action: {cwd, config, identity, format, time}. */
function ctx(opts) {
  return {
    cwd: opts.cwd,
    config: opts.config,
    identity: opts.identity ?? resolveIdentity(opts.config),
    format: opts.format ?? 'text',
    now: opts.now ?? nowMs(),
    timestamp: canonicalTimestamp(opts.now ?? nowMs()),
  };
}

export function opList(opts, filters) {
  const c = ctx(opts);
  const store = loadStore(c.cwd, c.config);
  let items = store.feedback;
  if (filters.status) items = items.filter((f) => f.status === filters.status);
  if (filters.type) items = items.filter((f) => f.feedback.type === filters.type);
  if (filters.mine) items = items.filter((f) => f.author.user_id === c.identity.user_id);
  if (filters.route) items = items.filter((f) => f.location?.route === filters.route);
  if (filters.session) items = items.filter((f) => f.session_id === filters.session);
  if (c.format === 'json') return { stdout: canonicalJson(items) + '\n', exit: EXIT.ok };
  const lines = items.map((f) =>
    [f.id, f.status, f.feedback.type, f.location?.route ?? '-', firstLine(f.feedback.text)].join('\t')
  );
  return { stdout: (lines.length ? lines.join('\n') + '\n' : ''), exit: EXIT.ok };
}

export function opShow(opts, id) {
  const c = ctx(opts);
  const store = loadStore(c.cwd, c.config);
  const item = store.feedback.find((f) => f.id === id);
  if (!item) throw new CliError(EXIT.notFound, `feedback not found: ${id}`);
  return { stdout: canonicalJson(item) + '\n', exit: EXIT.ok };
}

export function opCreate(opts, spec) {
  const c = ctx(opts);
  if (!FEEDBACK_TYPES.includes(spec.type)) {
    throw new CliError(EXIT.usage, `invalid feedback type: ${spec.type} (expected ${FEEDBACK_TYPES.join(', ')})`);
  }
  if (!spec.text || spec.text.trim() === '') throw new CliError(EXIT.usage, '--text is required');
  const store = loadStore(c.cwd, c.config);
  const seq = store.feedback.length + 1;
  const id = newId('fb', store.project_id, spec.session ?? 'default', seq, 'feedback', c.now);
  const item = makeFeedback({
    id,
    project_id: store.project_id,
    session_id: spec.session ?? 'default',
    author: { user_id: c.identity.user_id, display_name: c.identity.display_name },
    origin: spec.origin ?? 'design',
    location: {
      ...(spec.route ? { route: spec.route } : {}),
      ...(spec.page ? { page: spec.page } : {}),
      ...(spec.component ? { component: spec.component } : {}),
      ...(spec.instance ? { component_instance: spec.instance } : {}),
    },
    target: {
      ...(spec.tuxId ? { tux_id: spec.tuxId } : {}),
      ...(spec.testId ? { test_id: spec.testId } : {}),
    },
    ui_state: spec.uiState ?? {},
    type: spec.type,
    text: spec.text,
    created_at: c.timestamp,
  });
  const problems = validateFeedback(item);
  if (problems.length) throw new CliError(EXIT.general, `created item invalid: ${problems.join('; ')}`);
  store.feedback.push(item);
  saveStore(c.cwd, c.config, store);
  if (spec.session) ensureSession(c.cwd, c.config, spec.session, spec.environment ?? 'design', c.timestamp);
  return { stdout: canonicalJson(item) + '\n', exit: EXIT.ok };
}

export function opUpdate(opts, id, patch) {
  const c = ctx(opts);
  const store = loadStore(c.cwd, c.config);
  const item = store.feedback.find((f) => f.id === id);
  if (!item) throw new CliError(EXIT.notFound, `feedback not found: ${id}`);
  if (patch.status !== undefined && !FEEDBACK_STATUSES.includes(patch.status)) {
    throw new CliError(EXIT.usage, `invalid status: ${patch.status} (expected ${FEEDBACK_STATUSES.join(', ')})`);
  }
  if (patch.type !== undefined && !FEEDBACK_TYPES.includes(patch.type)) {
    throw new CliError(EXIT.usage, `invalid feedback type: ${patch.type} (expected ${FEEDBACK_TYPES.join(', ')})`);
  }
  if (patch.text !== undefined) item.feedback.text = patch.text;
  if (patch.type !== undefined) item.feedback.type = patch.type;
  if (patch.status !== undefined) item.status = patch.status;
  if (patch.incorporation !== undefined) item.incorporation = patch.incorporation;
  item.updated_at = c.timestamp;
  saveStore(c.cwd, c.config, store);
  return { stdout: canonicalJson(item) + '\n', exit: EXIT.ok };
}

export function opDelete(opts, id) {
  const c = ctx(opts);
  const store = loadStore(c.cwd, c.config);
  const idx = store.feedback.findIndex((f) => f.id === id);
  if (idx === -1) throw new CliError(EXIT.notFound, `feedback not found: ${id}`);
  store.feedback.splice(idx, 1);
  saveStore(c.cwd, c.config, store);
  if (c.format === 'json') return { stdout: canonicalJson({ deleted: [id] }) + '\n', exit: EXIT.ok };
  return { stdout: `deleted ${id}\n`, exit: EXIT.ok };
}

export function opClear(opts, scope, filters) {
  const c = ctx(opts);
  if (scope === 'all' && !filters.force) {
    throw new CliError(EXIT.usage, '--all requires explicit confirmation (--force)');
  }
  if (!scope) throw new CliError(EXIT.usage, 'specify --mine or --all');
  const store = loadStore(c.cwd, c.config);
  const before = store.feedback.length;
  store.feedback = store.feedback.filter((f) => {
    if (scope === 'mine' && f.author.user_id !== c.identity.user_id) return true;
    if (filters.route && f.location?.route !== filters.route) return true;
    if (filters.session && f.session_id !== filters.session) return true;
    return false;
  });
  const cleared = before - store.feedback.length;
  saveStore(c.cwd, c.config, store);
  if (c.format === 'json') return { stdout: canonicalJson({ cleared }) + '\n', exit: EXIT.ok };
  return { stdout: `cleared ${cleared}\n`, exit: EXIT.ok };
}

export function opExport(opts, format) {
  const c = ctx(opts);
  const store = loadStore(c.cwd, c.config);
  if (format === 'jsonl') {
    const out = store.feedback.map((f) => compactJson(f)).join('\n');
    return { stdout: (out ? out + '\n' : ''), exit: EXIT.ok };
  }
  return { stdout: canonicalJson(store.feedback) + '\n', exit: EXIT.ok };
}

export function storeIsEmpty(opts) {
  return !storeExists(opts.cwd, opts.config);
}

/** Canonical target key for grouping (SPC section 50). */
export function targetKey(item) {
  return [
    item.location?.route ?? '',
    item.location?.page ?? '',
    item.location?.component ?? '',
    item.location?.component_instance ?? '',
    item.target?.tux_id ?? '',
    item.target?.test_id ?? '',
  ].join('|');
}

export function opIncorporate(opts, strategy, filters) {
  const c = ctx(opts);
  const STRATEGIES = ['consolidate', 'requirements', 'tasks', 'direct', 'export-only'];
  if (strategy === undefined) {
    throw new CliError(EXIT.usage, `--strategy is required in non-interactive mode (one of ${STRATEGIES.join(', ')})`);
  }
  if (!STRATEGIES.includes(strategy)) {
    throw new CliError(EXIT.usage, `invalid strategy: ${strategy} (expected ${STRATEGIES.join(', ')})`);
  }
  const store = loadStore(c.cwd, c.config);
  let open = store.feedback.filter((f) => f.status === 'open');
  if (filters.mine) open = open.filter((f) => f.author.user_id === c.identity.user_id);
  if (filters.route) open = open.filter((f) => f.location?.route === filters.route);
  if (filters.session) open = open.filter((f) => f.session_id === filters.session);

  const groups = [];
  const byKey = new Map();
  for (const item of open) {
    const key = targetKey(item);
    if (!byKey.has(key)) {
      const group = { key, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(item);
  }

  const reportGroups = [];
  const incorporated = [];
  const conflicts = [];
  for (const group of groups) {
    const items = group.items;
    const kinds = new Set(items.map((i) => i.feedback.type));
    const isConflict = kinds.has('approval') && (kinds.has('change') || kinds.has('issue') || kinds.has('question'));
    if (isConflict) {
      reportGroups.push({ key: group.key, kind: 'conflict', requires_decision: true, feedback_ids: items.map((i) => i.id) });
      for (const i of items) conflicts.push(i.id);
      continue;
    }
    let kind = 'unique';
    if (items.length > 1) {
      const first = normalizedText(items[0].feedback.text);
      kind = items.every((i) => normalizedText(i.feedback.text) === first) ? 'duplicate' : 'unique';
    }
    reportGroups.push({ key: group.key, kind, requires_decision: false, feedback_ids: items.map((i) => i.id) });
    if (strategy !== 'export-only') {
      for (const i of items) {
        i.status = 'incorporated';
        i.incorporation = { strategy, batch_id: null, recorded_at: c.timestamp };
        incorporated.push(i.id);
      }
    }
  }

  const seq = countIncorporationBatches(c.cwd) + 1;
  const batchId = newId('batch', store.project_id, 'default', seq, 'batch', c.now);
  const report = {
    schema_version: '1.0',
    batch_id: batchId,
    strategy,
    created_at: c.timestamp,
    groups: reportGroups,
    incorporated,
    conflicts,
  };
  if (strategy !== 'export-only') {
    for (const item of store.feedback) {
      if (item.incorporation?.batch_id === null && incorporated.includes(item.id)) {
        item.incorporation.batch_id = batchId;
      }
    }
    saveStore(c.cwd, c.config, store);
    saveIncorporationBatch(c.cwd, report);
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}

export function opValidate(opts, args) {
  const c = ctx(opts);
  if (args.record !== undefined) {
    if (!['passed', 'failed'].includes(args.result)) {
      throw new CliError(EXIT.usage, `invalid validation result: ${args.result} (expected passed, failed)`);
    }
    const store = loadStore(c.cwd, c.config);
    const item = store.feedback.find((f) => f.id === args.record);
    if (!item) throw new CliError(EXIT.notFound, `feedback not found: ${args.record}`);
    item.validation = { result: args.result, checked_at: c.timestamp, ...(args.note ? { note: args.note } : {}) };
    item.updated_at = c.timestamp;
    saveStore(c.cwd, c.config, store);
    return { stdout: canonicalJson(item) + '\n', exit: EXIT.ok };
  }
  const store = loadStore(c.cwd, c.config);
  const items = store.feedback
    .filter((f) => f.status === 'incorporated')
    .map((f) => ({
      id: f.id,
      location_route: f.location?.route ?? null,
      validation_result: f.validation?.result ?? 'unvalidated',
    }));
  const summary = {
    total: items.length,
    passed: items.filter((i) => i.validation_result === 'passed').length,
    failed: items.filter((i) => i.validation_result === 'failed').length,
    unvalidated: items.filter((i) => i.validation_result === 'unvalidated').length,
  };
  let exit = EXIT.ok;
  if (args.strict && (summary.failed > 0 || summary.unvalidated > 0)) exit = EXIT.general;
  if (c.format === 'json') {
    return { stdout: canonicalJson({ schema_version: '1.0', summary, items }) + '\n', exit };
  }
  const lines = items.map((i) => [i.id, i.validation_result].join('\t'));
  return { stdout: (lines.length ? lines.join('\n') + '\n' : '') + `total ${summary.total}, passed ${summary.passed}, failed ${summary.failed}, unvalidated ${summary.unvalidated}\n`, exit };
}

function firstLine(text) {
  return String(text).split('\n')[0];
}
