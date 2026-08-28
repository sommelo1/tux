/**
 * Design templates for `tux design create --framework <framework>`.
 *
 * Template content lives as real files under `js/templates/<framework>/`
 * (single source of truth). The Python mirror ships byte-identical copies
 * under `py/tux/templates/` (synced by `tools/sync-artifacts.mjs`,
 * enforced by the artifact identity tests). Templates are plain files on
 * purpose: no string duplication, no escaping traps, byte-exact fixtures.
 *
 * Every template is a runnable multi-route design (History-API routing,
 * tabs, a modal) annotated with TUX targeting attributes
 * (data-tux-id, data-tux-component, data-tux-instance, data-tux-state).
 *
 * @module templates
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

export const SUPPORTED_FRAMEWORKS = ['vanilla', 'react', 'vue', 'angular'];

/** Files (relative path → content) for `tux design create --framework <framework>`. */
export function designTemplate(framework) {
  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    throw new Error(`unsupported framework: ${framework}`);
  }
  return readTree(join(TEMPLATE_ROOT, framework));
}

function readTree(dir, prefix = '') {
  const out = {};
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(p).isDirectory()) {
      Object.assign(out, readTree(p, rel));
    } else {
      out[rel] = readFileSync(p, 'utf8');
    }
  }
  return out;
}
