/**
 * `tux review <action>` — integrate, start, status, stop (SPC sections 32–41).
 *
 * @module review
 */
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CliError, EXIT } from './errors.js';
import { canonicalJson } from './canonical.js';
import { canonicalTimestamp } from './ids.js';
import { loadStore } from './store.js';

const SERVER_STATE_FILE = '.tux/server.json';

async function health(url) {
  try {
    const r = await fetch(joinUrl(url, '/api/tux/health'), { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return false;
    await r.json();
    return true;
  } catch {
    return false;
  }
}

function joinUrl(base, path) {
  return base.replace(/\/+$/, '') + path;
}

export function opReviewIntegrate(opts) {
  const cwd = opts.cwd;
  const pkgPath = join(cwd, 'package.json');
  const hasPkg = existsSync(pkgPath);
  const hasIndex = existsSync(join(cwd, 'index.html'));
  if (!hasPkg && !hasIndex) {
    throw new CliError(EXIT.config, 'unsupported setup: no package.json or index.html found in the current directory');
  }
  let pkg = {};
  if (hasPkg) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      throw new CliError(EXIT.config, 'invalid JSON in package.json');
    }
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  let framework = 'vanilla';
  if (deps.next) framework = 'next';
  else if (deps['@angular/core']) framework = 'angular';
  else if (deps.vue) framework = 'vue';
  else if (deps.react) framework = 'react';
  const devCommand = pkg.scripts?.dev ?? null;
  let devPort = 3000;
  if (devCommand) {
    const m = devCommand.match(/--port[= ](\d+)/);
    if (m) devPort = Number(m[1]);
  }
  const report = {
    action: 'integrate',
    kind: 'review',
    strategy: 'proxy',
    runtime: hasPkg ? 'node' : 'static',
    framework,
    dev_command: devCommand,
    dev_port: hasPkg ? devPort : null,
    next: ['tux review start --url http://localhost:' + (hasPkg ? devPort : 8123)],
  };
  if (opts.format === 'text') {
    const lines = [
      `integrated live review (strategy ${report.strategy}, framework ${framework})`,
      `next: ${report.next.join(' | ')}`,
    ];
    return { stdout: lines.join('\n') + '\n', exit: EXIT.ok };
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}

export async function opReviewStart(opts, spec) {
  const { config } = opts;
  const host = spec.host ?? config.review.host;
  const port = spec.port ?? config.review.port;
  const session = spec.session ?? 'default';
  const environment = spec.environment ?? 'development';
  const mode = spec.cmd ? 'spawn' : 'proxy';
  const target = spec.url ?? `http://127.0.0.1:${spec.targetPort ?? 3000}`;
  const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
  const plan = {
    action: 'start',
    kind: 'review',
    mode,
    target,
    host,
    port,
    session_id: session,
    environment,
    url,
    ...(spec.cmd ? { command: spec.cmd } : {}),
  };
  if (spec.dryRun) {
    return { stdout: canonicalJson(plan) + '\n', exit: EXIT.ok };
  }
  mkdirSync(join(opts.cwd, '.tux'), { recursive: true });
  let appPid = null;
  if (spec.cmd) {
    appPid = spawnDetached(spec.cmd, opts.cwd);
    const deadline = Date.now() + 30000;
    const targetUp = await waitUntil(() => health(target), deadline);
    if (!targetUp) {
      killTree(appPid);
      throw new CliError(EXIT.server, `target application did not become reachable at ${target}`);
    }
  }
  const binPath = fileURLToPath(new URL('./serve-main.js', import.meta.url));
  const run = { ...spec, host, port, session, environment, target, url, mode, appPid };
  const args = [binPath, '--mode', 'review', '--host', host, '--port', String(port),
    '--target', target, '--session', session, '--environment', environment,
    '--store', opts.config.review.store, '--project-id', opts.config.project_id, '--cwd', opts.cwd];
  if (spec.cmd) args.push('--spawn', JSON.stringify(spec.cmd));
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  return waitAndWriteState(opts, run, child.pid);
}

async function waitAndWriteState(opts, spec, pid) {
  const deadline = Date.now() + 15000;
  const ok = await waitUntil(() => health(spec.url), deadline);
  if (!ok) {
    killTree(pid);
    throw new CliError(EXIT.server, `review server did not become healthy at ${spec.url}`);
  }
  const state = {
    pid,
    ...(spec.appPid ? { app_pid: spec.appPid } : {}),
    mode: spec.mode,
    url: spec.url,
    target_url: spec.target,
    host: spec.host,
    port: spec.port,
    session_id: spec.session,
    environment: spec.environment,
    project_id: opts.config.project_id,
    store: opts.config.review.store,
    started_at: canonicalTimestamp(Date.now()),
  };
  writeFileSync(join(opts.cwd, SERVER_STATE_FILE), canonicalJson(state) + '\n', 'utf8');
  if (opts.format === 'text') {
    return { stdout: `review server running at ${spec.url} (pid ${pid})\n`, exit: EXIT.ok };
  }
  return { stdout: canonicalJson(state) + '\n', exit: EXIT.ok };
}

function waitUntil(fn, deadlineMs) {
  return new Promise((resolvePromise, reject) => {
    const tick = async () => {
      try {
        if (await fn()) return resolvePromise(true);
      } catch {
        /* keep waiting */
      }
      if (Date.now() > deadlineMs) return resolvePromise(false);
      setTimeout(tick, 250);
    };
    tick();
  });
}

export async function opReviewStatus(opts) {
  const statePath = join(opts.cwd, SERVER_STATE_FILE);
  if (!existsSync(statePath)) {
    if (opts.format === 'json') return { stdout: canonicalJson({ state: 'stopped' }) + '\n', exit: EXIT.ok };
    return { stdout: 'stopped\n', exit: EXIT.ok };
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const alive = await health(state.url);
  if (!alive) {
    if (opts.format === 'json') return { stdout: canonicalJson({ state: 'stopped' }) + '\n', exit: EXIT.ok };
    return { stdout: 'stopped\n', exit: EXIT.ok };
  }
  const store = loadStore(opts.cwd, opts.config);
  const result = { state: 'running', ...state, feedback_count: store.feedback.length };
  if (opts.format === 'json') return { stdout: canonicalJson(result) + '\n', exit: EXIT.ok };
  const lines = [
    `state: running`,
    `url: ${state.url}`,
    `target: ${state.target_url}`,
    `session: ${state.session_id}`,
    `feedback: ${store.feedback.length}`,
  ];
  return { stdout: lines.join('\n') + '\n', exit: EXIT.ok };
}

export function opReviewStop(opts) {
  const statePath = join(opts.cwd, SERVER_STATE_FILE);
  if (!existsSync(statePath)) {
    if (opts.format === 'json') return { stdout: canonicalJson({ stopped: false, reason: 'not running' }) + '\n', exit: EXIT.ok };
    return { stdout: 'not running\n', exit: EXIT.ok };
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  killTree(state.pid);
  if (state.app_pid) killTree(state.app_pid);
  rmSync(statePath);
  if (opts.format === 'json') return { stdout: canonicalJson({ stopped: true, pid: state.pid }) + '\n', exit: EXIT.ok };
  return { stdout: `stopped (pid ${state.pid})\n`, exit: EXIT.ok };
}

function spawnDetached(cmd, cwd) {
  const isWin = platform() === 'win32';
  const child = isWin
    ? spawn('cmd.exe', ['/d', '/s', '/c', cmd], { detached: true, stdio: 'ignore', cwd })
    : spawn('/bin/sh', ['-c', cmd], { detached: true, stdio: 'ignore', cwd });
  child.unref();
  return child.pid;
}

function killTree(pid) {
  if (pid === null || pid === undefined) return;
  try {
    if (platform() === 'win32') {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        process.kill(pid, 'SIGTERM');
      }
    }
  } catch {
    /* already gone */
  }
}
