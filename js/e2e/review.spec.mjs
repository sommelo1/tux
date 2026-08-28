/**
 * Review flows against the vanilla design: boot, element selection,
 * feedback CRUD through the UI, reload restore, SPA navigation,
 * component/instance identity, UI-state capture, CLI machine interface.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, '..', '..', 'examples', 'design-vanilla');
const tux = (args) => execSync(`node ../../js/bin/tux.js ${args}`, { cwd: example, encoding: 'utf8' });

test('client boots by default (default activation, SPC 64)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-tux-launcher]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__)).toBe(true);
});

test('create → persist → reload → restore across routes and modal (SPC 85, 88)', async ({ page }) => {
  tux('feedback clear --all --force');
  await page.goto('/products');

  // 1) comment on a component instance (price label of product p1)
  await page.click('[data-tux-launcher]');
  await page.click('[data-tux-id="product-price-p1"]');
  await expect(page.locator('.tux-editor')).toBeVisible();
  await page.locator('[data-ed-type]').selectOption('issue');
  await page.locator('[data-ed-text]').fill('Price label too small');
  await page.locator('[data-act="save"]').click();
  await expect(page.locator('.tux-editor')).toHaveCount(0);
  await expect(page.locator('.tux-marker')).toHaveCount(1);

  // 2) SPA navigation without reload (SPC 59): mode off → click nav link
  await page.click('[data-tux-launcher]'); // mode off
  await page.click('[data-tux-id="nav-checkout"]');
  await expect(page.locator('[data-tux-id="checkout-submit"]')).toBeVisible();

  // 3) open the modal (app interaction), then comment INSIDE the modal (SPC 15, 60).
  // The native <dialog> holds the browser top layer, so use the Alt+T toggle.
  await page.click('[data-tux-id="coupon-open"]');
  await expect(page.locator('#coupon-modal')).toBeVisible();
  await page.keyboard.press('Alt+t');
  await page.click('[data-tux-id="coupon-input"]');
  await page.locator('[data-ed-type]').selectOption('change');
  await page.locator('[data-ed-text]').fill('Bigger coupon input');
  await page.locator('[data-act="save"]').click();
  await expect(page.locator('.tux-editor')).toHaveCount(0);
  await expect(page.locator('.tux-marker')).toHaveCount(1);

  // 4) reload → marker restored in the right context (SPC 12, 13)
  await page.reload();
  await expect(page.locator('.tux-marker')).toHaveCount(1);

  // 5) machine interface: CLI sees both items with route + ui_state (SPC 42, 85)
  const list = JSON.parse(tux('feedback show --format json'));
  expect(list).toHaveLength(2);
  const productItem = list.find((f) => f.location.route === '/products');
  const modalItem = list.find((f) => f.location.route === '/checkout');
  expect(productItem.target.tux_id).toBe('product-price-p1');
  expect(productItem.target.component).toBe('PriceLabel');
  expect(productItem.location.component_instance).toBe('p1');
  expect(modalItem.ui_state.modal).toBe('coupon-modal');
  expect(productItem.status).toBe('open');
  expect(modalItem.feedback.type).toBe('change');

  // 6) navigate back to /products via SPA → only the product marker shows
  await page.click('[data-tux-id="nav-home"]');
  await page.click('[data-tux-id="nav-products"]');
  await expect(page.locator('.tux-marker')).toHaveCount(1);
});

test('edit and delete own feedback via marker flyout', async ({ page }) => {
  tux('feedback clear --all --force');
  await page.goto('/products');
  await page.click('[data-tux-launcher]');
  await page.click('[data-tux-id="product-price-p1"]');
  await page.locator('[data-ed-text]').fill('Original text');
  await page.locator('[data-act="save"]').click();
  await expect(page.locator('.tux-editor')).toHaveCount(0);
  await expect(page.locator('.tux-marker')).toHaveCount(1);

  // edit
  await page.locator('.tux-marker').first().click();
  await expect(page.locator('.tux-editor')).toBeVisible();
  await page.locator('[data-ed-text]').fill('Edited text');
  await page.locator('[data-act="save"]').click();
  await expect(page.locator('.tux-editor')).toHaveCount(0);
  const list = JSON.parse(tux('feedback show --format json'));
  expect(list[0].feedback.text).toBe('Edited text');

  // delete
  await page.locator('.tux-marker').first().click();
  await expect(page.locator('.tux-editor')).toBeVisible();
  await page.locator('[data-act="delete"]').click();
  await expect(page.locator('.tux-editor')).toHaveCount(0);
  await expect(page.locator('.tux-marker')).toHaveCount(0);
  const after = JSON.parse(tux('feedback show --format json'));
  expect(after).toHaveLength(0);
});

test('URL override ?tux=off disables, ?tux=on re-enables (SPC 66–68)', async ({ page }) => {
  await page.goto('/?tux=off');
  await expect(page.locator('[data-tux-launcher]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(false);

  // sticky override: SPA navigation keeps TUX off in the same tab
  await page.goto('/?tux=on');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(true);
  await page.click('[data-tux-id="nav-products"]');
  await expect.poll(() => page.evaluate(() => window.TUXReview.mode !== undefined)).toBe(true);

  await page.goto('/?tux=off');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(false);
});

test('unknown ?tux value is ignored with a warning, not interpreted (SPC 69)', async ({ page }) => {
  const warnings = [];
  page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
  await page.goto('/?tux=foo');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(true);
  expect(warnings.some((w) => w.includes('?tux'))).toBeTruthy();
});

test('config disabled: client inert, ?tux=on wins at runtime (SPC 65, 67, 89)', async ({ page }) => {
  await page.goto('http://127.0.0.1:4182/');
  await expect.poll(() => page.evaluate(() => window.__TUX__?.enabled ?? null)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(false);

  await page.goto('http://127.0.0.1:4182/?tux=on');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(true);

  await page.goto('http://127.0.0.1:4182/?tux=off');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(false);
});

test('build exclusion: no TUX code, ?tux=on has no effect (SPC 63, 70, 89)', async ({ page }) => {
  await page.goto('http://127.0.0.1:4183/');
  expect(await page.evaluate(() => window.__TUX__)).toBeUndefined();
  expect(await page.locator('[data-tux-launcher]').count()).toBe(0);

  await page.goto('http://127.0.0.1:4183/?tux=on');
  expect(await page.evaluate(() => window.__TUX__)).toBeUndefined();
  expect(await page.locator('[data-tux-launcher]').count()).toBe(0);
  expect(await page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(false);
});
