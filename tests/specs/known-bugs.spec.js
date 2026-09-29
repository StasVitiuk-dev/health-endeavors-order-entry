// Known bugs found while expanding the regression suite. Each test pins
// down today's wrong behaviour, so it passes now and documents the bug. When
// a bug is fixed, the matching test fails: turn it into a normal test that
// checks the correct behaviour. See docs/plans/regression-coverage-report.md.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test.beforeEach(async ({ backend }) => { seedBusiness(backend); });

test('B6 phone: swiping a wide table sideways also switches to another page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'touch swipe: phone only');
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.waitForLoadState('networkidle');
  const table = await page.locator('#ordersTableWrap table').boundingBox();
  const y = table.y + 60;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  // A finger drags right-to-left across the Orders table, the normal way to
  // see its hidden Total / Placed / Delete columns on a phone.
  await touch('touchStart', 330);
  for (let i = 1; i <= 8; i++) await touch('touchMove', 330 - 270 * i / 8);
  await touch('touchEnd');
  // Correct behaviour: stay on Orders. Today it jumps to the next page.
  await expect(page.locator('section#inventoryPanel')).toHaveClass(/activePage/);
});

test('B7: in the evening (US time) new expenses default to tomorrow\'s date', async ({ page }) => {
  // 9 pm in Chicago on June 15 is already June 16 in UTC.
  await page.clock.setFixedTime(new Date('2026-06-16T02:00:00Z'));
  await login(page);
  await gotoPage(page, 'expensesPanel');
  // Correct would be 2026-06-15.
  await expect(page.locator('#expDate')).toHaveValue('2026-06-16');
});
