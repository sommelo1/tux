#!/usr/bin/env node
/**
 * Builds the Python sdist + wheel and inspects their content:
 * - version consistency (js/package.json ↔ py/pyproject.toml ↔ py/tux/__init__.py)
 * - `python -m build` via the repo .venv
 * - required files present, forbidden files absent, metadata version match
 */
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const pyDir = join(root, 'py');
const distDir = join(root, 'dist');
const localPyExe = process.platform === 'win32'
  ? join(root, '.venv', 'Scripts', 'python.exe')
  : join(root, '.venv', 'bin', 'python');
const python = existsSync(localPyExe) ? localPyExe : (process.platform === 'win32' ? 'python' : 'python3');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false, ...opts });
  if (r.error || r.status !== 0) {
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || String(r.error) + '\n');
    process.exit(r.status ?? 1);
  }
  return r.stdout || '';
}

const version = JSON.parse(readFileSync(join(root, 'js', 'package.json'), 'utf8')).version;
const pyproject = readFileSync(join(pyDir, 'pyproject.toml'), 'utf8');
const pyInit = readFileSync(join(root, 'py', 'tux', '__init__.py'), 'utf8');
if (!pyproject.includes(`version = "${version}"`)) fail(`pyproject.toml version does not match ${version}`);
if (!pyInit.includes(`__version__ = "${version}"`)) fail(`py/tux/__init__.py version does not match ${version}`);

for (const p of [join(pyDir, 'build'), join(pyDir, 'dist'), join(pyDir, 'tux_uix.egg-info')]) {
  rmSync(p, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

run(python, ['-m', 'pip', 'install', '--quiet', 'build'], root);
run(python, ['-m', 'build', '--outdir', distDir], pyDir);

const distFiles = readdirSync(distDir);
const wheel = distFiles.find((f) => f.endsWith('.whl'));
const sdist = distFiles.find((f) => f.endsWith('.tar.gz'));
if (!wheel || !sdist) fail(`expected wheel + sdist in dist/, got: ${distFiles.join(', ')}`);

const check = `
import sys, tarfile, zipfile, pathlib, re
dist = pathlib.Path(sys.argv[1])
version = sys.argv[2]
wheel = dist / '${wheel}'
sdist = dist / '${sdist}'
wheel_names = set(zipfile.ZipFile(wheel).namelist())
sdist_names = set(tarfile.open(sdist, 'r:gz').getnames())
required = [
    'tux/__init__.py',
    'tux/__main__.py',
    'tux/cli.py',
    'tux/server.py',
    'tux/serve_main.py',
    'tux/feedback.py',
    'tux/schema.py',
    'tux/ids.py',
    'tux/client/tux-review.js',
    'tux/client/tux-review.css',
    'tux/templates/vanilla/src/app.js',
    'tux/templates/react/src/App.jsx',
    'tux/templates/vue/src/App.vue',
    'tux/templates/angular/src/app/app.component.ts',
    'tux/templates/angular/angular.json',
]
required += [f'tux/skills/tux-{s}.md' for s in (
    'design-create', 'design-incorporate', 'design-install', 'design-start-review', 'design-stop-review',
    'feedback-delete', 'feedback-export', 'feedback-show',
    'live-create', 'live-incorporate', 'live-install', 'live-start-review', 'live-stop-review')]
wheel_missing = sorted(n for n in required if n not in wheel_names)
sdist_missing = sorted(n for n in required if not any(n in item for item in sdist_names))
forbidden_prefixes = ('tux/tests/', 'conformance/', 'node_modules/')
wheel_forbidden = sorted(n for n in wheel_names if n.startswith(forbidden_prefixes))
problems = []
if wheel_missing:
    problems.append('wheel missing: ' + ', '.join(wheel_missing))
if sdist_missing:
    problems.append('sdist missing: ' + ', '.join(sdist_missing))
if wheel_forbidden:
    problems.append('wheel forbidden content: ' + ', '.join(wheel_forbidden))
meta = zipfile.ZipFile(wheel).read('tux_uix-' + version + '.dist-info/METADATA').decode('utf-8')
m = re.search(r'^Version: (.+)$', meta, re.M)
if not m or m.group(1).strip() != version:
    problems.append(f'wheel metadata version mismatch: {m and m.group(1)!r} != {version!r}')
if problems:
    print('\\n'.join(problems))
    raise SystemExit(1)
print(f'wheel + sdist OK ({len(wheel_names)} wheel files)')
`;
run(python, ['-c', check, distDir, version], root);

console.log(`Python package artifacts for ${version}:`);
console.log(join(distDir, wheel));
console.log(join(distDir, sdist));
