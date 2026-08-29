#!/usr/bin/env node
/**
 * Release orchestrator (mirrors mds tools/release.mjs):
 *
 *   node tools/release.mjs <x.y.z>
 *
 * - requires main branch + clean working tree + new version
 * - bumps js/package.json, py/pyproject.toml, py/tux/__init__.py
 * - runs the full test suites (JS + Python)
 * - builds + inspects the package artifacts (tools/package-*.mjs)
 * - verifies installation in dedicated environments incl. real
 *   react/vue/angular builds served over HTTP (tools/install-test.mjs)
 * - commits, pushes, tags v<x.y.z> and pushes the tag
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const version = process.argv[2];
const pythonCmd = process.platform === 'win32'
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.error || r.status !== 0) process.exit(r.status ?? 1);
  return r.stdout || '';
}

const npm = (args, cwd) => {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const argv = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  return run(cmd, argv, cwd);
};

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail('usage: node tools/release.mjs <x.y.z>');
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], root).trim();
if (branch !== 'main') fail(`release must run on main, got ${branch || '<unknown>'}`);

const status = run('git', ['status', '--porcelain'], root).trim();
if (status) {
  fail('working tree must be clean before release; commit or stash first:\n' + status);
}

const current = JSON.parse(readFileSync(join(root, 'js', 'package.json'), 'utf8')).version;
if (current === version) fail(`version already is ${version}`);

for (const file of ['js/package.json', 'py/pyproject.toml', 'py/tux/__init__.py']) {
  if (!readFileSync(join(root, file), 'utf8').length) fail(`${file} is empty`);
}

function replace(file, from, to) {
  const path = join(root, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) fail(`${file}: missing ${from}`);
  writeFileSync(path, text.replaceAll(from, to), 'utf8');
}

replace('js/package.json', `"version": "${current}"`, `"version": "${version}"`);
replace('py/pyproject.toml', `version = "${current}"`, `version = "${version}"`);
replace('py/tux/__init__.py', `__version__ = "${current}"`, `__version__ = "${version}"`);

console.log(`── tests (JS) ──`);
npm(['test'], join(root, 'js'));
console.log(`── tests (Python) ──`);
run(pythonCmd, ['-m', 'pytest', 'py/tests', '-q'], root);
console.log(`── package js ──`);
run('node', ['tools/package-js.mjs'], root);
console.log(`── package py ──`);
run('node', ['tools/package-py.mjs'], root);
console.log(`── install test (dedicated environments, incl. real vue/angular builds) ──`);
run('node', ['tools/install-test.mjs'], root);

run('git', ['add', 'js/package.json', 'py/pyproject.toml', 'py/tux/__init__.py'], root);
run('git', ['commit', '-m', `Release ${version}`], root);
run('git', ['push', 'origin', 'main'], root);
run('git', ['tag', '-a', `v${version}`, '-m', `v${version}`], root);
run('git', ['push', 'origin', `v${version}`], root);

console.log(`Release ${version} committed, pushed and tagged as v${version}`);
console.log(`Artifacts in dist/ — publish with: npm publish dist/tux-review-${version}.tgz · twine upload dist/tux_review-${version}*`);
