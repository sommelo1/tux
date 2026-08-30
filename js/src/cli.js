/**
 * `tux` command-line interface (SPC sections 25, 74, 75).
 *
 * Grammar: `tux <domain> <action> [arguments] [options]`.
 * Machine output: canonical JSON on stdout; diagnostics on stderr as
 * `error: <message>` lines with canonical exit codes.
 *
 * @module cli
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError, EXIT } from './errors.js';
import { loadConfig } from './config.js';
import { opShow, opCreate, opUpdate, opDelete, opClear, opExport, opIncorporate, opValidate } from './feedback.js';
import { opDesignInstall, opDesignCreate, opLiveCreate, opDesignStart, opDesignStatus, opDesignStop } from './design.js';
import { opLiveInstall, opLiveStart, opLiveStatus, opLiveStop } from './live.js';

// Single source of truth is package.json — a hardcoded constant here
// drifted to 0.1.0 after the 0.1.1 release and broke the install test.
export const VERSION = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
).version;

const VALUE_FLAGS = new Set([
  'config', 'format', 'type', 'text', 'route', 'page', 'component', 'component-instance', 'instance',
  'tux-id', 'test-id', 'session', 'environment', 'origin', 'status', 'strategy', 'result', 'note', 'record',
  'url', 'target-port', 'port', 'host', 'store', 'project-id', 'name', 'framework', 'dir', 'root', 'out',
  'mode', 'target',
]);
const BOOL_FLAGS = new Set(['mine', 'all', 'force', 'strict', 'dry-run', 'no-interactive', 'foreground', 'help', 'version']);

export function parseArgs(args) {
  const flags = {};
  const positional = [];
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--') {
      positional.push(...args.slice(i + 1));
      return { flags, positional, cmd: null };
    }
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (VALUE_FLAGS.has(name)) {
        const v = args[i + 1];
        if (v === undefined) throw new CliError(EXIT.usage, `option --${name} requires a value`);
        flags[name] = v;
        i += 2;
        continue;
      }
      if (BOOL_FLAGS.has(name)) {
        flags[name] = true;
        i += 1;
        continue;
      }
      throw new CliError(EXIT.usage, `unknown option: --${name}`);
    }
    positional.push(a);
    i += 1;
  }
  return { flags, positional, cmd: null };
}

function optsFrom(cwd, config, configPath, flags) {
  return {
    cwd,
    config,
    configPath,
    format: flags.format ?? null,
  };
}

function requireFormat(flags, fallback) {
  return flags.format ?? fallback;
}

export async function run(argv, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (e instanceof CliError) return fail(e);
    throw e;
  }
  const { flags, positional } = parsed;

  try {
    if (flags.version) return { stdout: `tux ${VERSION}\n`, exit: EXIT.ok };
    if (flags.help || positional.length === 0) return { stdout: help(), exit: EXIT.ok };

    const domain = positional[0];
    const action = positional[1];

    if (domain === 'feedback') {
      const { config, configPath } = loadConfig(cwd, flags);
      const opts = optsFrom(cwd, config, configPath, flags);
      opts.format = requireFormat(flags, opts.format);
      switch (action) {
        case 'show': {
          const id = positional[2];
          opts.format = flags.format ?? 'text';
          return opShow(opts, id, {
            status: flags.status, type: flags.type, mine: flags.mine ?? false,
            route: flags.route, session: flags.session, origin: flags.origin,
          });
        }
        case 'create':
          return opCreate(opts, {
            type: flags.type ?? 'issue',
            text: flags.text,
            route: flags.route,
            page: flags.page,
            component: flags.component,
            instance: flags['component-instance'] ?? flags.instance,
            tuxId: flags['tux-id'],
            testId: flags['test-id'],
            session: flags.session,
            environment: flags.environment,
            origin: flags.origin,
          });
        case 'update': {
          const id = positional[2];
          if (!id) throw new CliError(EXIT.usage, 'usage: tux feedback update <feedback-id>');
          return opUpdate(opts, id, { text: flags.text, type: flags.type, status: flags.status });
        }
        case 'delete': {
          const id = positional[2];
          if (!id) throw new CliError(EXIT.usage, 'usage: tux feedback delete <feedback-id>');
          opts.format = flags.format ?? 'text';
          return opDelete(opts, id);
        }
        case 'clear':
          opts.format = flags.format ?? 'text';
          return opClear(opts, flags.all ? 'all' : flags.mine ? 'mine' : undefined, {
            force: flags.force ?? false, route: flags.route, session: flags.session,
          });
        case 'export':
          return opExport(opts, flags.format === 'jsonl' ? 'jsonl' : 'json');
        case 'incorporate':
          return opIncorporate(opts, flags.strategy, {
            mine: flags.mine ?? false, route: flags.route, session: flags.session, origin: flags.origin,
          });
        case 'validate':
          return opValidate(opts, {
            record: flags.record ?? undefined,
            result: flags.result,
            note: flags.note,
            strict: flags.strict ?? false,
            origin: flags.origin,
          });
        default:
          throw new CliError(EXIT.usage, `unknown action: ${action ?? '(missing)'} for domain ${domain}`);
      }
    }

    if (domain === 'design' || domain === 'live') {
      const { config, configPath } = loadConfig(cwd, flags);
      const opts = optsFrom(cwd, config, configPath, flags);
      const isDesign = domain === 'design';
      opts.format = requireFormat(flags, 'json');
      switch (action) {
        case 'install':
          return isDesign
            ? opDesignInstall(opts, { framework: flags.framework, root: flags.root })
            : opLiveInstall(opts);
        case 'create':
          return isDesign
            ? opDesignCreate(opts, { framework: flags.framework, name: flags.name })
            : opLiveCreate(opts, { framework: flags.framework, name: flags.name });
        case 'start-review':
          opts.format = flags.format ?? 'json';
          if (isDesign) {
            return await opDesignStart(opts, {
              dir: flags.dir,
              port: flags.port ? Number(flags.port) : undefined,
              host: flags.host,
              session: flags.session,
              environment: flags.environment,
              dryRun: flags['dry-run'] ?? false,
              foreground: flags.foreground ?? false,
            });
          }
          return await opLiveStart(opts, {
            url: flags.url ?? null,
            cmd: parsed.cmd && parsed.cmd.length ? parsed.cmd.join(' ') : (positional.length > 2 ? positional.slice(2).join(' ') : null),
            targetPort: flags['target-port'] ? Number(flags['target-port']) : undefined,
            port: flags.port ? Number(flags.port) : undefined,
            host: flags.host,
            session: flags.session,
            environment: flags.environment,
            dryRun: flags['dry-run'] ?? false,
            foreground: flags.foreground ?? false,
          });
        case 'status': {
          opts.format = flags.format ?? 'text';
          return await opLiveStatus(opts);
        }
        case 'stop-review': {
          opts.format = flags.format ?? 'text';
          return opLiveStop(opts);
        }
        default:
          throw new CliError(EXIT.usage, `unknown action: ${action ?? '(missing)'} for domain ${domain}`);
      }
    }

    throw new CliError(EXIT.usage, `unknown command: ${domain}`);
  } catch (e) {
    if (e instanceof CliError) return fail(e);
    return { stdout: '', stderr: `error: internal: ${e.message}\n`, exit: EXIT.general };
  }
}

function fail(e) {
  return { stdout: '', stderr: `error: ${e.message}\n`, exit: e.code };
}

function help() {
  return [
    'tux <domain> <action> [arguments] [options]',
    '',
    'domains:',
    '  design    install | create | start-review | status | stop-review',
    '  live      install | create | start-review | status | stop-review',
    '  feedback  show | create | update | delete | clear | export | incorporate | validate',
    '',
    'options:',
    '  --config <path>     project config (default: tux.config.json)',
    '  --format json|text  output format',
    '  --version           print version',
    '  --help              this help',
    '',
  ].join('\n');
}
