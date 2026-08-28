#!/usr/bin/env node
/**
 * Conformance runner (mirror of py/tests/test_conformance.py).
 *
 * Walks every directory under `conformance/` containing a `case.json`,
 * materializes the case in a fresh temp directory, runs the CLI and
 * compares exit code, stdout, stderr and post-run files byte-for-byte
 * with the frozen expectations. The fixtures are the source of truth;
 * never change one implementation alone.
 *
 * @module test.conformance
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..', 'conformance');

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

function diffTrees(wantDir, gotDir, prefix = '') {
  const problems = [];
  if (!existsSync(wantDir)) return problems;
  for (const e of readdirSync(wantDir)) {
    const w = join(wantDir, e);
    const g = join(gotDir, e);
    const rel = prefix ? `${prefix}/${e}` : e;
    if (statSync(w).isDirectory()) {
      if (!existsSync(g)) problems.push(`missing file: ${rel}`);
      else problems.push(...diffTrees(w, g, rel));
    } else {
      if (!existsSync(g)) {
        problems.push(`missing file: ${rel}`);
        continue;
      }
      const a = readFileSync(w);
      const b = readFileSync(g);
      if (!a.equals(b)) problems.push(`byte-diff: ${rel}`);
    }
  }
  return problems;
}

async function main() {
  const cases = collectCases(root).sort();
  let pass = 0;
  const failures = [];
  for (const dir of cases) {
    const rel = dir.slice(root.length + 1);
    const caseDef = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
    const work = join(tmpdir(), `tux-conf-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'work');
    mkdirSync(work, { recursive: true });
    for (const [f, content] of Object.entries(caseDef.files ?? {})) {
      mkdirSync(join(work, f, '..'), { recursive: true });
      writeFileSync(join(work, f), content);
    }
    for (const [f, src] of Object.entries(caseDef.include ?? {})) {
      mkdirSync(join(work, f, '..'), { recursive: true });
      cpSync(join(root, src), join(work, f));
    }
    const prevEnv = {};
    for (const [k, v] of Object.entries(caseDef.env ?? {})) {
      prevEnv[k] = process.env[k];
      process.env[k] = v;
    }
    let result;
    try {
      result = await run(caseDef.args, { cwd: work });
    } finally {
      for (const [k] of Object.entries(caseDef.env ?? {})) {
        if (prevEnv[k] === undefined) delete process.env[k];
        else process.env[k] = prevEnv[k];
      }
    }
    const problems = [];
    const expected = readFileSync(join(dir, 'expected.txt'), 'utf8');
    const nl = expected.indexOf('\n');
    const wantExit = Number(expected.slice(0, nl).replace('exit ', ''));
    const wantOut = expected.slice(nl + 1);
    if (result.exit !== wantExit) problems.push(`exit: want ${wantExit}, got ${result.exit}`);
    if (result.stdout !== wantOut) {
      problems.push('stdout differs:');
      problems.push(...lineDiff(wantOut, result.stdout));
    }
    const errPath = join(dir, 'expected.err');
    if (existsSync(errPath)) {
      const expectedErr = readFileSync(errPath, 'utf8');
      const nl2 = expectedErr.indexOf('\n');
      const wantErr = expectedErr.slice(nl2 + 1);
      if ((result.stderr ?? '') !== wantErr) {
        problems.push('stderr differs:');
        problems.push(...lineDiff(wantErr, result.stderr ?? ''));
      }
    } else if (result.stderr) {
      problems.push(`unexpected stderr: ${JSON.stringify(result.stderr)}`);
    }
    problems.push(...diffTrees(join(dir, 'expected-files'), work));
    rmSync(work, { recursive: true, force: true });
    if (problems.length === 0) {
      pass++;
      console.log(`PASS ${rel}`);
    } else {
      failures.push(rel);
      console.log(`FAIL ${rel}`);
      for (const p of problems) console.log(`  ${p}`);
    }
  }
  console.log(`\n${pass}/${pass + failures.length} conformance cases passed`);
  process.exitCode = failures.length > 0 ? 1 : 0;
}

function lineDiff(want, got) {
  const out = [`  --- want ---`];
  for (const l of want.split('\n')) out.push(`  | ${l}`);
  out.push(`  --- got ----`);
  for (const l of got.split('\n')) out.push(`  | ${l}`);
  return out;
}

main();
