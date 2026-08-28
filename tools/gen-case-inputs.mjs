#!/usr/bin/env node
/**
 * Regenerates the hand-authored case.json inputs under conformance/.
 * Expected outputs are produced by tools/gen-expected.mjs (after the JS
 * reference implementation) and then frozen as source of truth.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'conformance');

const S3 = 'fixtures/store-three.json';
const SINC = 'fixtures/store-incorporated-open.json';

const A = 'fb_01J6F91H1J8KA0A0A0A0A0A0A0';
const B = 'fb_01J6F91H1J8KB0B0B0B0B0B0B0';
const C = 'fb_01J6F91H1J8KC0C0C0C0C0C0C0';

const item = (id, route, type, text, userId, displayName, extra = {}) => ({
  schema_version: '1.0',
  id,
  project_id: 'checkout-redesign',
  session_id: 'review_2026_08_28',
  author: { user_id: userId, display_name: displayName },
  origin: { mode: 'design' },
  location: { route, ...(extra.location || {}) },
  target: extra.target || {},
  ui_state: extra.ui_state || {},
  feedback: { type, text },
  status: extra.status || 'open',
  created_at: extra.created_at,
  updated_at: extra.updated_at ?? extra.created_at,
});

const three = {
  schema_version: '1.0',
  project_id: 'checkout-redesign',
  feedback: [
    item(A, '/checkout/payment', 'change', 'The primary CTA should be more prominent.', 'usr_8f3a12', 'Lorenz', {
      location: { component: 'PaymentMethodCard', component_instance: 'visa-ending-1234' },
      target: { tux_id: 'payment-submit', role: 'button', accessible_name: 'Continue', text: 'Continue' },
      ui_state: { payment_method: 'credit-card', step: '2' },
      created_at: '2026-08-28T12:20:00.000Z',
    }),
    item(B, '/products', 'issue', 'Price label overlaps the discount badge.', 'usr_6c21bd', 'Kim', {
      target: { tux_id: 'price-label' },
      created_at: '2026-08-28T12:25:00.000Z',
    }),
    item(C, '/checkout/payment', 'question', 'Should the coupon field stay on this step?', 'usr_8f3a12', 'Lorenz', {
      status: 'resolved',
      created_at: '2026-08-28T12:30:00.000Z',
      updated_at: '2026-08-28T12:40:00.000Z',
    }),
  ],
};

// Store used by incorporate cases: duplicates D/E, conflict pair F/G, unique H.
const D = 'fb_01J6F91H1J8KD0D0D0D0D0D0D0';
const E = 'fb_01J6F91H1J8KE0E0E0E0E0E0E0';
const F = 'fb_01J6F91H1J8KF0F0F0F0F0F0F0';
const G = 'fb_01J6F91H1J8KG0G0G0G0G0G0G0';
const H = 'fb_01J6F91H1J8KH0H0H0H0H0H0H0';
const incorporatedOpen = {
  schema_version: '1.0',
  project_id: 'checkout-redesign',
  feedback: [
    item(D, '/checkout', 'change', 'Make the CTA bigger.', 'usr_8f3a12', 'Lorenz', { target: { tux_id: 'cta' }, created_at: '2026-08-28T12:20:00.000Z' }),
    item(E, '/checkout', 'change', 'make  the CTA bigger', 'usr_6c21bd', 'Kim', { target: { tux_id: 'cta' }, created_at: '2026-08-28T12:21:00.000Z' }),
    item(F, '/checkout', 'approval', 'Totals look good.', 'usr_6c21bd', 'Kim', { target: { tux_id: 'totals' }, created_at: '2026-08-28T12:22:00.000Z' }),
    item(G, '/checkout', 'change', 'Move totals above the coupon field.', 'usr_8f3a12', 'Lorenz', { target: { tux_id: 'totals' }, created_at: '2026-08-28T12:23:00.000Z' }),
    item(H, '/products', 'question', 'Add size chart link?', 'usr_8f3a12', 'Lorenz', { created_at: '2026-08-28T12:24:00.000Z' }),
  ],
};

// Store used by validate --record: incorporated items without validation yet.
const validatedOpen = {
  schema_version: '1.0',
  project_id: 'checkout-redesign',
  feedback: [
    item(D, '/checkout', 'change', 'Make the CTA bigger.', 'usr_8f3a12', 'Lorenz', {
      status: 'incorporated', target: { tux_id: 'cta' }, created_at: '2026-08-28T12:20:00.000Z',
    }),
    item(F, '/checkout', 'approval', 'Totals look good.', 'usr_6c21bd', 'Kim', {
      status: 'incorporated', target: { tux_id: 'totals' }, created_at: '2026-08-28T12:22:00.000Z',
    }),
  ],
};

// Store used by validate cases: one incorporated+validated, one incorporated unvalidated.
const validated = {
  schema_version: '1.0',
  project_id: 'checkout-redesign',
  feedback: [
    item(D, '/checkout', 'change', 'Make the CTA bigger.', 'usr_8f3a12', 'Lorenz', {
      status: 'incorporated', target: { tux_id: 'cta' }, created_at: '2026-08-28T12:20:00.000Z',
      validation: { result: 'passed', checked_at: '2026-08-28T15:00:00.000Z', note: 'CTA is prominent now' },
    }),
    item(F, '/checkout', 'approval', 'Totals look good.', 'usr_6c21bd', 'Kim', {
      status: 'incorporated', target: { tux_id: 'totals' }, created_at: '2026-08-28T12:22:00.000Z',
    }),
  ],
};

function w(rel, obj) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function data(rel, obj) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

data(S3, three);
data(SINC, incorporatedOpen);
data('fixtures/store-validated-open.json', validatedOpen);
data('fixtures/store-validated.json', validated);

const T = '2026-08-28T12:20:00Z';
const idEnv = { TUX_USER_ID: 'usr_8f3a12', TUX_DISPLAY_NAME: 'Lorenz' };

w('feedback/create-basic/case.json', {
  args: ['feedback', 'create', '--type', 'change', '--text', 'The primary CTA should be more prominent.',
    '--route', '/checkout/payment', '--component', 'PaymentMethodCard', '--component-instance', 'visa-ending-1234',
    '--tux-id', 'payment-submit', '--session', 'review_2026_08_28', '--origin', 'design', '--format', 'json'],
  env: { ...idEnv, TUX_TIME_OVERRIDE: T },
  files: { 'tux.config.json': JSON.stringify({ project_id: 'checkout-redesign' }, null, 2) + '\n' },
});
w('feedback/create-invalid-type/case.json', { args: ['feedback', 'create', '--type', 'bogus', '--text', 'x'], env: {} });
w('feedback/create-missing-text/case.json', { args: ['feedback', 'create', '--type', 'change'], env: {} });
w('feedback/list-empty/case.json', { args: ['feedback', 'list', '--format', 'json'], env: {} });
w('feedback/list-filter-status/case.json', { args: ['feedback', 'list', '--status', 'open', '--format', 'json'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/list-filter-mine/case.json', { args: ['feedback', 'list', '--mine'], env: { TUX_USER_ID: 'usr_8f3a12' }, include: { '.tux/feedback.json': S3 } });
w('feedback/list-text/case.json', { args: ['feedback', 'list'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/list-route/case.json', { args: ['feedback', 'list', '--route', '/products'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/show/case.json', { args: ['feedback', 'show', A], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/show-missing/case.json', { args: ['feedback', 'show', 'fb_MISSING000000000000000000'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/update-status/case.json', { args: ['feedback', 'update', A, '--status', 'incorporated'], env: { TUX_TIME_OVERRIDE: '2026-08-28T13:00:00Z' }, include: { '.tux/feedback.json': S3 } });
w('feedback/update-missing/case.json', { args: ['feedback', 'update', 'fb_MISSING000000000000000000', '--status', 'resolved'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/delete/case.json', { args: ['feedback', 'delete', B, '--format', 'json'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/delete-missing/case.json', { args: ['feedback', 'delete', 'fb_MISSING000000000000000000'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/clear-mine/case.json', { args: ['feedback', 'clear', '--mine', '--format', 'json'], env: { TUX_USER_ID: 'usr_8f3a12' }, include: { '.tux/feedback.json': S3 } });
w('feedback/clear-all-no-force/case.json', { args: ['feedback', 'clear', '--all'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/clear-all-force/case.json', { args: ['feedback', 'clear', '--all', '--force', '--format', 'json'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/export-json/case.json', { args: ['feedback', 'export', '--format', 'json'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/export-jsonl/case.json', { args: ['feedback', 'export', '--format', 'jsonl'], env: {}, include: { '.tux/feedback.json': S3 } });
w('feedback/incorporate-tasks/case.json', { args: ['feedback', 'incorporate', '--strategy', 'tasks', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T14:00:00Z' }, include: { '.tux/feedback.json': SINC } });
w('feedback/incorporate-no-strategy/case.json', { args: ['feedback', 'incorporate'], env: {}, include: { '.tux/feedback.json': SINC } });
w('feedback/validate-record/case.json', { args: ['feedback', 'validate', '--record', D, '--result', 'passed', '--note', 'CTA is prominent now'], env: { TUX_TIME_OVERRIDE: '2026-08-28T15:00:00Z' }, include: { '.tux/feedback.json': 'fixtures/store-validated-open.json' } });
w('feedback/validate-report-strict/case.json', { args: ['feedback', 'validate', '--strict', '--format', 'json'], env: {}, include: { '.tux/feedback.json': 'fixtures/store-validated.json' } });
w('config/env-beats-config/case.json', {
  args: ['feedback', 'create', '--type', 'issue', '--text', 'Env wins'],
  env: { TUX_USER_ID: 'usr_env01', TUX_DISPLAY_NAME: 'Env User', TUX_TIME_OVERRIDE: T },
  files: { 'tux.config.json': JSON.stringify({ project_id: 'p1', identity: { provider: 'local', user_id: 'usr_cfg01', display_name: 'Config User' } }, null, 2) + '\n' },
});
w('design/install-basic/case.json', { args: ['design', 'install', '--framework', 'vanilla', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: {} });
w('design/create-vanilla/case.json', { args: ['design', 'create', '--framework', 'vanilla', '--name', 'checkout', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: { 'tux.config.json': JSON.stringify({ project_id: 'shop' }, null, 2) + '\n' } });
w('design/create-react/case.json', { args: ['design', 'create', '--framework', 'react', '--name', 'checkout', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: { 'tux.config.json': JSON.stringify({ project_id: 'shop' }, null, 2) + '\n' } });
w('design/create-vue/case.json', { args: ['design', 'create', '--framework', 'vue', '--name', 'checkout', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: { 'tux.config.json': JSON.stringify({ project_id: 'shop' }, null, 2) + '\n' } });
w('design/create-angular/case.json', { args: ['design', 'create', '--framework', 'angular', '--name', 'checkout', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: { 'tux.config.json': JSON.stringify({ project_id: 'shop' }, null, 2) + '\n' } });
w('design/create-unknown/case.json', { args: ['design', 'create', '--framework', 'svelte', '--name', 'x'], env: {} });
w('design/start-dry-run/case.json', { args: ['design', 'start-review', '--dry-run', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: {} });
w('design/status-stopped/case.json', { args: ['design', 'status', '--format', 'json'], env: {} });
w('live/create-vanilla/case.json', { args: ['live', 'create', '--framework', 'vanilla', '--name', 'checkout', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: { 'tux.config.json': JSON.stringify({ project_id: 'shop' }, null, 2) + '\n' } });
w('live/start-dry-run/case.json', { args: ['live', 'start-review', '--url', 'http://localhost:3000', '--dry-run', '--format', 'json'], env: { TUX_TIME_OVERRIDE: '2026-08-28T12:00:00Z' }, files: {} });
w('live/status-stopped/case.json', { args: ['live', 'status', '--format', 'json'], env: {} });
w('cli/unknown-command/case.json', { args: ['widget', 'spin'], env: {} });
w('cli/version/case.json', { args: ['--version'], env: {} });

console.log('case inputs regenerated');
