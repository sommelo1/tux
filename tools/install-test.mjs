#!/usr/bin/env node
/**
 * Installation verification in dedicated, isolated environments.
 *
 * Every artifact (npm tarball, Python wheel) is installed into a fresh,
 * throwaway environment and exercised end to end — proving the packages
 * are complete and runnable, not merely that the sources work:
 *
 * 1. npm: fresh project dir → `npm install <tarball>` → CLI round-trip
 *    (--version, feedback create/list, design create for ALL frameworks,
 *    skills + client files present in node_modules).
 * 2. Frameworks: for vanilla, react, vue and angular a dedicated env
 *    materializes the scaffold via the installed CLI; react/vue/angular
 *    run a real `npm install` + production build; every design is then
 *    served by the installed CLI and verified over HTTP (client
 *    injection + feedback API round-trip).
 * 3. Python: fresh venv → `pip install <wheel>` → console script `tux`
 *    round-trip, pip check, angular scaffold materialization, and the
 *    Python server verified over HTTP.
 *
 * Usage: node tools/install-test.mjs [--keep]
 * Requires dist/ artifacts from tools/package-js.mjs + tools/package-py.mjs.
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const repoPy = join(root, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
const python = existsSync(repoPy) ? repoPy : (process.platform === 'win32' ? 'python' : 'python3');
const keep = process.argv.includes('--keep');

const version = JSON.parse(readFileSync(join(root, 'js', 'package.json'), 'utf8')).version;
const tarball = join(distDir, `tux-uix-${version}.tgz`);
const wheel = readdirSync(distDir).find((f) => f.endsWith('.whl'));
if (!existsSync(tarball) || !wheel) {
  console.error('dist/ artifacts missing — run tools/package-js.mjs and tools/package-py.mjs first');
  process.exit(1);
}
const wheelPath = join(distDir, wheel);

let failures = 0;
const check = (ok, label) => {
  if (ok) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
};

function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false, timeout: 900000, ...opts });
  if (r.error || r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status ?? r.error}):\n${r.stdout || ''}${r.stderr || ''}`);
  }
  return (r.stdout || '').trim();
}

const npm = (args, cwd, opts = {}) => {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const argv = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  return run(cmd, argv, cwd, opts);
};

async function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`not ready: ${url}`);
}

async function stopServer(child) {
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 3000);
  });
}

async function serveAndVerify(cli, serveDir, port, cwd, marker, label) {
  const child = spawn(process.execPath, [cli, 'design', 'serve', '--dir', serveDir, '--port', String(port)], {
    cwd, stdio: 'ignore',
  });
  let exited = null;
  child.once('exit', (code) => { exited = code; });
  try {
    await waitFor(`http://127.0.0.1:${port}/api/tux/health`);
    const page = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    check(page.includes(marker), `${label}: app served (${marker})`);
    check(page.includes('/__tux__/bootstrap.js') && page.includes('/__tux__/client.js'), `${label}: client injected`);
    const created = await fetch(`http://127.0.0.1:${port}/api/tux/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TUX-User-Id': 'usr_it', 'X-TUX-Display-Name': 'Install Test' },
      body: JSON.stringify({ type: 'issue', text: `${label} install test`, location: { route: '/' } }),
    });
    check(created.status === 201, `${label}: feedback API POST → 201`);
    const listed = await (await fetch(`http://127.0.0.1:${port}/api/tux/feedback`)).json();
    check(listed.feedback.length === 1, `${label}: feedback API GET → 1 item`);
  } finally {
    if (exited === null) await stopServer(child);
  }
}

const tmpRoot = join(tmpdir(), `tux-install-test-${Date.now()}`);
mkdirSync(tmpRoot, { recursive: true });
const cleanup = keep ? () => console.log(`kept: ${tmpRoot}`) : () => rmSync(tmpRoot, { recursive: true, force: true });

try {
  // ── 1) npm package: dedicated project with the tarball installed ──
  const npmEnv = join(tmpRoot, 'npm-env');
  mkdirSync(npmEnv, { recursive: true });
  writeFileSync(join(npmEnv, 'package.json'), JSON.stringify({
    name: 'tux-install-test', private: true,
    dependencies: { 'tux-uix': `file:${tarball.replace(/\\/g, '/')}` },
  }, null, 2) + '\n');
  npm(['install', '--no-audit', '--no-fund'], npmEnv);
  const cli = join(npmEnv, 'node_modules', 'tux-uix', 'bin', 'tux.js');
  check(readFileSync(cli, 'utf8').length > 0, 'npm: tarball installed into dedicated env');
  check(run('node', [cli, '--version'], npmEnv) === `tux ${version}`, `npm: tux --version → tux ${version}`);

  run('node', [cli, 'feedback', 'create', '--type', 'issue', '--text', 'from installed package'], npmEnv);
  const listed = JSON.parse(run('node', [cli, 'feedback', 'list', '--format', 'json'], npmEnv));
  check(listed.length === 1 && listed[0].feedback.text === 'from installed package', 'npm: feedback create/list round-trip');

  const scaffoldMarker = {
    vanilla: 'src/app.js',
    react: 'src/App.jsx',
    vue: 'src/App.vue',
    angular: 'src/app/app.component.ts',
  };
  for (const fw of ['vanilla', 'react', 'vue', 'angular']) {
    run('node', [cli, 'design', 'create', '--framework', fw, '--name', `demo-${fw}`], npmEnv);
    const scaffold = join(npmEnv, 'requirements', `demo-${fw}`, 'design');
    check(existsSync(join(scaffold, 'package.json')) && existsSync(join(scaffold, scaffoldMarker[fw])),
      `npm: design create ${fw} → scaffold complete`);
  }
  const pkgRoot = join(npmEnv, 'node_modules', 'tux-uix');
  const skillCount = readdirSync(join(pkgRoot, 'skills')).filter((f) => f.endsWith('.md')).length;
  check(skillCount === 7, `npm: 7 skills shipped (found ${skillCount})`);
  check(existsSync(join(pkgRoot, 'client', 'tux-review.js')), 'npm: review client shipped');

  // ── 2) frameworks: dedicated env per framework, real install + build + serve ──
  const frameworkSpecs = [
    { fw: 'vanilla', build: false, marker: 'id="view"' },
    { fw: 'react', build: true, marker: 'id="root"' },
    { fw: 'vue', build: true, marker: 'id="app"' },
    { fw: 'angular', build: true, marker: '<app-root' },
  ];
  let port = 4310;
  for (const spec of frameworkSpecs) {
    const envF = join(tmpRoot, `fw-${spec.fw}`);
    mkdirSync(envF, { recursive: true });
    const scaffold = join(envF, 'requirements', 'demo', 'design');
    run('node', [cli, 'design', 'create', '--framework', spec.fw, '--name', 'demo'], envF);
    let serveDir = scaffold;
    if (spec.build) {
      npm(['install', '--no-audit', '--no-fund'], scaffold);
      npm(['run', 'build'], scaffold);
      serveDir = spec.fw === 'angular'
        ? join(scaffold, 'dist', 'tux-design', 'browser')
        : join(scaffold, 'dist');
      check(existsSync(join(serveDir, 'index.html')), `${spec.fw}: production build produced index.html`);
    }
    await serveAndVerify(cli, serveDir, port, envF, spec.marker, `${spec.fw}`);
    port += 1;
  }

  // ── 3) Python package: fresh venv with the wheel installed ──
  const pyEnv = join(tmpRoot, 'py-env');
  mkdirSync(pyEnv, { recursive: true });
  run(python, ['-m', 'venv', join(pyEnv, 'venv')], pyEnv);
  const venvBin = join(pyEnv, 'venv', process.platform === 'win32' ? 'Scripts' : 'bin');
  const venvPython = join(venvBin, process.platform === 'win32' ? 'python.exe' : 'python');
  const venvTux = join(venvBin, process.platform === 'win32' ? 'tux.exe' : 'tux');
  run(venvPython, ['-m', 'pip', 'install', '--quiet', wheelPath], pyEnv);
  run(venvPython, ['-m', 'pip', 'check'], pyEnv);
  check(run(venvTux, ['--version'], pyEnv) === `tux ${version}`, `py: console script tux --version → tux ${version}`);

  run(venvTux, ['feedback', 'create', '--type', 'issue', '--text', 'from installed wheel'], pyEnv);
  const pyListed = JSON.parse(run(venvTux, ['feedback', 'list', '--format', 'json'], pyEnv));
  check(pyListed.length === 1 && pyListed[0].feedback.text === 'from installed wheel', 'py: feedback create/list round-trip');

  run(venvTux, ['design', 'create', '--framework', 'angular', '--name', 'demo'], pyEnv);
  check(existsSync(join(pyEnv, 'requirements', 'demo', 'design', 'src', 'app', 'app.component.ts')),
    'py: design create angular → scaffold complete (templates shipped in wheel)');

  // the py server is verified on the vanilla scaffold (no framework build needed —
  // framework serving incl. real builds is covered by the npm-package section above)
  run(venvTux, ['design', 'create', '--framework', 'vanilla', '--name', 'vanilla-demo'], pyEnv);
  const pyServeDir = join(pyEnv, 'requirements', 'vanilla-demo', 'design');
  const pyChild = spawn(venvTux, ['design', 'serve', '--dir', pyServeDir, '--port', '4320'], { cwd: pyEnv, stdio: 'ignore' });
  try {
    await waitFor('http://127.0.0.1:4320/api/tux/health');
    const page = await (await fetch('http://127.0.0.1:4320/')).text();
    check(page.includes('id="view"'), 'py: python server serves design');
    check(page.includes('/__tux__/client.js'), 'py: python server injects client');
    const created = await fetch('http://127.0.0.1:4320/api/tux/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TUX-User-Id': 'usr_it', 'X-TUX-Display-Name': 'Install Test' },
      body: JSON.stringify({ type: 'issue', text: 'py server install test', location: { route: '/' } }),
    });
    check(created.status === 201, 'py: feedback API POST → 201');
    const missing = await fetch('http://127.0.0.1:4320/definitely-missing.png');
    check(missing.status === 404, 'py: unknown route → clean 404');
  } finally {
    await stopServer(pyChild);
  }
} catch (err) {
  failures += 1;
  console.log(`FAIL ${err.message.split('\n')[0]}`);
  console.error(err.message);
} finally {
  cleanup();
}

console.log(failures === 0 ? '\ninstall-test: all dedicated-environment checks passed' : `\ninstall-test: ${failures} failure(s)`);
process.exitCode = failures > 0 ? 1 : 0;
