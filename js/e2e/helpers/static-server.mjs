/**
 * Plain static file server WITHOUT any TUX code — simulates a deployment
 * where TUX was excluded from the build (SPC section 63). Serves the same
 * example design untouched so `?tux=on` must have no effect.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', 'examples', 'design-vanilla');
const port = Number(process.argv[2] ?? 4183);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

createServer((req, res) => {
  let rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (rel === '') rel = 'index.html';
  let file = join(root, rel);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = [join(file, 'index.html'), file + '.html'].find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => process.stdout.write(`static on ${port}\n`));
