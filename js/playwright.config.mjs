/**
 * Playwright config: three review-capable/non-capable servers cover the
 * activation matrix (SPC sections 62–70).
 */
import { defineConfig } from '@playwright/test';
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, '..', '..', 'examples', 'design-vanilla');

export default defineConfig({
  testDir: join(here, 'e2e'),
  globalSetup: join(here, 'e2e', 'global-setup.mjs'),
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4181',
    trace: 'off',
  },
  webServer: [
    {
      command: 'node ../../js/bin/tux.js design start-review --foreground --port 4181',
      cwd: example,
      url: 'http://127.0.0.1:4181/api/tux/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node ../../js/bin/tux.js design start-review --foreground --port 4182 --config ../../js/e2e/fixtures/config-disabled.json',
      cwd: example,
      url: 'http://127.0.0.1:4182/api/tux/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node ../../js/e2e/helpers/static-server.mjs 4183',
      cwd: join(here, '..', '..'),
      url: 'http://127.0.0.1:4183/',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
  report: process.env.CI ? 'line' : 'line',
});
