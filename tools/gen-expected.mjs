#!/usr/bin/env node
/**
 * Generates the expected outputs for every conformance case by running the
 * Node reference implementation. The generated expectations are reviewed
 * semantically once, then frozen — after that they are the source of
 * truth and both implementations must match them byte-for-byte.
 *
 * Only run this after an intentional, reviewed spec-behavior change.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../js/src/cli.js';

const root = join(fileURLToPath(import.meta.url), '..', '..', 'conformance');

function collectCases(dir, out = []) {
  if (!statSync(dir).isDirectory()) return out;
  if (existsSync(join(dir, 'case.json'))) out.push(dir);
  for (const e of readdirSync(dir)) collectCases(join(dir, e), out);
  return out;
}

function writeTree(from, to) {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true });
}

const force = process.argv.includes('--force');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
let count = 0;
for (const dir of collectCases(root).sort()) {
  if (only && !dir.replace(/\\/g, '/').includes(only)) continue;
  if (!force && existsSync(join(dir, 'expected.txt'))) continue;
  const caseDef = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  rmSync(join(dir, 'work'), { recursive: true, force: true });
  mkdirSync(join(dir, 'work'), { recursive: true });
  for (const [rel, content] of Object.entries(caseDef.files ?? {})) {
    const p = join(dir, 'work', rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSyncFix(p, content);
  }
  for (const [rel, src] of Object.entries(caseDef.include ?? {})) {
    const p = join(dir, 'work', rel);
    mkdirSync(join(p, '..'), { recursive: true });
    cpSync(join(root, src), p);
  }
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('TUX_')) env[k] = v;
  }
  Object.assign(env, caseDef.env ?? {});
  const previousEnv = {};
  for (const [k, v] of Object.entries(caseDef.env ?? {})) previousEnv[k] = process.env[k];
  Object.assign(process.env, caseDef.env ?? {});
  const result = await run(caseDef.args, { cwd: join(dir, 'work') });
  for (const k of Object.keys(caseDef.env ?? {})) {
    if (previousEnv[k] === undefined) delete process.env[k];
    else process.env[k] = previousEnv[k];
  }
  rmSync(join(dir, 'expected-files'), { recursive: true, force: true });
  writeTree(join(dir, 'work'), join(dir, 'expected-files'));
  rmSync(join(dir, 'work'), { recursive: true, force: true });
  const out = `exit ${result.exit}\n` + result.stdout;
  writeFileSyncFix(join(dir, 'expected.txt'), out);
  if (result.stderr && result.stderr.length > 0) {
    writeFileSyncFix(join(dir, 'expected.err'), `exit ${result.exit}\n` + result.stderr);
  } else {
    rmSync(join(dir, 'expected.err'), { force: true });
  }
  count++;
  console.log(`generated ${dir.slice(root.length + 1)}`);
}
console.log(`${count} case(s) generated`);

function writeFileSyncFix(p, content) {
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
}
