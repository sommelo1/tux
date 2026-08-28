/**
 * `tux design <action>` — integrate, create, serve (SPC sections 28–38).
 *
 * @module design
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CliError, EXIT } from './errors.js';
import { canonicalJson } from './canonical.js';
import { CONFIG_FILE, defaultConfig } from './config.js';
import { SUPPORTED_FRAMEWORKS, vanillaTemplate } from './templates.js';

function textReport(lines) {
  return { stdout: lines.join('\n') + '\n', exit: EXIT.ok };
}

function relPath(cwd, p) {
  const rel = relative(cwd, p);
  return rel.startsWith('..') ? p : rel;
}

export function opDesignIntegrate(opts, spec) {
  const cwd = opts.cwd;
  const framework = spec.framework ?? opts.config.design.framework ?? 'vanilla';
  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    throw new CliError(EXIT.usage, `unsupported framework: ${framework} (expected ${SUPPORTED_FRAMEWORKS.join(', ')})`);
  }
  const configPath = opts.configPath ?? join(cwd, CONFIG_FILE);
  let config;
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } else {
    config = defaultConfig(cwd);
  }
  config.design = config.design ?? {};
  config.design.framework = framework;
  if (spec.root) config.design.root = spec.root;
  const root = config.design.root ?? 'requirements';
  writeFileSync(configPath, canonicalJson(config) + '\n', 'utf8');
  const report = {
    action: 'integrate',
    kind: 'design',
    framework,
    root,
    config: opts.configPath ? relPath(cwd, opts.configPath) : CONFIG_FILE,
    next: [`tux design create --framework ${framework}`, 'tux design serve'],
  };
  if (opts.format === 'text') {
    return textReport([
      `integrated design review (framework ${framework})`,
      `config: ${report.config}`,
      `next: ${report.next.join(' | ')}`,
    ]);
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}

export function opDesignCreate(opts, spec) {
  const cwd = opts.cwd;
  const framework = spec.framework;
  if (!framework) throw new CliError(EXIT.usage, '--framework is required');
  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    throw new CliError(EXIT.usage, `unsupported framework: ${framework} (expected ${SUPPORTED_FRAMEWORKS.join(', ')})`);
  }
  if (!spec.name || !/^[a-z0-9][a-z0-9-]*$/.test(spec.name)) {
    throw new CliError(EXIT.usage, '--name must be a lowercase slug (letters, digits, dashes)');
  }
  const root = opts.config.design.root ?? 'requirements';
  const designDir = resolve(cwd, root, spec.name, 'design');
  if (existsSync(designDir)) {
    throw new CliError(EXIT.conflict, `design directory already exists: ${root}/${spec.name}/design`);
  }
  const files = vanillaTemplate();
  for (const [rel, content] of Object.entries(files)) {
    const p = join(designDir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  const report = {
    action: 'create',
    kind: 'design',
    framework,
    name: spec.name,
    root: `${root}/${spec.name}/design`,
    next: ['tux design serve', 'review in the browser'],
  };
  if (opts.format === 'text') {
    return textReport([
      `created ${report.root} (framework ${framework})`,
      `next: ${report.next.join(' | ')}`,
    ]);
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}
