// Backups & Printouts (owner request of Nov 23), behind the preview switch
// he_backups_page (off by default; with it off the page is not in the menu).
// Daily recaps: print a month on Letter, or save it as a spreadsheet file.
// Manuals: if the dashboard is down (with a paper stock log), how the dashboard
// works, the owner's procedures, printer setup, or all together. The database
// backups are shown as UNKNOWN, never a tick the page cannot prove. Reads only;
// printouts black on white. Made-up data; window.print is replaced.
const fs = require('fs');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const pdfPages = (buf) => [...buf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => Math.round(+m[1]) + 'x' + Math.round(+m[2]));
const DAY = (d, o, rev) => ({ id: 'dr-' + d, report_date: d, orders_count: o, revenue: rev, currency: 'USD', new_inquiries_count: 1, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 4, ai_cost: 0.25, emailed: true });
function seed(backend, opts) {
  const o = opts || {};
  backend.tables.daily_reports = [DAY('2026-11-20', 3, '120.50'), DAY('2026-11-21', 0, '0.00'), DAY('2026-11-22', 5, null), DAY('2026-10-31', 2, '80.00')];
  backend.tables.sop_documents = o.noSops ? [] : [
    { id: 'sop1', title: 'SYNTHETIC How to pack an order', category: 'Shipping', content: 'Check the slip.\nPack the jars upright.', updated_at: '2026-11-01T00:00:00Z', agent_visible: false },
    { id: 'sop2', title: 'SYNTHETIC Daily opening', category: null, content: 'Open the dashboard and read Needs Your Attention.', updated_at: '2026-11-02T00:00:00Z', agent_visible: false }];
}
async function open(page, backend, opts) {
  seed(backend, opts);
  await page.addInitScript(() => { try { localStorage.setItem('he_backups_page', 'on'); } catch (e) {} window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await login(page);
  await gotoPage(page, 'backupsPanel');
  await expect(page.locator('#backupsPanel h2')).toHaveText('Backups & Printouts');
}

test('switch OFF (the default): no page in the menu and nothing drawn', async ({ page }) => {
  await login(page);
  await expect(page.locator('#sidebarNav')).not.toContainText('Backups & Printouts');
  await expect(page.locator('#backupsPanel')).toBeEmpty();
});

test('the newest month of recaps is shown; another month can be chosen', async ({ page, backend }) => {
  await open(page, backend);
  await expect(page.locator('#sidebarNav')).toContainText('Backups & Printouts');
  const host = page.locator('#backupsPanel');
  await expect(host.locator('#bkMonth')).toHaveValue('2026-11');
  await expect(host.locator('[data-bkrecaps]')).toHaveAttribute('data-bkrecaps', '3');
  await expect(host.locator('[data-bkrecaps] tbody tr').first()).toContainText('2026-11-20');
  await expect(host.locator('[data-bkrecaps] tbody tr').nth(2)).toContainText('—');           // no revenue figure: never $0.00
  await host.locator('#bkMonth').selectOption('2026-10');
  await expect(host.locator('[data-bkrecaps]')).toHaveAttribute('data-bkrecaps', '1');
  await expect(host.locator('#bkMonth')).toBeFocused();
  await expect(host).toContainText('UNKNOWN');
  await host.locator('[data-bkgoto="continuityPanel"]').click();
  await expect(page.locator('#continuityPanel')).toBeVisible();
});

test('a month prints on one Letter page with its totals, black on white', async ({ page, backend, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, backend);
  await page.locator('#backupsPanel [data-bk="print-recaps"]').click();
  const doc = page.locator('#invoicePrintHost');
  await expect(doc.locator('[data-printrecaps="2026-11"]')).toContainText('Daily recaps, November 2026');
  await expect(doc.locator('tbody tr')).toHaveCount(3);
  await expect(doc.locator('[data-printtotal="month"]')).toHaveText('Month: 3 day(s) · orders 8 · revenue $120.50 (some days have no revenue figure)');
  await expect(page.locator('#labelPrintCss')).toHaveAttribute('media', 'not all');
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toEqual(['612x792']);
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const notBlack = await doc.evaluate(root => [root, ...root.querySelectorAll('*')].map(el => getComputedStyle(el)).filter(cs => cs.display !== 'none' && cs.color !== 'rgb(0, 0, 0)').length);
  expect(notBlack).toBe(0);
});

test('a month saves as a spreadsheet file with every day and the exact figures', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await open(page, backend);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#backupsPanel [data-bk="csv-recaps"]').click()]);
  expect(dl.suggestedFilename()).toBe('daily-recaps-2026-11.csv');
  // every value is quoted (the dashboard's safe spreadsheet format); read them back plainly
  const text = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').split('\r\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '')).join(','));
  expect(text[0]).toBe('Date,Orders,Revenue,Currency,New questions,Tasks opened,Incidents opened,AI calls,AI cost (USD)');
  expect(text.slice(1)).toEqual(['2026-11-20,3,120.50,USD,1,0,0,4,0.25', '2026-11-21,0,0.00,USD,1,0,0,4,0.25', '2026-11-22,5,,USD,1,0,0,4,0.25']);
  await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('Saved daily-recaps-2026-11.csv (3 days).');
});

test('manuals print: the "dashboard is down" sheet has a paper stock log; all manuals start on new pages', async ({ page, backend, browserName }, ti) => {
  test.skip(ti.project.name !== 'desktop' || browserName !== 'chromium', 'PDF needs Chromium; run once');
  await open(page, backend);
  const doc = page.locator('#invoicePrintHost');
  await page.locator('#backupsPanel [data-bkmanual="down"]').click();
  await expect(doc.locator('[data-printmanual="down"] ol li')).toHaveCount(6);
  await expect(doc.locator('[data-printmanual="down"] tbody tr')).toHaveCount(14);
  await expect(doc.locator('[data-printmanual="down"] thead th')).toHaveText(['Date', 'Product', 'Change', 'Reason', 'Who']);
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toEqual(['612x792']);
  await page.locator('#backupsPanel [data-bkmanual="sops"]').click();
  await expect(doc).toContainText('SYNTHETIC How to pack an order (Shipping)');
  await expect(doc).toContainText('Pack the jars upright.');
  await page.locator('#backupsPanel [data-bkmanual="all"]').click();
  await expect(doc.locator('[data-printmanual]')).toHaveCount(4);
  const pages = pdfPages(await page.pdf({ preferCSSPageSize: true }));
  expect(pages.length).toBeGreaterThanOrEqual(4);
  expect(new Set(pages)).toEqual(new Set(['612x792']));
  expect(await page.evaluate(() => window.__printed)).toBe(3);
});

test('no procedures written yet: that manual says so and cannot be printed', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await open(page, backend, { noSops: true });
  await expect(page.locator('[data-bkmanualrow="sops"]')).toContainText('No procedures written yet');
  await expect(page.locator('[data-bkmanual="sops"]')).toBeDisabled();
  await page.locator('#backupsPanel [data-bkmanual="all"]').click();
  await expect(page.locator('#invoicePrintHost [data-printmanual]')).toHaveCount(3);
});

test('at phone size the page fits without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

// Nov 24 (owner: "print it at the end of every day"): the newest recap is one tap
// away on this page, and the Home feed reminds until it is printed in this browser.
test('print the latest day; the Home reminder shows until it is printed, then clears', async ({ page, backend }) => {
  await page.addInitScript(() => { try { localStorage.setItem('he_attention_feed', 'on'); } catch (e) {} });
  await open(page, backend);
  await gotoPage(page, 'attentionPanel');
  const item = page.locator('#attentionFeedHost [data-feeditem="recap:2026-11-22"]');
  await expect(item.locator('.feedTitle')).toHaveText('The daily recap for Sunday, November 22 is ready to print');
  await item.locator('[data-feedopen="backupsPanel"]').click();
  const host = page.locator('#backupsPanel');
  await host.locator('[data-bk="print-latest"]').click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('#invoicePrintHost [data-printrecapday="2026-11-22"]')).toContainText('Revenue');
  await expect(host.locator('[data-bkmessage]')).toContainText('Opened the recap for 2026-11-22 for printing');
  expect(await page.evaluate(() => localStorage.getItem('he_recap_printed_upto'))).toBe('2026-11-22');
  await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
  await expect(page.locator('#attentionFeedHost [data-feeditem]').first()).toBeVisible();
  await expect(page.locator('#attentionFeedHost [data-feeditem="recap:2026-11-22"]')).toHaveCount(0);
  // a newer day brings the reminder back
  backend.tables.daily_reports.push(DAY('2026-11-23', 2, '60.00'));
  await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
  await expect(page.locator('#attentionFeedHost [data-feeditem="recap:2026-11-23"]')).toBeVisible();
});

// Nov 24 (owner rule: nothing kept in only one browser): with the shared settings
// in use, the day up to which the recap was printed is kept in the database too,
// so printing on one device clears the Home reminder on every device.
test.describe('the printed-recap note on every device (shared settings in use)', () => {
  const shared = (page) => page.addInitScript(() => { try { localStorage.setItem('he_attention_feed', 'on'); localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} });
  const row = (day) => ({ id: 'recap_printed', key: 'recap_printed', value: { day }, audience: 'owner_admin', updated_at: '2026-11-23T02:00:00Z', updated_by: null });

  test('printed on another device: this browser shows no reminder; an older shared day still reminds', async ({ page, backend }) => {
    backend.tables.shared_settings = [row('2026-11-22')];
    await shared(page);
    await open(page, backend);
    await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost [data-feeditem]').first()).toBeVisible();
    await expect(page.locator('#attentionFeedHost [data-feeditem^="recap:"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('he_recap_printed_upto'))).toBeNull();   // never printed here
    backend.tables.shared_settings = [row('2026-11-21')];
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'attentionPanel');
    await expect(page.locator('#attentionFeedHost [data-feeditem="recap:2026-11-22"]')).toBeVisible();
  });

  test('printing here saves the day for every device, once, and says so; a later saved day is never moved back', async ({ page, backend }) => {
    backend.tables.shared_settings = [];
    backend.rpc.set_shared_setting = (body) => { backend.tables.shared_settings = [Object.assign(row(body.p_value.day), { audience: body.p_audience })]; return { ok: true, updated_at: '2026-11-24T16:00:00Z' }; };
    await shared(page);
    await open(page, backend);
    const host = page.locator('#backupsPanel');
    await host.locator('[data-bk="print-latest"]').click();
    await expect(host.locator('[data-bkmessage]')).toHaveText('Opened the recap for 2026-11-22 for printing. The Home reminder is cleared for this day on every device.');
    const saves = () => backend.requests.filter(r => r.rpc === 'set_shared_setting').map(r => r.body);
    expect(saves()).toEqual([{ p_key: 'recap_printed', p_value: { day: '2026-11-22' }, p_audience: 'owner_admin' }]);
    await host.locator('[data-bk="print-latest"]').click();                      // printing the same day again saves nothing new
    await expect(host.locator('[data-bkmessage]')).toContainText('on every device');
    expect(saves()).toHaveLength(1);
    backend.tables.shared_settings = [row('2026-12-31')];                        // another device is already further
    await host.locator('[data-bk="print-latest"]').click();
    await expect(host.locator('[data-bkmessage]')).toContainText('on every device');
    expect(saves()).toHaveLength(1);
    expect(backend.tables.shared_settings[0].value.day).toBe('2026-12-31');
  });

  test('not the owner (the database refuses), or the shared settings not installed: the note stays in this browser, said as before', async ({ page, backend }) => {
    backend.tables.shared_settings = [];
    backend.rpc.set_shared_setting = () => ({ __error: { status: 403, code: '42501', message: 'Only the owner can change a shared setting.' } });
    await shared(page);
    await open(page, backend);
    const host = page.locator('#backupsPanel');
    await host.locator('[data-bk="print-latest"]').click();
    await expect(host.locator('[data-bkmessage]')).toHaveText('Opened the recap for 2026-11-22 for printing. The Home reminder is cleared for this day.');
    await expect.poll(() => backend.requests.filter(r => r.rpc === 'set_shared_setting').length).toBe(1);
    await expect(host.locator('[data-bkmessage]')).toHaveText('Opened the recap for 2026-11-22 for printing. The Home reminder is cleared for this day.');
    expect(await page.evaluate(() => localStorage.getItem('he_recap_printed_upto'))).toBe('2026-11-22');
    await expect(page.locator('#dashError')).toBeHidden();
  });
});

test('shared settings off (as shipped): printing the recap asks the database nothing about shared settings', async ({ page, backend }) => {
  await open(page, backend);
  await page.locator('#backupsPanel [data-bk="print-latest"]').click();
  await expect(page.locator('#backupsPanel [data-bkmessage]')).toContainText('The Home reminder is cleared for this day.');
  await page.waitForLoadState('networkidle');
  expect(backend.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
  expect(backend.requests.filter(r => r.table === 'shared_settings' && !r.params.some(([k, v]) => k === 'limit' && v === '0'))).toEqual([]);
});
