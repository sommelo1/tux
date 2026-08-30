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

  // re-edit: the target element stays outlined while its editor is open
  await page.locator('.tux-marker').click();
  await expect(page.locator('.tux-editor')).toBeVisible();
  await expect(page.locator('.tux-editing')).toHaveCount(1);
  const editingTarget = await page.evaluate(() => document.querySelector('.tux-editing')?.getAttribute('data-tux-id'));
  expect(editingTarget).toBe('product-price-p1');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.tux-editing')).toHaveCount(0);

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

test('editor and markers render styled inside native dialogs (SPC 11, 12)', async ({ page }) => {
  tux('feedback clear --all --force');
  await page.goto('/checkout');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(true);

  // open the modal while commenting is off, then activate commenting:
  // the launcher must stay clickable above the modal backdrop
  await page.click('[data-tux-id="coupon-open"]');
  await page.click('[data-tux-launcher]');
  await expect.poll(() => page.evaluate(() => window.TUXReview.mode)).toBe(true);

  // sidebar and toast reparent into the dialog too — the close button
  // must be clickable above the backdrop
  const sidebar = page.locator('#coupon-modal .tux-sidebar.tux-open');
  await expect(sidebar).toBeVisible();
  await page.click('#coupon-modal [data-tux-sb-close]');
  await expect(page.locator('#coupon-modal .tux-sidebar')).not.toHaveClass(/tux-open/);

  // the editor portals into the dialog and must arrive styled, not as
  // unstyled DOM (it lives outside #tux-root when portaled)
  await page.click('[data-tux-id="coupon-input"]');
  const editor = page.locator('#coupon-modal .tux-editor.tux-open');
  await expect(editor).toBeVisible();
  const style = await editor.evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      position: cs.position, width: cs.width, radius: cs.borderTopLeftRadius,
      bg: cs.backgroundColor, border: cs.borderTopWidth, z: cs.zIndex,
      inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    };
  });
  expect(style.position).toBe('fixed');
  expect(style.width).toBe('300px');
  expect(style.radius).toBe('12px');
  expect(style.bg).toBe('rgb(255, 255, 255)');
  expect(style.border).toBe('1px');
  expect(style.z).toBe('2147483002');
  expect(style.inViewport).toBe(true);

  // save → the marker lands inside the dialog, styled as well
  await editor.locator('[data-ed-text]').fill('Styled inside the dialog');
  await editor.locator('[data-act="save"]').click();
  await expect(page.locator('#coupon-modal .tux-toast.tux-visible')).toBeVisible();
  const marker = page.locator('#coupon-modal .tux-marker');
  await expect(marker).toHaveCount(1);
  const mStyle = await marker.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { height: cs.height, radius: cs.borderRadius, bg: cs.backgroundColor, pos: cs.position };
  });
  expect(mStyle.height).toBe('22px');
  expect(mStyle.radius).toBe('11px');
  expect(mStyle.bg).toBe('rgb(249, 168, 37)');
  expect(mStyle.pos).toBe('fixed');
});

test('hover outline highlights host elements and dialog elements (SPC 12)', async ({ page }) => {
  await page.goto('/checkout');
  await expect.poll(() => page.evaluate(() => window.__TUX_READY__ ?? false)).toBe(true);
  await page.click('[data-tux-launcher]'); // commenting on

  // host element outside any tux container
  await page.hover('[data-tux-id="checkout-submit"]');
  const outside = await page.evaluate(() => {
    const el = document.querySelector('[data-tux-id="checkout-submit"]');
    return { has: el.classList.contains('tux-hover'), style: getComputedStyle(el).outlineStyle };
  });
  expect(outside.has).toBe(true);
  expect(outside.style).toBe('dashed');

  // inside the modal dialog: off → open → on, then hover dialog content
  await page.click('[data-tux-launcher]');
  await page.click('[data-tux-id="coupon-open"]');
  await page.click('[data-tux-launcher]');
  await page.hover('[data-tux-id="coupon-input"]');
  const inside = await page.evaluate(() => {
    const el = document.querySelector('[data-tux-id="coupon-input"]');
    return { has: el.classList.contains('tux-hover'), style: getComputedStyle(el).outlineStyle };
  });
  expect(inside.has).toBe(true);
  expect(inside.style).toBe('dashed');
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

test('markers re-anchor after layout changes and follow dialog visibility (SPC 60)', async ({ page }) => {
  tux('feedback clear --all --force');
  await page.goto('/products');
  await page.click('[data-tux-launcher]');
  await page.click('[data-tux-id="product-price-p1"]');
  await expect(page.locator('.tux-editor')).toBeVisible();
  await page.locator('[data-ed-text]').fill('Re-anchor regression check');
  await page.locator('[data-act="save"]').click();
  const marker = page.locator('.tux-marker');
  await expect(marker).toHaveCount(1);
  const target = page.locator('[data-tux-id="product-price-p1"]');

  const assertAnchored = async () => {
    const tb = await target.boundingBox();
    const mb = await marker.boundingBox();
    const anchorX = tb.x + tb.width - 12;
    const anchorY = Math.max(0, tb.y - 8);
    expect(Math.abs(mb.x - anchorX)).toBeLessThan(40);
    expect(Math.abs(mb.y - anchorY)).toBeLessThan(40);
  };

  await assertAnchored();

  // layout change 1: viewport resize (responsive reflow)
  await page.setViewportSize({ width: 760, height: 800 });
  await page.waitForTimeout(120);
  await assertAnchored();

  // layout change 2: back to wide
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(120);
  await assertAnchored();

  // dialog visibility: feedback inside the modal hides with the dialog
  // and reappears next to its element when the dialog opens again.
  // The coupon modal only exists on the checkout route (SPC 15, 60).
  await page.click('[data-tux-launcher]'); // mode off for app navigation
  await page.click('[data-tux-id="nav-checkout"]');
  await expect(page.locator('[data-tux-id="checkout-submit"]')).toBeVisible();
  await page.click('[data-tux-id="coupon-open"]');
  await expect(page.locator('#coupon-modal')).toBeVisible();
  await page.keyboard.press('Alt+t');
  await page.click('[data-tux-id="coupon-input"]');
  await page.locator('[data-ed-type]').selectOption('change');
  await page.locator('[data-ed-text]').fill('Modal re-visibility check');
  await page.locator('[data-act="save"]').click();
  const modalPin = page.locator('.tux-marker');
  await expect(modalPin).toHaveCount(1);
  await page.keyboard.press('Escape'); // app closes the modal
  await expect(page.locator('#coupon-modal')).not.toBeVisible();
  await expect(modalPin).toBeHidden(); // the fix: hidden, not parked at stale coordinates
  await page.click('[data-tux-id="coupon-open"]');
  await expect(page.locator('#coupon-modal')).toBeVisible();
  await expect(modalPin).toBeVisible(); // the fix: re-anchored when visible again
  const tb = await page.locator('[data-tux-id="coupon-input"]').boundingBox();
  const mb = await modalPin.boundingBox();
  expect(Math.abs(mb.x - (tb.x + tb.width - 12))).toBeLessThan(40);

  // reload keeps the anchored restore path intact
  await page.reload();
  await expect(page.locator('.tux-marker')).toHaveCount(1);
  await expect(page.locator('.tux-marker')).toBeHidden(); // modal closed after reload
});

test('restored dialog marker re-parents into the dialog when it opens (SPC 12, 60)', async ({ page }) => {
  tux('feedback clear --all --force');
  await page.goto('/checkout');
  await page.click('[data-tux-launcher]'); // mode on
  await page.click('[data-tux-launcher]'); // mode off, so the app button works
  await page.click('[data-tux-id="coupon-open"]');
  await page.keyboard.press('Alt+t');
  await page.click('[data-tux-id="coupon-input"]');
  await page.locator('[data-ed-text]').fill('Restore re-parent check');
  await page.locator('[data-act="save"]').click();
  await expect(page.locator('#coupon-modal .tux-marker')).toHaveCount(1);

  // close the dialog, then reload: the pin restores while the dialog is
  // closed (page layer, hidden) and must re-parent into the dialog top
  // layer when the dialog opens again — not stay covered by the backdrop
  await page.keyboard.press('Escape');
  await expect(page.locator('#coupon-modal')).not.toBeVisible();
  await page.reload();
  await expect(page.locator('.tux-marker')).toHaveCount(1);
  await expect(page.locator('.tux-marker')).toBeHidden();

  await page.click('[data-tux-id="coupon-open"]');
  await expect(page.locator('#coupon-modal')).toBeVisible();
  const marker = page.locator('#coupon-modal .tux-marker');
  await expect(marker).toHaveCount(1);
  await expect(marker).toBeVisible();
  const tb = await page.locator('[data-tux-id="coupon-input"]').boundingBox();
  const mb = await marker.boundingBox();
  expect(Math.abs(mb.x - (tb.x + tb.width - 12))).toBeLessThan(40);
  expect(Math.abs(mb.y - Math.max(0, tb.y - 8))).toBeLessThan(40);
});
