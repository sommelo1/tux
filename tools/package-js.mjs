#!/usr/bin/env node
/**
 * Builds the npm package artifact and inspects its content:
 * - version consistency across js/package.json, py/pyproject.toml, py/tux/__init__.py
 * - `npm pack` into dist/ (real tarball, used by tools/install-test.mjs)
 * - required files present, forbidden files absent
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const jsDir = join(root, 'js');
const distDir = join(root, 'dist');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false, ...opts });
  if (r.error || (r.status !== 0)) {
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || String(r.error) + '\n');
    process.exit(r.status ?? 1);
  }
  return r.stdout || '';
}

const npm = (args, cwd) => {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const argv = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  return run(cmd, argv, cwd);
};

// ── version consistency ──
const pkg = JSON.parse(readFileSync(join(jsDir, 'package.json'), 'utf8'));
const version = pkg.version;
const pyproject = readFileSync(join(root, 'py', 'pyproject.toml'), 'utf8');
const pyInit = readFileSync(join(root, 'py', 'tux', '__init__.py'), 'utf8');
if (!pyproject.includes(`version = "${version}"`)) fail(`py/pyproject.toml version does not match ${version}`);
if (!pyInit.includes(`__version__ = "${version}"`)) fail(`py/tux/__init__.py version does not match ${version}`);

// ── pack ──
rmSync(join(distDir, 'tux-uix'), { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
// npm packs the package dir (js/) — the repo-root README must ride along:
const jsReadme = join(jsDir, 'README.md');
const repoReadme = readFileSync(join(root, 'README.md'), 'utf8');
writeFileSync(jsReadme, repoReadme, 'utf8');
let packed;
try {
  packed = JSON.parse(npm(['pack', '--json', `--pack-destination`, distDir.replace(/\\/g, '/')], jsDir).trim());
} finally {
  rmSync(jsReadme, { force: true });
}
if (!Array.isArray(packed) || packed.length !== 1) fail('npm pack did not return exactly one package description');
const files = (packed[0].files || []).map((f) => f.path);
const tarball = join(distDir, packed[0].filename);

// ── content inspection ──
const required = [
  'bin/tux.js',
  'src/cli.js', 'src/server.js', 'src/serve-main.js', 'src/feedback.js', 'src/schema.js', 'src/ids.js',
  'src/templates.js', 'src/index.js',
  'client/tux-review.js', 'client/tux-review.css',
  'templates/vanilla/src/app.js',
  'templates/react/src/App.jsx',
  'templates/vue/src/App.vue',
  'templates/angular/src/app/app.component.ts',
  'templates/angular/angular.json',
  'README.md', 'package.json',
];
const skills = ['design-create', 'design-integrate', 'design-serve', 'feedback-incorporate', 'feedback-validate', 'review-integrate', 'review-start'];
for (const s of skills) required.push(`skills/tux-${s}.md`);

const missing = required.filter((name) => !files.includes(name));
if (missing.length) fail(`npm package missing files: ${missing.join(', ')}`);

const forbiddenPrefixes = ['node_modules/', 'test/', 'e2e/', 'test-results/', '.tux/', 'playwright'];
const offending = files.filter((f) => forbiddenPrefixes.some((p) => f.startsWith(p)));
if (offending.length) fail(`npm package contains forbidden files: ${offending.join(', ')}`);

console.log(`npm package OK: ${packed[0].filename} (${files.length} files)`);
console.log(tarball);
