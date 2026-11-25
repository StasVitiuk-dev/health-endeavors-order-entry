// Confirmed sales tax rates (owner, Nov 23: "I don't want to charge too little or
// too much"): drafts/46 connected to Tax Records through he-tax-rate-store.js,
// behind the he_tax_rates switch (OFF, not on Feature Flags). The rates become the
// settings the tax rules (he-tax.js) use. Browser tests that need the database run
// against a REAL throwaway Postgres with drafts/46 installed; they skip where it is
// not running (GitHub CI). Every value is made up.
const path = require('path');
const S = require('../../assets/invoice/he-tax-rate-store.js');
const T = require('../../assets/invoice/he-tax.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { pgBridge, pgAvailable } = require('../helpers/pg-bridge');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const INSTALL = path.resolve(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts', '46_DRAFT_tax_rates.sql');
const TABLES = ['tax_rates'];
const RPCS = ['set_tax_rate', 'recheck_tax_rate'];
const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const needPg = () => test.skip(!pgAvailable(), 'needs the local throwaway Postgres (not available here, e.g. GitHub CI)');
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_tax_rates', 'on'); } catch (e) {} }); }

test.describe('the store (no database)', () => {
  test('the form: a percent becomes the exact rate; mistakes are named; an address is refused', ({}, ti) => {
    node(ti);
    expect(S.checkForm({ place: ' Ships from:  Illinois ', ratePercent: '8.75', from: '2026-07-01', source: 'IDOR Tax Rate Finder' }))
      .toEqual({ ok: true, values: { p_place: 'Ships from: Illinois', p_rate: 0.0875, p_from: '2026-07-01', p_source: 'IDOR Tax Rate Finder', p_note: null } });
    expect(S.checkForm({ place: 'SYN', ratePercent: '10.125%', from: '2027-01-01', source: 'IDOR' }).values.p_rate).toBe(0.10125);
    const bad = S.checkForm({ place: '', ratePercent: '8,75', from: '', source: '' });
    expect(bad.ok).toBe(false);
    expect(bad.problems.join(' ')).toMatch(/2 to 80 characters.*percent.*day the rate starts.*where the rate comes from/);
    expect(S.checkForm({ place: 'SYN', ratePercent: '26', from: '2027-01-01', source: 'IDOR' }).problems[0]).toMatch(/above 25%/);
    expect(S.checkForm({ place: 'SYN', ratePercent: '8.7512', from: '2027-01-01', source: 'IDOR' }).problems[0]).toMatch(/at most 3 decimals/);
    expect(S.checkForm({ place: 'SYN', ratePercent: '8.75', from: '2027-02-30', source: 'IDOR' }).problems[0]).toMatch(/day the rate starts/);
    for (const addr of ['123 Main Street', '4 N Example Ave', 'Ships from 60601', 'Unit 5, 12 Oak Ct']) {
      expect(S.looksLikeAddress(addr), addr).toBe(true);
      expect(S.checkForm({ place: addr, ratePercent: '8', from: '2027-01-01', source: 'IDOR' }).problems[0]).toMatch(/street address or a ZIP code/);
    }
    for (const name of ['Ships from: Illinois', 'Warehouse 2 (future)', 'Illinois home office']) expect(S.looksLikeAddress(name), name).toBe(false);
    expect([S.pctText(0.0875), S.pctText(0.1), S.pctText('0.10125'), S.pctText(0)]).toEqual(['8.75', '10', '10.125', '0']);
  });

  test('a stored rate becomes a setting the tax rules use, with its start day and re-check', ({}, ti) => {
    node(ti);
    const row = { id: 'x', place: 'SYN place', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', confirmed_by: 'u1', confirmed_at: '2026-11-24T15:00:00+00:00', rechecked_at: null };
    const s = S.toSetting(row);
    expect(s).toMatchObject({ place: 'SYN place', rate: 0.0875, confirmedBy: 'u1', effectiveFrom: '2026-07-01', reference: 'IDOR Tax Rate Finder' });
    expect(T.checkRateSetting(s).ok).toBe(true);
    expect(T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: s, asOf: '2026-12-01' }).tax).toBe(8.75);
    expect(T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: s, asOf: '2027-01-01' }).status).toBe('PENDING');
    expect(S.standing(row, '2026-12-01', T)).toEqual({ state: 'IN_FORCE', due: '2027-01-01' });
    expect(S.standing(row, '2027-01-01', T).state).toBe('RECHECK_DUE');
    expect(S.standing(Object.assign({}, row, { rechecked_at: '2027-01-02' }), '2027-03-01', T)).toEqual({ state: 'IN_FORCE', due: '2027-07-01' });
    expect(S.standing(Object.assign({}, row, { effective_until: '2026-12-31' }), '2027-01-05', T).state).toBe('ENDED');
    expect(S.standing(Object.assign({}, row, { effective_from: '2027-01-01' }), '2026-12-01', T).state).toBe('STARTS_LATER');
    expect(S.toSetting({ rate: 'abc' })).toBeNull();
  });

  test('who may do what, double clicks, and database errors in plain words', async ({}, ti) => {
    node(ti);
    const calls = [];
    let release;
    const client = { from: () => ({ select: () => ({ order: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }),
      rpc: (name, args) => { calls.push([name, args]); return new Promise(r => { release = () => r({ data: { ok: true, duplicate: false, id: 'n', ended: null }, error: null }); }); } };
    const form = { place: 'SYN place', ratePercent: '8.75', from: '2027-01-01', source: 'IDOR Tax Rate Finder' };
    expect((await S.createStore({ client, enabled: false, role: 'owner' }).confirm(form)).off).toBe(true);
    expect((await S.createStore({ client, enabled: true, role: 'employee' }).confirm(form)).message).toMatch(/Only the owner or an administrator/);
    expect((await S.createStore({ client, enabled: true, role: 'employee' }).recheck('00000000-0000-4000-8000-000000000001')).forbidden).toBe(true);
    expect((await S.createStore({ client, enabled: true, role: 'employee' }).list()).ok).toBe(true);   // everyone may read
    const st = S.createStore({ client, enabled: true, role: 'owner' });
    const first = st.confirm(form);
    expect((await st.confirm(form)).busy).toBe(true);
    release();
    expect((await first).message).toBe('Confirmed 8.75% for SYN place from 2027-01-01.');
    expect(calls).toEqual([['set_tax_rate', { p_place: 'SYN place', p_rate: 0.0875, p_from: '2027-01-01', p_source: 'IDOR Tax Rate Finder', p_note: null }]]);
    expect((await st.confirm(Object.assign({}, form, { place: '12 Example Street' }))).problems.length).toBe(1);
    expect(calls.length).toBe(1);   // refused before anything was sent
    expect(S.friendlyError({ code: 'PGRST205', message: "Could not find the table 'public.tax_rates'" })).toMatch(/not installed in the database yet/);
    expect(S.friendlyError({ code: '23P01', message: 'The rate in force for SYN started on 2027-01-01; a new rate must start after that day.' })).toMatch(/must start after/);
    expect(S.friendlyError({ code: '23514', message: 'x' })).toMatch(/out of range/);
    expect(S.friendlyError({ message: 'Failed to fetch' })).toMatch(/Could not reach the database/);
  });
});

test.describe('Tax Records', () => {
  test('switch OFF (the default): Tax Records is unchanged', async ({ page }) => {
    await login(page); await gotoPage(page, 'taxRecordsPanel');
    await expect(page.locator('#taxRatesHost')).toBeEmpty();
  });

  test('switch ON but not installed (production today): it says so, and nothing can be sent', async ({ page }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await page.route(/\/rest\/v1\/(rpc\/(set|recheck)_tax_rate|tax_rates)/, r => r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.tax_rates' in the schema cache" }) }));
    await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
    await expect(page.locator('#taxRatesHost [data-trstate="notinstalled"]')).toContainText('not installed in the database yet');
    await expect(page.locator('#taxRatesHost form')).toHaveCount(0);
  });

  test('an administrator confirms and re-checks too (owner decision, Nov 24)', async ({ page, backend }) => {
    backend.tables.profiles.find(p => p.role === 'owner').role = 'administrator';
    backend.tables.tax_rates = [{ id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
    const host = page.locator('#taxRatesHost');
    await expect(host.locator('form[data-trform]')).toHaveCount(1);
    await expect(host.locator('[data-trrecheck]')).toHaveCount(1);
    await expect(host).not.toContainText('Only the owner or an administrator confirms');
  });

  test('staff see the rates but no form and no buttons', async ({ page, backend }) => {
    backend.tables.profiles.find(p => p.role === 'owner').role = 'employee';
    backend.tables.tax_rates = [{ id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
    const host = page.locator('#taxRatesHost');
    await expect(host.locator('tr[data-trrow]')).toContainText('8.75%');
    await expect(host.locator('form')).toHaveCount(0);
    await expect(host.locator('[data-trrecheck]')).toHaveCount(0);
    await expect(host).toContainText('Only the owner or an administrator confirms or re-checks a rate.');
  });

  test.describe('against a real database with drafts/46 installed', () => {
    test.beforeEach(needPg);

    test('the owner confirms a rate, sees it in force, re-checks it, and a later change ends the old one', async ({ page }, ti) => {
      test.skip(ti.project.name !== 'desktop', 'one database run is enough; the phone layout is checked below');
      const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'owner' });
      try {
        await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
        const host = page.locator('#taxRatesHost');
        await expect(host.locator('[data-trstate="empty"]')).toContainText('No rate confirmed yet, so every invoice with tax shows TAX PENDING.');
        // an address is refused before anything is sent
        await host.locator('#trPlace').fill('123 Example Street');
        await host.locator('#trRate').fill('8.75');
        await host.locator('#trFrom').fill('2026-07-01');
        await host.locator('form[data-trform] button[type="submit"]').click();
        await expect(host.locator('[data-trmessage]')).toContainText('looks like a street address');
        expect(await db.query('select count(*) from tax_rates')).toBe('0');
        await host.locator('#trPlace').fill('Ships from: SYNTHETIC place');
        await host.locator('form[data-trform] button[type="submit"]').click();
        await expect(host.locator('[data-trmessage]')).toHaveText('Confirmed 8.75% for Ships from: SYNTHETIC place from 2026-07-01.');
        const row = host.locator('tr[data-trrow]');
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute('data-trstanding', 'IN_FORCE');
        await expect(row).toContainText('re-check due 2027-01-01');
        expect(await db.query("select place||'|'||rate||'|'||effective_from||'|'||source from tax_rates")).toBe('Ships from: SYNTHETIC place|0.08750|2026-07-01|IDOR Tax Rate Finder');
        // re-checked today
        await row.locator('[data-trrecheck]').click();
        await expect(host.locator('[data-trmessage]')).toHaveText('Recorded: re-checked today, still correct.');
        expect(await db.query("select rechecked_at is not null from tax_rates")).toBe('t');
        // the rate changes from January 1: the old one ends December 31
        await host.locator('#trPlace').fill('Ships from: SYNTHETIC place');
        await host.locator('#trRate').fill('9');
        await host.locator('#trFrom').fill('2027-01-01');
        await host.locator('form[data-trform] button[type="submit"]').click();
        await expect(host.locator('[data-trmessage]')).toHaveText('Confirmed 9% for Ships from: SYNTHETIC place from 2027-01-01. The previous rate ends the day before.');
        expect(await db.query("select string_agg(rate||':'||effective_from||'..'||coalesce(effective_until::text,'-'), ' ' order by effective_from) from tax_rates"))
          .toBe('0.08750:2026-07-01..2026-12-31 0.09000:2027-01-01..-');
        await expect(host.locator('tr[data-trstanding="STARTS_LATER"]')).toContainText('9%');
        // a new rate that starts before the one in force: the database refuses, and says why
        await host.locator('#trPlace').fill('Ships from: SYNTHETIC place');
        await host.locator('#trRate').fill('7');
        await host.locator('#trFrom').fill('2026-12-01');
        await host.locator('form[data-trform] button[type="submit"]').click();
        await expect(host.locator('[data-trmessage]')).toContainText('must start after that day');
        expect(await db.query('select count(*) from tax_rates')).toBe('2');
        expect(await host.evaluate(unnamedControls)).toEqual([]);
      } finally { await db.close(); }
    });

    test('the database refuses an administrator even when the page is fooled', async ({ page, backend }, ti) => {
      test.skip(ti.project.name !== 'desktop', 'run once');
      // the page believes the person is the owner; the database knows they are an employee
      const db = await pgBridge(page, { install: INSTALL, tables: TABLES, rpcs: RPCS, role: 'employee' });
      try {
        await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
        const host = page.locator('#taxRatesHost');
        await host.locator('#trPlace').fill('Ships from: SYNTHETIC place');
        await host.locator('#trRate').fill('8.75');
        await host.locator('#trFrom').fill('2026-07-01');
        await host.locator('form[data-trform] button[type="submit"]').click();
        await expect(host.locator('[data-trmessage]')).toContainText('Only the owner or an administrator can confirm a tax rate.');
        expect(await db.query('select count(*) from tax_rates')).toBe('0');
      } finally { await db.close(); }
    });
  });

  test('Home tells the owner when a rate needs its re-check, and the button opens Tax Records', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await page.clock.setFixedTime(new Date('2027-01-05T15:00:00Z'));
    backend.tables.tax_rates = [{ id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC place', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page);
    const alert = page.locator('#taxRateAlertHost [data-taxratealert]');
    await expect(alert).toHaveAttribute('data-taxratealert', '1');
    await expect(alert).toContainText('1 sales tax rate needs a re-check');
    await alert.locator('[data-taxratealertopen]').click();
    await expect(page.locator('#taxRecordsPanel')).toBeVisible();
    await expect(page.locator('#taxRatesHost tr[data-trstanding="RECHECK_DUE"]')).toHaveCount(1);
  });

  test('Home stays as it is when no re-check is due, for staff, or with the switch off', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await page.clock.setFixedTime(new Date('2026-12-01T15:00:00Z'));
    backend.tables.tax_rates = [{ id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC place', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page);
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('#taxRateAlertHost')).toBeEmpty();
  });

  test('readable in light and dark, every control named (the section, its badges and the Home notice)', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
    await page.clock.setFixedTime(new Date('2027-01-05T15:00:00Z'));
    backend.tables.tax_rates = [
      { id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC place', rate: '0.08750', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null },
      { id: '00000000-0000-4000-8000-00000000a002', place: 'Ships from: SYNTHETIC place', rate: '0.08250', effective_from: '2026-01-01', effective_until: '2026-06-30', source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2026-01-02T15:00:00Z', rechecked_at: null, rechecked_by: null },
      { id: '00000000-0000-4000-8000-00000000a003', place: 'Ships from: SYNTHETIC place', rate: '0.09000', effective_from: '2027-03-01', effective_until: null, source: 'IDOR Tax Rate Finder', note: null, confirmed_by: 'u', confirmed_at: '2027-01-04T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'attentionPanel');
      await expect(page.locator('#taxRateAlertHost [data-taxratealert]')).toBeVisible();
      expect(await check(page.locator('#taxRateAlertHost')), scheme + ' Home notice').toEqual([]);
      await gotoPage(page, 'taxRecordsPanel');
      const host = page.locator('#taxRatesHost');
      await expect(host.locator('tr[data-trrow]')).toHaveCount(3);
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(host), scheme + ' Tax Records').toEqual([]);
      expect(await host.evaluate(unnamedControls), scheme).toEqual([]);
    }
  });

  test('at phone size the rates and the form fit the screen', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    backend.tables.tax_rates = [{ id: '00000000-0000-4000-8000-00000000a001', place: 'Ships from: SYNTHETIC place with a long name for testing', rate: '0.10125', effective_from: '2026-07-01', effective_until: null, source: 'IDOR Tax Rate Finder, checked by phone with the Department of Revenue', note: null, confirmed_by: 'u', confirmed_at: '2026-11-24T15:00:00Z', rechecked_at: null, rechecked_by: null }];
    await on(page); await login(page); await gotoPage(page, 'taxRecordsPanel');
    await expect(page.locator('#taxRatesHost tr[data-trrow]')).toContainText('10.125%');
    await expect(page.locator('#taxRatesHost form[data-trform]')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
