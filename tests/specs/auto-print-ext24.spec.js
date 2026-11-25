// Automatic daily printing, the dashboard's part (owner, Nov 24: "every day it should
// print automatically on my printer"; decided: yesterday's day pack at 8:00 AM on the
// Mac next to the printer). Something on the Mac opens the dashboard with the daily
// link; the dashboard prints yesterday's day pack, once a day per browser.
// assets/reports/he-auto-print.js and its section on Backups & Printouts. Everything
// is made up; window.print is replaced.
const A = require('../../assets/reports/he-auto-print.js');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

test.describe('the rules (no browser)', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

  test('the daily link is recognised exactly; nothing else starts a print', () => {
    for (const yes of ['?print=daypack', '?x=1&print=daypack', '?print=daypack&x=1', '#print=daypack', 'print=daypack']) expect(A.wants(yes), yes).toBe(true);
    for (const no of ['', '?', '?print=', '?print=daypacks', '?reprint=daypack', '?print=DAYPACK', '?daypack', '?print=day%70ack', null, undefined, 7, {}, ['?print=daypack']]) expect(A.wants(no), String(no)).toBe(false);
  });

  test('yesterday is the day before today on the viewer\'s own calendar, across months and years', () => {
    expect(A.yesterday(new Date(2026, 10, 24, 0, 30).getTime())).toBe('2026-11-23');       // half past midnight
    expect(A.yesterday(new Date(2026, 10, 24, 23, 59).getTime())).toBe('2026-11-23');
    expect(A.yesterday(new Date(2026, 2, 1, 12).getTime())).toBe('2026-02-28');
    expect(A.yesterday(new Date(2028, 2, 1, 12).getTime())).toBe('2028-02-29');             // a leap year
    expect(A.yesterday(new Date(2027, 0, 1, 8).getTime())).toBe('2026-12-31');
    for (const junk of [null, undefined, 'x', NaN, Infinity, 1e300, {}]) expect(A.yesterday(junk)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('once a day: a day already printed is not printed again; anything unreadable counts as never printed', () => {
    const now = new Date(2026, 10, 24, 8, 0).getTime();
    expect(A.due('', now)).toEqual({ due: true, day: '2026-11-23', last: '' });
    expect(A.due('2026-11-22', now)).toMatchObject({ due: true, day: '2026-11-23' });
    expect(A.due('2026-11-23', now)).toMatchObject({ due: false, day: '2026-11-23' });
    expect(A.due('2026-11-30', now).due).toBe(false);                                        // a clock set back never prints an old day twice
    for (const junk of [null, undefined, 'yesterday', 20261123, {}, '2026-11-23T08:00']) expect(A.due(junk, now)).toMatchObject({ due: true, last: '' });
  });

  test('the link is made from the page\'s own address and nothing else', () => {
    expect(A.link('https://shop.example.test/app/owner-login.html')).toBe('https://shop.example.test/app/owner-login.html?print=daypack');
    expect(A.link('https://shop.example.test/owner-login.html?x=1&print=daypack#top')).toBe('https://shop.example.test/owner-login.html?print=daypack');
    expect(A.wants('?' + A.link('http://localhost:4173/owner-login.html').split('?')[1])).toBe(true);
    for (const bad of ['javascript:alert(1)', 'file:///x.html', 'owner-login.html', '', null, undefined, 7, {}]) expect(A.link(bad)).toBe('');
  });
});

const order = (n, placed, extra) => Object.assign({ id: 'ap-' + n, order_number: 'HE-' + (4000 + n), customer_name: 'SYNTHETIC client ' + n, customer_email: 'client' + n + '@example.test', channel: 'shopify', source: 'shopify', status: 'paid', currency: 'USD', total: 10 * n,
  placed_at: placed, deleted_at: null }, extra || {});
async function setup(page, backend, flagOn) {
  await page.clock.setFixedTime(new Date('2026-11-24T14:00:00Z'));                           // 8:00 AM in Chicago, Nov 24
  backend.tables.daily_reports = [{ id: 'dr-1', report_date: '2026-11-23', orders_count: 2, revenue: '30.00', currency: 'USD', new_inquiries_count: 0, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 0, ai_cost: 0 }];
  backend.tables.sop_documents = [];
  backend.tables.orders = [order(1, '2026-11-23T15:00:00Z'), order(2, '2026-11-23T20:00:00Z'), order(3, '2026-11-24T13:00:00Z'), order(4, '2026-11-22T15:00:00Z')];   // only 1 and 2 were placed yesterday
  backend.tables.order_items = [];
  await page.addInitScript((flag) => { try { if (flag) localStorage.setItem('he_backups_page', 'on'); } catch (e) {} window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, flagOn);
}
async function openWithLink(page) {
  await page.goto('/owner-login.html?print=daypack');
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#dash')).toBeVisible();
}
const printed = (page) => page.evaluate(() => window.__printed || 0);
const writes = (backend) => backend.requests.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/'));

test.describe('the daily print link', () => {
  test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'the printer sits next to a computer; run once'); });

  test('opened by the daily link: yesterday\'s day pack is printed once; opening the link again the same day prints nothing', async ({ page, backend, pageErrors }) => {
    await setup(page, backend, true);
    await openWithLink(page);
    await expect.poll(() => printed(page)).toBe(1);
    await expect(page.locator('section#backupsPanel')).toHaveClass(/activePage/);
    await expect(page.locator('[data-printdaypack]')).toHaveAttribute('data-printdaypack', '2026-11-23');
    await expect(page.locator('[data-printdayorders]')).toHaveAttribute('data-printdayorders', '2');
    await expect(page.locator('[data-printdaypack]')).toContainText('The saved nightly recap of this day');
    await expect(page.locator('#bkDay')).toHaveValue('2026-11-23');
    await expect(page.locator('[data-bkautolast]')).toHaveText('Last printed this way in this browser: the day pack for 2026-11-23.');
    expect(await page.evaluate(() => localStorage.getItem('he_auto_print_day'))).toBe('2026-11-23');
    // the same link again that morning (the reminder fired twice, or the page was refreshed)
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('The day pack for 2026-11-23 was already printed from this link in this browser. Nothing was printed again.');
    expect(await printed(page)).toBe(0);
    // the next morning it prints the next day
    await page.clock.setFixedTime(new Date('2026-11-25T14:00:00Z'));
    await page.reload();
    await expect.poll(() => printed(page)).toBe(1);
    await expect(page.locator('[data-printdaypack]')).toHaveAttribute('data-printdaypack', '2026-11-24');
    expect(await page.evaluate(() => localStorage.getItem('he_auto_print_day'))).toBe('2026-11-24');
    expect(writes(backend)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('without the link nothing prints by itself; the page shows the link, and "Try it now" prints yesterday\'s pack', async ({ page, backend }) => {
    await setup(page, backend, true);
    await page.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
    await login(page);
    await gotoPage(page, 'backupsPanel');
    const S = page.locator('[data-bkauto]');
    await expect(S.locator('h3')).toHaveText('Automatic daily printing');
    await expect(S).toContainText('A web page cannot wake up on its own');
    await expect(page.locator('#bkAutoLink')).toHaveValue(/\/owner-login\.html\?print=daypack$/);
    await expect(S.locator('[data-bkautolast]')).toHaveText('Not printed this way in this browser yet.');
    expect(await printed(page)).toBe(0);
    await S.locator('[data-bk="auto-copy"]').click();
    expect(await page.evaluate(() => window.__copied)).toEqual([await page.inputValue('#bkAutoLink')]);
    await S.locator('[data-bk="auto-try"]').click();
    await expect.poll(() => printed(page)).toBe(1);
    await expect(page.locator('[data-printdaypack]')).toHaveAttribute('data-printdaypack', '2026-11-23');
    await expect(page.locator('[data-bkautolast]')).toHaveText('Last printed this way in this browser: the day pack for 2026-11-23.');
    // trying again prints again: the button is for testing the printer
    await page.locator('[data-bkauto] [data-bk="auto-try"]').click();
    await expect.poll(() => printed(page)).toBe(2);
    // the day pack and client list above are unchanged
    await expect(page.locator('[data-bkdaypack] h3')).toHaveText(['Day pack', 'Client list']);
  });

  test('the link with Backups & Printouts switched off: said plainly, nothing printed', async ({ page, backend }) => {
    await setup(page, backend, false);
    await openWithLink(page);
    await expect(page.locator('#dashError, .dashError, [role="alert"]').filter({ hasText: 'The daily print link needs the "Backups & Printouts" switch turned on' }).first()).toBeVisible();
    expect(await printed(page)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('he_auto_print_day'))).toBeNull();
  });

  test('the orders cannot be read: nothing is printed and the day is not ticked off, so the next opening tries again', async ({ page, backend }) => {
    await setup(page, backend, true);
    let fail = true;
    await page.route('**/rest/v1/orders*', route => (fail && route.request().url().includes('customer_email') && route.request().url().includes('placed_at=gte') ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'SYNTHETIC failure' }) }) : route.fallback()));
    await openWithLink(page);
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toContainText('could not be read');
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toContainText('Nothing was printed.');
    expect(await printed(page)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('he_auto_print_day'))).toBeNull();
    fail = false;
    await page.reload();
    await expect.poll(() => printed(page)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('he_auto_print_day'))).toBe('2026-11-23');
  });
});
