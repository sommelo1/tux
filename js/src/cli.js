/**
 * `tux` command-line interface (SPC sections 25, 74, 75).
 *
 * Grammar: `tux <domain> <action> [arguments] [options]`.
 * Machine output: canonical JSON on stdout; diagnostics on stderr as
 * `error: <message>` lines with canonical exit codes.
 *
 * @module cli
 */
import { CliError, EXIT } from './errors.js';
import { loadConfig, resolveIdentity } from './config.js';
import { nowMs } from './ids.js';
import { opList, opShow, opCreate, opUpdate, opDelete, opClear, opExport, opIncorporate, opValidate } from './feedback.js';
import { opDesignIntegrate, opDesignCreate } from './design.js';
import { opReviewIntegrate, opReviewStart, opReviewStatus, opReviewStop } from './review.js';
import { startServer } from './server.js';

export const VERSION = '0.1.0';

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

    if (domain === '_serve') {
      return await serveHidden(cwd, flags, positional);
    }

    if (domain === 'feedback') {
      const { config, configPath } = loadConfig(cwd, flags);
      const opts = optsFrom(cwd, config, configPath, flags);
      opts.format = requireFormat(flags, opts.format);
      switch (action) {
        case 'list':
          opts.format = flags.format ?? 'text';
          return opList(opts, {
            status: flags.status, type: flags.type, mine: flags.mine ?? false,
            route: flags.route, session: flags.session,
          });
        case 'show': {
          const id = positional[2];
          if (!id) throw new CliError(EXIT.usage, 'usage: tux feedback show <feedback-id>');
          return opShow(opts, id);
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
            mine: flags.mine ?? false, route: flags.route, session: flags.session,
          });
        case 'validate':
          return opValidate(opts, {
            record: flags.record ?? undefined,
            result: flags.result,
            note: flags.note,
            strict: flags.strict ?? false,
          });
        default:
          throw new CliError(EXIT.usage, `unknown action: ${action ?? '(missing)'} for domain ${domain}`);
      }
    }

    if (domain === 'design') {
      const { config, configPath } = loadConfig(cwd, flags);
      const opts = optsFrom(cwd, config, configPath, flags);
      opts.format = requireFormat(flags, 'json');
      switch (action) {
        case 'integrate':
          return opDesignIntegrate(opts, { framework: flags.framework, root: flags.root });
        case 'create':
          return opDesignCreate(opts, { framework: flags.framework, name: flags.name });
        case 'serve': {
          const root = flags.dir ?? config.design.root;
          return serveForeground({ cwd, config, flags: { ...flags, dir: root }, mode: 'design' });
        }
        default:
          throw new CliError(EXIT.usage, `unknown action: ${action ?? '(missing)'} for domain ${domain}`);
      }
    }

    if (domain === 'review') {
      const { config, configPath } = loadConfig(cwd, flags);
      const opts = optsFrom(cwd, config, configPath, flags);
      switch (action) {
        case 'integrate':
          opts.format = flags.format ?? 'json';
          return opReviewIntegrate(opts);
        case 'start': {
          const cmd = parsed.cmd && parsed.cmd.length ? parsed.cmd.join(' ') : (positional.length > 2 ? positional.slice(2).join(' ') : null);
          opts.format = flags.format ?? 'json';
          return await opReviewStart(opts, {
            url: flags.url ?? null,
            cmd,
            targetPort: flags['target-port'] ? Number(flags['target-port']) : undefined,
            port: flags.port ? Number(flags.port) : undefined,
            host: flags.host,
            session: flags.session,
            environment: flags.environment,
            dryRun: flags['dry-run'] ?? false,
          });
        }
        case 'status': {
          opts.format = flags.format ?? 'text';
          return await opReviewStatus(opts);
        }
        case 'stop': {
          opts.format = flags.format ?? 'text';
          return opReviewStop(opts);
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

async function serveHidden(cwd, flags) {
  const { config } = loadConfig(cwd, flags);
  const server = startServer({
    mode: flags.mode ?? 'design',
    host: flags.host ?? config.review.host,
    port: Number(flags.port ?? config.review.port),
    root: flags.root ?? null,
    target: flags.target ?? null,
    cwd,
    session: flags.session ?? 'default',
    environment: flags.environment ?? (flags.mode === 'design' ? 'design' : 'development'),
    config,
  });
  await new Promise((resolvePromise) => server.listen(Number(flags.port ?? config.review.port), flags.host ?? config.review.host, resolvePromise));
  return { stdout: '', exit: EXIT.ok, keepAlive: server };
}

function serveForeground({ cwd, config, flags, mode }) {
  const root = flags.dir ?? config.design.root;
  const host = flags.host ?? config.review.host;
  const port = Number(flags.port ?? config.review.port);
  const session = flags.session ?? 'default';
  const server = startServer({
    mode,
    host,
    port,
    root,
    target: null,
    cwd,
    session,
    environment: mode === 'design' ? 'design' : 'development',
    config,
  });
  server.listen(port, host);
  return {
    stdout: `serving ${mode} at http://${host}:${port} (Ctrl+C to stop)\n`,
    exit: EXIT.ok,
    keepAlive: server,
  };
}

function fail(e) {
  return { stdout: '', stderr: `error: ${e.message}\n`, exit: e.code };
}

function help() {
  return [
    'tux <domain> <action> [arguments] [options]',
    '',
    'domains:',
    '  design    integrate | create | serve',
    '  review    integrate | start | status | stop',
    '  feedback  list | show | create | update | delete | clear | export | incorporate | validate',
    '',
    'options:',
    '  --config <path>     project config (default: tux.config.json)',
    '  --format json|text  output format',
    '  --version           print version',
    '  --help              this help',
    '',
  ].join('\n');
}
