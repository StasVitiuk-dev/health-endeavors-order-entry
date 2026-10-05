// Phone: "swipe sideways to change page" must not fire when the finger is
// dragging something that scrolls sideways itself (the wide Orders table).
// It also stays inactive while a window like the quick reminder is open. Swiping elsewhere on the
// page still changes page, as before. Phone size only; synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'touch swipe: phone only');
});

async function swipeLeft(page, y, fromX = 330, toX = 60) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', fromX);
  for (let i = 1; i <= 8; i++) await touch('touchMove', fromX - (fromX - toX) * i / 8);
  await touch('touchEnd');
  await page.waitForTimeout(300);
}

const active = page => page.locator('section.panel.activePage').getAttribute('id');

test.beforeEach(async ({ page, backend }) => {
  backend.tables.orders = Array.from({ length: 5 }, (_, i) => ({
    id: 'o' + i, order_number: 'SYN-100' + i, customer_name: 'SYNTHETIC Customer With A Long Name ' + i,
    customer_email: `c${i}@example.test`, status: 'partially_refunded', currency: 'USD', total: 10 + i,
    placed_at: '2026-09-2' + i + 'T12:00:00Z', deleted_at: null,
  }));
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
});

test('swiping the wide Orders table sideways stays on Orders', async ({ page }) => {
  const table = page.locator('#ordersTableWrap table');
  const box = await table.boundingBox();
  // The table really is wider than the phone screen (it scrolls sideways).
  expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await swipeLeft(page, box.y + 60);
  expect(await active(page)).toBe('ordersPanel');
});

test('swiping outside any sideways-scrolling area still changes page', async ({ page }) => {
  const heading = await page.locator('#ordersPanel h2').first().boundingBox();
  await swipeLeft(page, heading.y + heading.height / 2);
  expect(await active(page)).not.toBe('ordersPanel');
});

// Verifies existing behaviour (not changed by this fix): the open window
// covers the page, so the swipe never reaches it.
test('swiping while the quick reminder window is open does not change page', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+n');
  await expect(page.locator('#quickAddOverlay')).toHaveClass(/open/);
  const heading = await page.locator('#ordersPanel h2').first().boundingBox();
  await swipeLeft(page, heading.y + heading.height / 2);
  expect(await active(page)).toBe('ordersPanel');
});
