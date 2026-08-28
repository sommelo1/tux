/**
 * Project configuration (`tux.config.json`) with canonical precedence:
 * CLI → environment → config file → defaults (SPC section 76).
 *
 * @module config
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CliError } from './errors.js';

export const CONFIG_FILE = 'tux.config.json';

export function defaultConfig(cwd) {
  return {
    project_id: basename(cwd),
    design: { root: 'requirements', framework: 'vanilla' },
    review: { enabled: true, store: '.tux/feedback.json', host: '127.0.0.1', port: 4173 },
    identity: { provider: 'local', user_id: 'anonymous', display_name: 'Anonymous', admins: [] },
  };
}

/**
 * @param {string} cwd project working directory
 * @param {{config?: string}} cliOpts CLI options (`--config`)
 * @returns {{config: object, configPath: string|null, cwd: string}}
 */
export function loadConfig(cwd, cliOpts = {}) {
  const config = defaultConfig(cwd);
  let configPath = cliOpts.config ?? process.env.TUX_CONFIG ?? null;
  if (configPath === null && existsSync(join(cwd, CONFIG_FILE))) configPath = join(cwd, CONFIG_FILE);
  if (configPath !== null) {
    if (!existsSync(configPath)) throw new CliError(3, `config file not found: ${configPath}`);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
      throw new CliError(3, `invalid config JSON in ${configPath}: ${e.message}`);
    }
    mergeConfig(config, parsed);
  }
  const env = process.env;
  if (env.TUX_PROJECT_ID !== undefined) config.project_id = env.TUX_PROJECT_ID;
  if (env.TUX_STORE !== undefined) config.review.store = env.TUX_STORE;
  if (env.TUX_HOST !== undefined) config.review.host = env.TUX_HOST;
  if (env.TUX_PORT !== undefined) config.review.port = Number(env.TUX_PORT);
  if (env.TUX_USER_ID !== undefined) config.identity.user_id = env.TUX_USER_ID;
  if (env.TUX_DISPLAY_NAME !== undefined) config.identity.display_name = env.TUX_DISPLAY_NAME;
  return { config, configPath, cwd };
}

function mergeConfig(target, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object') {
      mergeConfig(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

/** Resolve the effective reviewer identity. */
export function resolveIdentity(config) {
  return {
    user_id: config.identity.user_id || 'anonymous',
    display_name: config.identity.display_name || 'Anonymous',
    admins: config.identity.admins ?? [],
  };
}

export function isAdmin(config, userId) {
  return resolveIdentity(config).admins.includes(userId);
}
