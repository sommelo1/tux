#!/usr/bin/env node
/**
 * Re-records the README showcase GIF (docs/showcase-review.gif) end to end:
 * clean store → design review server → Playwright recording of the full
 * review cycle (activate → mark element → create → edit → delete, with a
 * synthetic pointer since screencasts render no cursor) → ffmpeg
 * palette-optimized GIF.
 *
 * Prerequisites: `npm install` in js/ (Playwright + Chromium) and ffmpeg on
 * PATH. The showcase store is reset so the next `start.cmd` re-seeds its
 * example comments.
 *
 * Usage: node tools/record-showcase-gif.mjs [--out docs/showcase-review.gif]
 *             [--fps 10] [--width 900] [--colors 128] [--port 4321]
 *             [--keep-webm]
 */
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const showcase = join(repo, 'examples', 'showcase');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── arguments ───
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  if (i + 1 >= args.length) usage(`missing value for ${name}`);
  return args[i + 1];
};
const has = (name) => args.includes(name);
if (has('--help')) usage();
function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('usage: node tools/record-showcase-gif.mjs [--out <gif>] [--fps 10] [--width 900] [--colors 128] [--port 4321] [--keep-webm]');
  process.exit(2);
}
const out = flag('--out', join(repo, 'docs', 'showcase-review.gif'));
const fps = flag('--fps', '10');
const width = flag('--width', '900');
const colors = flag('--colors', '128');
const port = Number(flag('--port', '4321'));
const keepWebm = has('--keep-webm');

// ─── prerequisites ───
let chromium;
try {
  chromium = createRequire(pathToFileURL(join(repo, 'js', 'package.json')))('playwright').chromium;
} catch {
  console.error('error: playwright not found — run "npm install" in js/ first');
  process.exit(1);
}
const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpeg.error || ffmpeg.status !== 0) {
  console.error('error: ffmpeg not found on PATH — install it (e.g. winget install Gyan.FFmpeg)');
  process.exit(1);
}

// ─── review server lifecycle ───
let server = null;
function killServer() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}
process.on('exit', killServer);

async function portReachable() {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}
async function waitPort(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('review server exited early — run it manually to inspect the failure');
    if (await portReachable()) return;
    await sleep(250);
  }
  throw new Error(`review server did not start on port ${port} within ${Math.round(timeoutMs / 1000)} s`);
}

// ─── recording helpers ───
const VIEW_W = 1280;
const VIEW_H = 800;

async function recordFlow(page) {
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await page.goto(`http://127.0.0.1:${port}/products`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__TUX_READY__ === true);

  // fake cursor overlay — Playwright screencast does not render a mouse pointer
  await page.addStyleTag({
    content: `
      @keyframes gif-click-ring { from { transform: scale(.35); opacity: .85; } to { transform: scale(1.7); opacity: 0; } }
      #gif-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,.55)); }
      .gif-ring { position: fixed; z-index: 2147483646; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border: 3px solid rgba(124,92,255,.95); border-radius: 50%; pointer-events: none;
        animation: gif-click-ring .45s ease-out forwards; }`,
  });
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = 'gif-cursor';
    c.innerHTML =
      '<svg width="21" height="21" viewBox="0 0 24 24">' +
      '<path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z" ' +
      'fill="#fff" stroke="#111" stroke-width="1.2"/></svg>';
    document.documentElement.appendChild(c);
  });

  let cursor = { x: 520, y: 300 };
  await page.mouse.move(cursor.x, cursor.y);
  async function setCursor(x, y) {
    cursor = { x, y };
    await page.evaluate(
      ([cx, cy]) => {
        const c = document.getElementById('gif-cursor');
        if (c) { c.style.left = cx + 'px'; c.style.top = cy + 'px'; }
      },
      [x, y],
    );
  }
  async function glideTo(selector, steps = 30, settle = 450) {
    const { x, y } = await page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    const n = Math.max(8, steps);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const cx = Math.round(cursor.x + (x - cursor.x) * eased);
      const cy = Math.round(cursor.y + (y - cursor.y) * eased);
      await setCursor(cx, cy);
      await page.mouse.move(cx, cy);
      await sleep(14);
    }
    await setCursor(x, y);
    await sleep(settle);
  }
  async function ring(x, y) {
    await page.evaluate(
      ([cx, cy]) => {
        const r = document.createElement('div');
        r.className = 'gif-ring';
        r.style.left = cx + 'px';
        r.style.top = cy + 'px';
        document.documentElement.appendChild(r);
        setTimeout(() => r.remove(), 500);
      },
      [x, y],
    );
    await sleep(120);
  }
  async function click(locator) {
    const { x, y } = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await setCursor(x, y);
    await page.mouse.move(x, y, { steps: 6 });
    await sleep(150);
    await ring(x, y);
    await page.mouse.down();
    await page.mouse.up();
  }

  const launcher = page.locator('[data-tux-launcher]');
  const price = page.locator('[data-tux-id="price-card-2"]');
  const typeSel = page.locator('[data-ed-type]');
  const textBox = page.locator('[data-ed-text]');
  const marker = page.locator('.tux-marker');

  await sleep(1600); // page + invite hint ("To activate TUX review, click here")

  // 1) activate review mode
  await glideTo('[data-tux-launcher]', 34, 500);
  await click(launcher); // → toast "Review mode on — click an element", sidebar opens
  await sleep(1700);

  // 2) mark an element: glide across the grid so the dashed hover outline shows
  await glideTo('[data-tux-id="price-card-2"]', 40, 700);
  await click(price); // → editor "New feedback"
  await sleep(800);

  // 3) capture a comment (never mouse-click the native select: its popup is
  //    invisible in the screencast and would swallow the next click)
  await click(textBox);
  await sleep(300);
  await page.keyboard.type('Price overlaps the badge on small screens.', { delay: 32 });
  await ring(await typeSel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }));
  await typeSel.selectOption('issue');
  await sleep(450);
  await click(page.locator('[data-act="save"]')); // "Create" → toast "Feedback created"
  await marker.waitFor({ state: 'visible', timeout: 5000 });
  await sleep(1900); // toast + marker visible

  // 4) edit: click the marker → editor opens with the stored text
  await glideTo('.tux-marker', 26, 500);
  await click(marker); // → editor "Edit feedback", target outlined
  await sleep(900);
  await click(textBox);
  await page.keyboard.press('Control+a');
  await sleep(350);
  await page.keyboard.type('Better: stack the badge above the price.', { delay: 32 });
  await sleep(500);
  await click(page.locator('[data-act="save"]')); // → toast "Feedback updated"
  await sleep(1900);

  // 5) delete: click the marker → Delete
  await glideTo('.tux-marker', 26, 500);
  await click(marker);
  await sleep(900);
  await click(page.locator('[data-act="delete"]')); // → toast "Feedback deleted", marker gone
  await page.locator('.tux-marker').waitFor({ state: 'detached', timeout: 5000 });
  await sleep(2300);
}

// ─── main ───
const tmp = mkdtempSync(join(tmpdir(), 'tux-gif-'));
try {
  if (await portReachable()) {
    console.error(`error: port ${port} is already in use — stop the running showcase first (start.cmd stop)`);
    process.exit(4);
  }

  rmSync(join(showcase, '.tux'), { recursive: true, force: true }); // empty stage
  console.log(`starting review server on port ${port} ...`);
  server = spawn(process.execPath, [join(repo, 'js', 'bin', 'tux.js'), 'design', 'start-review', '--foreground'], {
    cwd: showcase,
    env: { ...process.env, TUX_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await waitPort(30000);

  console.log('recording the review flow ...');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: VIEW_W, height: VIEW_H },
      recordVideo: { dir: tmp, size: { width: VIEW_W, height: VIEW_H } },
    });
    const page = await context.newPage();
    await recordFlow(page);
    const video = page.video();
    await context.close();
    const webm = join(tmp, 'showcase-flow.webm');
    cpSync(await video.path(), webm);
    if (keepWebm) cpSync(webm, join(out, '..', `${basename(out, '.gif')}.webm`));
  } finally {
    await browser.close();
  }

  console.log(`converting to GIF (${fps} fps, ${width} px, ${colors} colors) ...`);
  const vf =
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];` +
    `[s0]palettegen=max_colors=${colors}:stats_mode=diff[p];` +
    `[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  const converted = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', join(tmp, 'showcase-flow.webm'), '-vf', vf, join(tmp, 'out.gif')], { stdio: 'inherit' });
  if (converted.status !== 0) {
    console.error('error: ffmpeg GIF conversion failed');
    process.exit(1);
  }

  mkdirSync(join(out, '..'), { recursive: true });
  cpSync(join(tmp, 'out.gif'), out);
  console.log(`wrote ${out}`);
} finally {
  killServer();
  rmSync(join(showcase, '.tux'), { recursive: true, force: true }); // showcase re-seeds on next start
  try {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    console.log(`note: temp dir could not be removed: ${tmp}`);
  }
}
