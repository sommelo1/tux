#!/usr/bin/env node
/**
 * Syncs the Review Client (js/client/*) into the Python package
 * (py/tux/client/*) and the canonical skills (skills/*.md) into every
 * deployment location. Deployed copies are generated artifacts — edit the
 * source, regenerate, commit; never patch a deployed copy.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');

// 1) Review Client → Python package
rmSync(join(repo, 'py', 'tux', 'client'), { recursive: true, force: true });
mkdirSync(join(repo, 'py', 'tux', 'client'), { recursive: true });
for (const f of readdirSync(join(repo, 'js', 'client'))) {
  cpSync(join(repo, 'js', 'client', f), join(repo, 'py', 'tux', 'client', f));
}
console.log('synced js/client → py/tux/client');

// 1b) Design templates → Python package
rmSync(join(repo, 'py', 'tux', 'templates'), { recursive: true, force: true });
cpSync(join(repo, 'js', 'templates'), join(repo, 'py', 'tux', 'templates'), { recursive: true });
console.log('synced js/templates → py/tux/templates');

// 2) Skills → deployment locations (js package, py package, tool skills dirs)
const skillsDir = join(repo, 'skills');
if (existsSync(skillsDir)) {
  const skillSources = readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  const targets = [
    join(repo, 'js', 'skills'),
    join(repo, 'py', 'tux', 'skills'),
    join(repo, '.claude', 'skills'),
    join(repo, '.hermes', 'skills'),
    join(repo, '.kilo', 'skills'),
  ];
  for (const dir of targets) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const f of skillSources) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      cpSync(join(skillsDir, f), join(dir, f));
    }
  }
  console.log(`synced ${skillSources.length} skill(s) → ${targets.length} locations`);
}
