/**
 * Internal entry point for the detached server child process.
 * Not part of the public CLI surface.
 */
import { resolve } from 'node:path';
import { startServer } from './server.js';

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const cwd = resolve(argValue('--cwd') ?? process.cwd());
const mode = argValue('--mode') ?? 'design';
const host = argValue('--host') ?? '127.0.0.1';
const port = Number(argValue('--port') ?? 4173);
const target = argValue('--target') ?? null;
const session = argValue('--session') ?? 'default';
const environment = argValue('--environment') ?? (mode === 'design' ? 'design' : 'development');
const store = argValue('--store') ?? '.tux/feedback.json';
const projectId = argValue('--project-id');
const root = argValue('--root') ?? null;

const server = startServer({
  mode,
  host,
  port,
  root,
  target,
  cwd,
  session,
  environment,
  config: {
    project_id: projectId ?? 'default',
    review: { enabled: true, store, host, port },
    identity: { provider: 'local', user_id: process.env.TUX_USER_ID ?? 'anonymous', display_name: process.env.TUX_DISPLAY_NAME ?? 'Anonymous', admins: [] },
  },
});

server.listen(port, host, () => {
  process.stdout.write(`tux server listening on http://${host}:${port}\n`);
});
