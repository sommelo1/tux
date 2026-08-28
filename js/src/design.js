/**
 * `tux design <action>` — install, create, start-review, status, stop-review (SPC sections 28–38).
 * `tux live create` (SPC section 32) shares the create primitive with `"kind": "live"`.
 *
 * @module design
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CliError, EXIT } from './errors.js';
import { canonicalJson } from './canonical.js';
import { CONFIG_FILE, defaultConfig } from './config.js';
import { SUPPORTED_FRAMEWORKS, designTemplate } from './templates.js';
import { startServer, opLiveStatus, opLiveStop } from './live.js';

function textReport(lines) {
  return { stdout: lines.join('\n') + '\n', exit: EXIT.ok };
}

function relPath(cwd, p) {
  const rel = relative(cwd, p);
  if (rel === '') return '.';
  return rel.startsWith('..') ? p : rel;
}

export function opDesignInstall(opts, spec) {
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
    action: 'install',
    kind: 'design',
    framework,
    root,
    config: opts.configPath ? relPath(cwd, opts.configPath) : CONFIG_FILE,
    next: [`tux design create --framework ${framework}`, 'tux design start-review'],
  };
  if (opts.format === 'text') {
    return textReport([
      `installed design review (framework ${framework})`,
      `config: ${report.config}`,
      `next: ${report.next.join(' | ')}`,
    ]);
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}

const DEV_PORT = { vanilla: 4173, react: 5173, vue: 5173, angular: 4200 };

/**
 * Create the runnable design scaffold (`tux design create`) or the identical
 * live-app scaffold (`tux live create`, `"kind": "live"`).
 */
export function opDesignCreate(opts, spec) {
  const kind = spec.kind ?? 'design';
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
  const files = designTemplate(framework);
  for (const [rel, content] of Object.entries(files)) {
    const p = join(designDir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  const domain = kind === 'live' ? 'live' : 'design';
  const next = kind === 'live'
    ? ['tux live install', `tux live start-review --url http://localhost:${DEV_PORT[framework]}`]
    : ['tux design start-review', 'review in the browser'];
  const report = {
    action: 'create',
    kind,
    framework,
    name: spec.name,
    root: `${root}/${spec.name}/design`,
    next,
  };
  if (opts.format === 'text') {
    return textReport([
      `created ${report.root} (framework ${framework}, kind ${kind})`,
      `next: ${report.next.join(' | ')}`,
    ]);
  }
  return { stdout: canonicalJson(report) + '\n', exit: EXIT.ok };
}

export function opLiveCreate(opts, spec) {
  return opDesignCreate(opts, { ...spec, kind: 'live' });
}

export async function opDesignStart(opts, spec) {
  const { config } = opts;
  const host = spec.host ?? config.review.host;
  const port = spec.port ?? config.review.port;
  const session = spec.session ?? 'default';
  const environment = spec.environment ?? 'design';
  const root = resolve(opts.cwd, spec.dir ?? config.design.root);
  const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
  const plan = {
    action: 'start',
    kind: 'design',
    mode: 'design',
    root: relPath(opts.cwd, root),
    host,
    port,
    session_id: session,
    environment,
    url,
  };
  return startServer(opts, {
    mode: 'design', host, port, session, environment, url,
    root: relPath(opts.cwd, root), target: null,
    dryRun: spec.dryRun ?? false, foreground: spec.foreground ?? false, plan,
  });
}

export { opLiveStatus as opDesignStatus, opLiveStop as opDesignStop };
