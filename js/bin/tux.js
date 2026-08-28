#!/usr/bin/env node
/** Entry point for the `tux` binary. */
import { run } from '../src/cli.js';

const isTTY = process.stdin.isTTY ?? false;
const result = await run(process.argv.slice(2), { isTTY });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.keepAlive) {
  // keep the process alive while a foreground server runs
  process.on('SIGINT', () => {
    result.keepAlive.close();
    process.exit(0);
  });
} else {
  process.exitCode = result.exit;
}
