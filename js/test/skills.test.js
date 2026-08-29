/**
 * Artifact identity tests: deployed skill copies and the synced Review
 * Client must be byte-identical with their canonical sources.
 *
 * @module test.skills
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..', '..');
const jsRoot = join(fileURLToPath(import.meta.url), '..', '..');

let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    console.log(`FAIL ${msg}`);
  } else {
    console.log(`PASS ${msg}`);
  }
};

// ─── skill sources: contract (frontmatter, title, Resolve the CLI, Workflow) ───
const skillsDir = join(repo, 'skills');
const sources = existsSync(skillsDir) ? readdirSync(skillsDir).filter((f) => f.endsWith('.md')) : [];
check(sources.length === 13, `13 canonical skills exist (found ${sources.length})`);
const requiredSections = ['## Resolve the CLI', '## Workflow'];
for (const name of sources) {
  const text = readFileSync(join(skillsDir, name), 'utf8');
  const slug = name.replace(/\.md$/, '');
  check(text.startsWith('---\n'), `${name}: frontmatter present`);
  check(text.includes(`name: ${slug}`), `${name}: frontmatter name matches slug`);
  check(text.includes('description: '), `${name}: frontmatter description present`);
  check(text.includes(`# ${slug}`), `${name}: H1 title matches slug`);
  for (const section of requiredSections) {
    check(text.includes(section), `${name}: ${section} section present`);
  }
  check(text.includes('tux <domain> <action>') || text.includes('tux design start-review') || text.includes('tux feedback'),
    `${name}: uses canonical CLI vocabulary`);
  check(!/```/.test(text.split('## Resolve the CLI')[0].split('---')[2] || ''), `${name}: no code fences before Workflow`);
}

// ─── deployed copies byte-identity ───
const targets = [
  ['js package', join(jsRoot, 'skills')],
  ['py package', join(repo, 'py', 'tux', 'skills')],
  ['.claude', join(repo, '.claude', 'skills')],
  ['.hermes', join(repo, '.hermes', 'skills')],
  ['.kilo', join(repo, '.kilo', 'skills')],
];
for (const [label, dir] of targets) {
  check(existsSync(dir), `${label}: skills dir exists`);
  for (const name of sources) {
    const deployed = join(dir, name);
    if (!existsSync(deployed)) {
      check(false, `${label}/${name}: deployed copy exists`);
      continue;
    }
    const a = readFileSync(join(skillsDir, name));
    const b = readFileSync(deployed);
    check(a.equals(b), `${label}/${name}: byte-identical`);
  }
}

// ─── review client sync (js/client → py/tux/client) ───
for (const f of readdirSync(join(jsRoot, 'client'))) {
  const a = readFileSync(join(jsRoot, 'client', f));
  const b = readFileSync(join(repo, 'py', 'tux', 'client', f));
  check(a.equals(b), `client/${f}: byte-identical in py package`);
}

// ─── design templates sync (js/templates → py/tux/templates) ───
const tplDir = join(jsRoot, 'templates');
const frameworks = readdirSync(tplDir).filter((f) => statSync(join(tplDir, f)).isDirectory());
check(frameworks.length >= 4, `at least 4 design templates exist (found ${frameworks.join(', ')})`);
for (const fw of frameworks) {
  check(['vanilla', 'react', 'vue', 'angular'].includes(fw), `template ${fw}: supported framework`);
  checkTemplateTree(join(tplDir, fw), join(repo, 'py', 'tux', 'templates', fw), `template ${fw}`);
}

function checkTemplateTree(src, mirror, label) {
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const m = join(mirror, entry);
    if (statSync(s).isDirectory()) {
      checkTemplateTree(s, m, label);
      continue;
    }
    const ok = existsSync(m) && readFileSync(s).equals(readFileSync(m));
    check(ok, `${label}/${entry}: byte-identical in py package`);
  }
}

console.log(failures === 0 ? '\nall artifact identity checks passed' : `\n${failures} artifact identity failure(s)`);
process.exitCode = failures > 0 ? 1 : 0;
